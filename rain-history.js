// Observed rainfall — NOAA MRMS radar, sampled at every trailhead once an hour,
// with the NWS National Blend of Models (NBM) filling any hour MRMS was missed.
//
// Third sibling of history.js and weather-history.js, run from the same
// scheduled() handler and for the same reasons kept out of worker.js. Schema and
// the reasoning behind it: migrations/0004_rain_hourly.sql.
//
// Why the NWS image service and not the raw MRMS feed (mrms.ncep.noaa.gov, or the
// noaa-mrms-pds bucket): those are GRIB2 files of the whole CONUS grid, ~24
// million PNG-packed pixels, which a Worker cannot decode inside its CPU limit.
// The image service samples the raster server-side, so one getSamples call with a
// multipoint returns every trailhead's value as ~14 KB of JSON. The price is that
// this layer is radar-only (the gauge-corrected Pass2 product is GRIB2-only) and
// that it keeps no history — see the migration.
//
// Because that layer holds only the newest hour, an hour the cron does not sample
// while it is current is gone from MRMS for good. Those hours are filled from
// Open-Meteo's NBM (ncep_nbm_conus) instead, which serves two days of past hours,
// and the row says so in `source`. NBM rather than best_match/HRRR because it is
// the NWS's own calibrated blend and it read closest to the radar and the local
// gauges on 2026-09-30 (0.17 in at Big Cedar vs MRMS 0.19, HRRR 0.10-0.28).
//
// Like weather-history.js this FETCHES from a Worker, which is fine: neither NOAA
// nor Open-Meteo blocks Cloudflare. The "do not scrape from a Worker" rule is
// about Trailforks.

import { TRAILS } from "./public/trails.js";

export const MRMS_SAMPLES_URL =
  "https://mapservices.weather.noaa.gov/raster/rest/services/obs/mrms_qpe/ImageServer/getSamples";
export const MRMS_LAYER = "conus_QPE_01H";
export const NBM_URL = "https://api.open-meteo.com/v1/forecast";
export const NBM_MODEL = "ncep_nbm_conus";
// How far back a fill can reach: Open-Meteo's past_days=2. An outage longer than
// this leaves hours with no row at all, which is the honest record of it.
export const FILL_LOOKBACK_H = 46;

const HOUR = 3600;
const MM_PER_IN = 25.4;
const COLUMNS = ["trail_key", "hour_ts", "rain_in", "source"];
// D1 caps bound parameters per statement at 100 — see weather-history.js.
const ROWS_PER_STATEMENT = Math.floor(100 / COLUMNS.length);

// Where a trail's rain is measured. MRMS pixels are 1 km, and neighbouring pixels
// genuinely differ in a thunderstorm (Big Cedar on 2026-09-30: 4.7 mm at the
// trailhead, 9.6 mm at Open-Meteo's rounded point 0.3 km away), so this samples
// the trail's own position rather than groupByLocation()'s 2-decimal cells.
//
// Parking first, because ~17 of the 58 lat/lng pairs are city-centre geocodes,
// not trail positions (see CLAUDE.md) — a downtown pixel says nothing about a
// trail 10 km out. Same precedence as markerLatLng() in public/script.js: the
// lot flagged `primary`, else the first, else the trail-level parking pin, else
// lat/lng. It is restated here because script.js is browser-only.
export function rainPoint(trail) {
  if (Array.isArray(trail.parking)) {
    const lots = trail.parking.filter((p) => typeof p.lat === "number" && typeof p.lng === "number");
    const pin = lots.find((p) => p.primary) || lots[0];
    if (pin) return { lat: pin.lat, lng: pin.lng };
  }
  if (typeof trail.parkingLat === "number" && typeof trail.parkingLng === "number") {
    return { lat: trail.parkingLat, lng: trail.parkingLng };
  }
  if (typeof trail.lat === "number" && typeof trail.lng === "number") {
    return { lat: trail.lat, lng: trail.lng };
  }
  return null;
}

// Trails that share an exact point (the skill parks share their parent's lot)
// are sampled once and fanned back out. Order is request order: the response's
// locationId is an index into it.
export function groupByPoint(trails = TRAILS) {
  const groups = [];
  const index = new Map();
  for (const trail of trails) {
    const p = rainPoint(trail);
    if (!p) continue;
    const id = `${p.lat},${p.lng}`;
    let group = index.get(id);
    if (!group) {
      group = { lat: p.lat, lng: p.lng, keys: [] };
      index.set(id, group);
      groups.push(group);
    }
    group.keys.push(trail.key);
  }
  return groups;
}

export function samplesRequestBody(groups, layer = MRMS_LAYER) {
  return new URLSearchParams({
    geometry: JSON.stringify({
      points: groups.map((g) => [g.lng, g.lat]),
      spatialReference: { wkid: 4326 }
    }),
    geometryType: "esriGeometryMultipoint",
    // Without this the service mosaics whichever layer it likes — 24H, 72H, or
    // Alaska — and the numbers look entirely plausible.
    mosaicRule: JSON.stringify({ mosaicMethod: "esriMosaicAttribute", where: `name='${layer}'` }),
    returnFirstValueOnly: "true",
    outFields: "name,idp_validendtime",
    f: "json"
  });
}

