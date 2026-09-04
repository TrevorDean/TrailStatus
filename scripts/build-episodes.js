// Derives the training table: one row per closure episode, weather joined.
//
// This is the artifact to actually stare at — not weather_hourly, not
// status_events, but the join of the two that answers "the trail took N hours to
// reopen after M inches of rain, on this soil, in this month". It writes nothing
// to D1; it is a read-only view built fresh each time, so re-deriving after a
// definition changes costs nothing and leaves no stale copy behind.
//
//   node scripts/build-episodes.js              # local D1
//   node scripts/build-episodes.js --remote     # the real archive
//   node scripts/build-episodes.js --remote --csv > episodes.csv
//
// Reads through `wrangler d1 execute`, so it needs no CLOUDFLARE_API_TOKEN —
// wrangler's own OAuth session covers it.

import { execFileSync } from "node:child_process";
import { TRAILS } from "../public/trails.js";

const DB = "ntx-history";
const HOUR = 3600;

// Mirrors statusClassFor() in public/script.js: Wet and Prevalent Mud sit in the
// same bucket as Closed, because all three mean "do not ride". That is a
// MODELLING CHOICE, not a fact about the data — status_events stores every
// status verbatim precisely so this line can be redrawn later without a
// re-scrape. If it changes here, change it there too or the site and the model
// will disagree about what a closure is.
export function isClosedStatus(status) {
  const s = String(status || "").toLowerCase();
  return s.includes("closed") || s.includes("wet") || s.includes("mud");
}

function query(sql, remote) {
  const args = ["wrangler", "d1", "execute", DB, "--json", `--command=${sql}`];
  if (remote) args.push("--remote");
  const out = execFileSync("npx", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return JSON.parse(out.slice(out.indexOf("[")))[0].results || [];
}

// Trailforks' own action time when we have it at full precision, else when the
// scraper saw it. A 10-character reported_ts is day-granular (see history.js) and
// is deliberately NOT preferred — for a transition this archive actually watched,
// observed_at is the more precise of the two.
function eventTime(row) {
  if (row.reported_ts && row.reported_ts.length > 10) return Date.parse(row.reported_ts) / 1000;
  return Date.parse(row.observed_at) / 1000;
}

function sum(rows, field, from, to) {
  return rows.reduce((acc, r) => (r.hour_ts >= from && r.hour_ts < to ? acc + (r[field] || 0) : acc), 0);
}

(async () => {
  const remote = process.argv.includes("--remote");
  const csv = process.argv.includes("--csv");

  const events = query(
    "SELECT trail_key, prev_status, status, reported_ts, observed_at FROM status_events ORDER BY trail_key, observed_at",
    remote
  );
  const weather = query(
    "SELECT trail_key, hour_ts, precip_in, et0_in, soil_moist_0_1, temp_f FROM weather_hourly ORDER BY trail_key, hour_ts",
    remote
  );

  const byTrailWeather = {};
  for (const w of weather) (byTrailWeather[w.trail_key] ||= []).push(w);

  const meta = Object.fromEntries(TRAILS.map((t) => [t.key, t]));
  const episodes = [];

  const byTrail = {};
  for (const e of events) (byTrail[e.trail_key] ||= []).push(e);

  for (const [key, list] of Object.entries(byTrail)) {
    let closedAt = null;
    for (const e of list) {
      const closed = isClosedStatus(e.status);
      // A first observation (prev_status NULL) that is already closed opens an
      // episode with an UNKNOWN start — the trail had been closed for some time
      // before the archive existed. Those are marked, not silently timed from
      // the moment we happened to start watching.
      if (closed && closedAt === null) {
        closedAt = { ts: eventTime(e), seeded: e.prev_status === null };
      } else if (!closed && closedAt !== null) {
        const openedTs = eventTime(e);
        const w = byTrailWeather[key] || [];
        const t = meta[key] || {};
        episodes.push({
          trail_key: key,
          org: t.lta || "",
          hyd_group: t.hydGroup || "",
          soil_series: t.soilSeries || "",
          closed_at: new Date(closedAt.ts * 1000).toISOString(),
          opened_at: new Date(openedTs * 1000).toISOString(),
          // A seeded episode's duration is a LOWER BOUND, never a duration.
          // Averaging it in with real ones biases every fit downward.
          start_known: closedAt.seeded ? 0 : 1,
          hours_closed: +((openedTs - closedAt.ts) / HOUR).toFixed(2),
          rain_72h_before: +sum(w, "precip_in", closedAt.ts - 72 * HOUR, closedAt.ts).toFixed(3),
          rain_during: +sum(w, "precip_in", closedAt.ts, openedTs).toFixed(3),
          et0_during: +sum(w, "et0_in", closedAt.ts, openedTs).toFixed(3),
          soil_moist_at_open: w.find((x) => x.hour_ts >= openedTs - HOUR)?.soil_moist_0_1 ?? null,
          month: new Date(openedTs * 1000).getUTCMonth() + 1,
          opened_dow: new Date(openedTs * 1000).getUTCDay(),
          opened_hour_utc: new Date(openedTs * 1000).getUTCHours()
        });
        closedAt = null;
      }
    }
  }

  episodes.sort((a, b) => a.opened_at.localeCompare(b.opened_at));

  if (csv) {
    if (episodes.length === 0) return;
    const cols = Object.keys(episodes[0]);
    console.log(cols.join(","));
    for (const e of episodes) console.log(cols.map((c) => JSON.stringify(e[c] ?? "")).join(","));
    return;
  }

  console.log(`${events.length} status events, ${weather.length} weather hours`);
  console.log(`${episodes.length} closure episode(s), ${episodes.filter((e) => e.start_known).length} with a known start\n`);
  if (episodes.length === 0) {
    console.log("No completed closures yet — a trail must go closed AND reopen to make an episode.");
    return;
  }
  console.table(episodes.map((e) => ({
    trail: e.trail_key,
    hyd: e.hyd_group,
    closed: e.closed_at.slice(0, 16),
    opened: e.opened_at.slice(0, 16),
    hrs: e.hours_closed,
    known: e.start_known ? "y" : "n",
    "rain72h": e.rain_72h_before,
    "et0": e.et0_during
  })));
})();
