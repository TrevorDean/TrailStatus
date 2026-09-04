// Weather archive — the write side of the reopening model's training data.
//
// Sibling of history.js, same arrangement and for the same reasons: it runs from
// worker.js's scheduled() handler, it is kept out of worker.js so the request
// path and the cron path stay separately legible, and worker.js imports exactly
// one function from each.
//
// It differs from history.js in one important way. That one only READS KV, which
// is why it can run on a Worker at all. This one FETCHES Open-Meteo — which is
// fine, because Open-Meteo does not block Cloudflare the way Trailforks does.
// The "do not move scraping back onto a Worker" rule is about Trailforks only.

import { TRAILS } from "./public/trails.js";
import {
  ARCHIVE_VARS,
  archiveRequestUrl,
  groupByLocation,
  shapeArchiveResponse,
  shapeForecastSnapshot
} from "./public/weather.js";

// The cron fires every 5 minutes because the STATUS diff wants that cadence.
// The forecast changes hourly, so 11 of every 12 runs must do nothing here but
// one cheap SELECT — otherwise this table would grow twelvefold for no new
// information and burn the D1 write budget doing it.
const HOUR = 3600;

// D1 caps BOUND PARAMETERS PER STATEMENT AT 100 — not rows, parameters. A
// 12-column multi-row INSERT therefore fits 8 rows, and asking for more fails at
// execution time with "too many SQL variables", which is a runtime error the
// type system cannot see coming. Deriving it from COLUMNS rather than hardcoding
// a number means adding a column narrows the chunk automatically instead of
// breaking the cron the next time it runs.
//
// (scripts/backfill-weather.js does not hit this: it writes SQL literals to a
// file rather than binding parameters, so its own chunk size is about request
// size instead. The two limits are unrelated — do not copy one to the other.)
const D1_MAX_BOUND_PARAMS = 100;
const STATEMENTS_PER_BATCH = 20;

// How far back a single catch-up may reach. Two days covers any realistic cron
// outage while bounding the write burst; anything older is the backfill
// script's job, not the cron's.
const MAX_CATCHUP_HOURS = 48;

const COLUMNS = [
  "trail_key", "hour_ts",
  "precip_in", "temp_f", "et0_in", "humidity_pct", "wind_kmh",
  "radiation_wm2", "soil_moist_0_1", "soil_moist_1_3", "soil_moist_3_9", "soil_temp_f"
];

const ROWS_PER_STATEMENT = Math.floor(D1_MAX_BOUND_PARAMS / COLUMNS.length);

// Guard against ARCHIVE_VARS and the schema drifting apart. They are two lists
// in two files that must stay the same length and order; a mismatch would write
// soil temperature into the humidity column and look entirely plausible.
if (COLUMNS.length !== ARCHIVE_VARS.length + 2) {
  throw new Error(`weather_hourly has ${COLUMNS.length} columns but ARCHIVE_VARS has ${ARCHIVE_VARS.length}`);
}

export function currentHourTs(now = new Date()) {
  return Math.floor(now.getTime() / 1000 / HOUR) * HOUR;
}

// Which hours still need writing, given what the table already holds. Returns a
// lower bound, not a list: the response decides what actually exists.
export function catchupFloor(latestStored, hourTs) {
  if (!latestStored) return hourTs - MAX_CATCHUP_HOURS * HOUR;
  return Math.max(latestStored + HOUR, hourTs - MAX_CATCHUP_HOURS * HOUR);
}

function insertStatements(db, rows) {
  const statements = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
    const chunk = rows.slice(i, i + ROWS_PER_STATEMENT);
    const placeholders = chunk.map(() => `(${COLUMNS.map(() => "?").join(",")})`).join(",");
    // INSERT OR REPLACE, not INSERT: a re-run over hours already stored must be a
    // no-op rather than an error, so the backfill and this cron can overlap and
    // a catch-up can safely re-cover ground.
    statements.push(
      db.prepare(
        `INSERT OR REPLACE INTO weather_hourly (${COLUMNS.join(",")}) VALUES ${placeholders}`
      ).bind(...chunk.flat())
    );
  }
  return statements;
}

export async function writeArchiveRows(db, rows) {
  const statements = insertStatements(db, rows);
  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    await db.batch(statements.slice(i, i + STATEMENTS_PER_BATCH));
  }
  return rows.length;
}

export async function recordWeatherHour(env, now = new Date(), fetchImpl = fetch) {
  if (!env.TRAIL_HISTORY) return { skipped: "missing binding" };

  const db = env.TRAIL_HISTORY;
  const hourTs = currentHourTs(now);

  const latest = await db.prepare("SELECT MAX(hour_ts) AS h FROM weather_hourly").first();
  const floor = catchupFloor(latest?.h ?? null, hourTs);
  if (floor > hourTs) return { skipped: "hour already recorded", hourTs };

  const groups = groupByLocation(TRAILS);
  // past_days 2 rather than 1: the response is trimmed to `floor` below anyway,
  // and asking for the extra day is free, so an outage that outlasts a single
  // day still heals itself instead of leaving a permanent hole.
  const response = await fetchImpl(archiveRequestUrl(groups, { pastDays: 2, forecastDays: 1 }));
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  const payload = await response.json();

  // Only hours we do not already have, and never the future: a forecast row in
  // weather_hourly would be indistinguishable from an observation later, which
  // is exactly the confusion forecast_snapshots exists to prevent.
  const rows = shapeArchiveResponse(payload, groups)
    .filter((row) => row[1] >= floor && row[1] <= hourTs);

  if (rows.length === 0) return { skipped: "no new hours", hourTs };

  const written = await writeArchiveRows(db, rows);
  const snapshot = await maybeSnapshotForecast(db, payload, groups, hourTs);
  return { hourTs, written, hours: written / TRAILS.length, snapshot };
}

// One vintage per day is enough to backtest against — the forecast is refreshed
// hourly, but consecutive hours of it are near-duplicates and the point is to
// capture what was knowable on a given day, not to mirror the model.
export async function maybeSnapshotForecast(db, payload, groups, snapshotTs) {
  const dayAgo = snapshotTs - 24 * HOUR;
  const recent = await db
    .prepare("SELECT MAX(snapshot_ts) AS s FROM forecast_snapshots")
    .first();
  if (recent?.s && recent.s > dayAgo) return { skipped: "snapshot is under a day old" };

  const rows = shapeForecastSnapshot(payload, groups, snapshotTs);
  const statements = rows.map((r) =>
    db.prepare(
      `INSERT OR REPLACE INTO forecast_snapshots
       (trail_key, snapshot_ts, horizon_ts, times_json, precip_json, temp_json, et0_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).bind(...r)
  );
  for (let i = 0; i < statements.length; i += STATEMENTS_PER_BATCH) {
    await db.batch(statements.slice(i, i + STATEMENTS_PER_BATCH));
  }
  return { written: rows.length };
}