// A pixel value is MILLIMETRES, whatever the service's legend says: it labels
// its classes in inches, but Big Cedar's 24-hour value on 2026-09-30 was 4.7
// alongside gauges reading 0.08–0.35 in. 4.7 in would have been a flood.
export function mmToIn(value) {
  const mm = Number(value);
  if (value === null || value === undefined || value === "" || !Number.isFinite(mm) || mm < 0) return null;
  return Math.round((mm / MM_PER_IN) * 10000) / 10000;
}

/**
 * Turn a getSamples response into rows of [trail_key, hour_ts, rain_in, "mrms"].
 *
 * A point outside radar coverage is simply ABSENT from `samples`, not zero, so
 * every requested group gets a row and a missing sample becomes NULL — the same
 * "absence of an observation is not an observation of absence" rule as
 * shapeArchiveResponse(). The hour comes from the raster's own validend, never
 * from the clock: the layer lags the hour by a few minutes, and stamping it with
 * "now" would file the previous hour's rain under the wrong hour.
 */
export function shapeSamples(payload, groups) {
  if (payload?.error) {
    throw new Error(`MRMS getSamples error ${payload.error.code}: ${payload.error.message}`);
  }
  const samples = payload?.samples;
  if (!Array.isArray(samples) || samples.length === 0) {
    throw new Error("MRMS getSamples returned no samples");
  }

  const ends = new Set(samples.map((s) => s.attributes?.idp_validendtime).filter((v) => v != null));
  if (ends.size !== 1) throw new Error(`MRMS samples span ${ends.size} rasters; expected exactly one`);
  const endMs = Number([...ends][0]);
  if (!Number.isFinite(endMs) || endMs % (HOUR * 1000) !== 0) {
    throw new Error(`MRMS validend ${endMs} is not the top of an hour`);
  }
  const hourTs = endMs / 1000;

  const byLocation = new Map(samples.map((s) => [s.locationId, s.value]));
  const rows = [];
  groups.forEach((g, i) => {
    const rain = byLocation.has(i) ? mmToIn(byLocation.get(i)) : null;
    for (const key of g.keys) rows.push([key, hourTs, rain, "mrms"]);
  });
  return { hourTs, rows };
}

// One Open-Meteo request for every point, NBM only, in inches, with the two
// days of past hours a fill can draw on. Same points as the MRMS request, so a
// filled hour is measured where a radar hour would have been.
export function nbmRequestUrl(groups) {
  const params = new URLSearchParams({
    latitude: groups.map((g) => g.lat).join(","),
    longitude: groups.map((g) => g.lng).join(","),
    hourly: "precipitation",
    models: NBM_MODEL,
    precipitation_unit: "inch",
    timeformat: "unixtime",
    past_days: "2",
    forecast_days: "1"
  });
  return `${NBM_URL}?${params}`;
}

/**
 * Rows of [trail_key, hour_ts, rain_in, "nbm"] for exactly the requested hours.
 * Open-Meteo's `precipitation` at time T is the sum of the hour ENDING at T —
 * the same convention as MRMS's validend, so the two share hour_ts directly. An
 * hour the response lacks, or holds as null, is written as NULL: we did look.
 */
export function shapeNbm(payload, groups, hours) {
  const entries = Array.isArray(payload) ? payload : [payload];
  if (entries.length !== groups.length) {
    throw new Error(`Open-Meteo NBM returned ${entries.length} locations for ${groups.length} requested`);
  }
  const rows = [];
  entries.forEach((entry, i) => {
    const times = entry?.hourly?.time;
    const values = entry?.hourly?.precipitation;
    if (!Array.isArray(times) || !Array.isArray(values)) {
      throw new Error(`Open-Meteo NBM returned no hourly block for location ${i}`);
    }
    const at = new Map(times.map((t, k) => [t, values[k]]));
    for (const h of hours) {
      const v = at.get(h);
      const rain = typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
      for (const key of groups[i].keys) rows.push([key, h, rain, "nbm"]);
    }
  });
  return rows;
}

/**
 * Which hours to fill from NBM: every hour in the look-back that MRMS can no
 * longer supply and that we do not already hold.
 *
 * MRMS serves the hour ending at T from a few minutes after T until the next
 * hour's layer replaces it, a few minutes after T+1h. So once the clock reaches
 * T+2h, hour T is certainly gone; and once we have written MRMS hour H, every
 * earlier hour is gone too. Never fill before the archive's first hour — a fill
 * repairs a gap, it does not backfill history.
 */
export function hoursToFill({ have, firstEver, topOfHour, mrmsHour = null }) {
  if (firstEver === null) return [];
  const lostUpTo = Math.max(topOfHour - 2 * HOUR, mrmsHour === null ? -Infinity : mrmsHour - HOUR);
  const from = Math.max(firstEver + HOUR, topOfHour - FILL_LOOKBACK_H * HOUR);
  const hours = [];
  for (let h = from; h <= lostUpTo; h += HOUR) if (!have.has(h)) hours.push(h);
  return hours;
}

export async function writeRainRows(db, rows) {
  const statements = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
    const chunk = rows.slice(i, i + ROWS_PER_STATEMENT);
    const placeholders = chunk.map(() => `(${COLUMNS.map(() => "?").join(",")})`).join(",");
    statements.push(
      db.prepare(`INSERT OR REPLACE INTO rain_hourly (${COLUMNS.join(",")}) VALUES ${placeholders}`)
        .bind(...chunk.flat())
    );
  }
  // One batch, one implicit transaction: an hour lands for every trail or none.
  if (statements.length) await db.batch(statements);
  return rows.length;
}

/**
 * Record the newest MRMS hour, and fill from NBM any hour MRMS was missed.
 *
 * The cron fires every 5 minutes. The layer for the hour ending at HH:00 appears
 * a few minutes later, so the first tick or two of each hour find the previous
 * hour still current and write nothing; once the current top of hour is stored,
 * the rest of the hour's ticks skip without a fetch. Normally that is 2-3 small
 * requests an hour and one 58-row write; NBM is only fetched when there is a gap.
 *
 * Every hour is written for all trails in one batch, so ONE trail's rows tell us
 * which hours exist — and reading them by primary key costs ~48 row reads, where
 * MAX(hour_ts) over the whole table would scan every row every tick.
 */
export async function recordRainHour(env, now = new Date(), fetchImpl = fetch) {
  if (!env.TRAIL_HISTORY) return { skipped: "missing binding" };
  const db = env.TRAIL_HISTORY;
  const topOfHour = Math.floor(now.getTime() / 1000 / HOUR) * HOUR;
  const groups = groupByPoint(TRAILS);
  const probe = groups[0].keys[0];

  const recent = await db
    .prepare("SELECT hour_ts FROM rain_hourly WHERE trail_key = ? AND hour_ts >= ?")
    .bind(probe, topOfHour - (FILL_LOOKBACK_H + 2) * HOUR)
    .all();
  const have = new Set((recent?.results || []).map((r) => r.hour_ts));
  if (have.has(topOfHour)) return { skipped: "hour already recorded", hourTs: topOfHour };
  const firstEver = (await db
    .prepare("SELECT MIN(hour_ts) AS h FROM rain_hourly WHERE trail_key = ?")
    .bind(probe)
    .first())?.h ?? null;

  // 1. MRMS. A failure here is not the end of the tick: the fill below may
  // still have work, and is exactly what covers for MRMS being down.
  let mrms = null, mrmsError = null;
  try {
    const response = await fetchImpl(MRMS_SAMPLES_URL, { method: "POST", body: samplesRequestBody(groups) });
    if (!response.ok) throw new Error(`MRMS getSamples returned ${response.status}`);
    const shaped = shapeSamples(await response.json(), groups);
    // Refuse a raster from the future — a clock or service fault, not rain.
    if (shaped.hourTs > topOfHour) {
      throw new Error(`MRMS validend ${shaped.hourTs} is after the current hour ${topOfHour}`);
    }
    if (!have.has(shaped.hourTs)) mrms = shaped;
  } catch (error) {
    mrmsError = error;
  }

  // 2. NBM, for hours MRMS can no longer supply.
  const fill = hoursToFill({ have, firstEver: firstEver ?? mrms?.hourTs ?? null, topOfHour, mrmsHour: mrms?.hourTs ?? null });
  let nbmRows = [], nbmError = null;
  if (fill.length) {
    try {
      const response = await fetchImpl(nbmRequestUrl(groups));
      if (!response.ok) throw new Error(`Open-Meteo NBM returned ${response.status}`);
      nbmRows = shapeNbm(await response.json(), groups, fill);
    } catch (error) {
      // Not fatal: the gap stays visible and the next hour's first tick retries
      // it, for as long as it is inside the look-back.
      nbmError = error;
      console.error(`rain archive: NBM fill of ${fill.length} hour(s) failed: ${error.message}`);
    }
  }

  const rows = [...nbmRows, ...(mrms?.rows || [])];
  if (rows.length === 0) {
    if (mrmsError) throw mrmsError;
    return { skipped: "no new hour published yet", hourTs: topOfHour };
  }
  const written = await writeRainRows(db, rows);
  if (mrmsError) console.error(`rain archive: MRMS failed: ${mrmsError.message}`);
  if (nbmRows.length) console.warn(`rain archive: filled ${fill.length} missed MRMS hour(s) from NBM`);
  return {
    hourTs: mrms?.hourTs ?? null,
    written,
    filled: nbmRows.length ? fill.length : 0,
    unfilled: nbmError ? fill.length : 0
  };
}
