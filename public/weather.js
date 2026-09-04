// Shared Open-Meteo forecast client — the ONE place the request is built and the
// response is shaped. Imported by BOTH sides so they cannot drift:
//   scripts/update-weather.js  (the hourly cron, writes KV key "trail_weather")
//   worker.js                  (cold-start fallback when that key is empty)
//
// Open-Meteo needs no API key and takes every trailhead in a single request, so
// there is no batching here the way there is for the Trailforks scrape.

import { TRAILS } from "./trails.js";

const ENDPOINT = "https://api.open-meteo.com/v1/forecast";

// Fetched vs displayed. The cron writes hourly but the page is read
// continuously, so the frontend slices "the next 8 hours from now" out of this
// block itself and the surplus is pure staleness margin.
//
// It was 12 (a 4-hour margin, sized for an hourly cron). That was too tight in
// practice: GitHub throttles `schedule:` to roughly hourly AT BEST and DROPS
// delayed runs rather than queueing them — the weather cron fired once in 20
// hours on 2026-08-28, the block aged past its own window, and the UI quietly
// shrank to 4 bars. 24 gives a full day of margin, so a cron that stops
// overnight costs nothing visible. See also the staleness check below, which
// catches the case where even this runs out.
export const FORECAST_HOURS = 24;
export const DISPLAY_HOURS = 8;

// ~1.1 km, finer than the forecast model's own resolution. Several trailheads
// sit on one location (the skill parks share their parent region's coordinates),
// and collapsing them shrinks the request without changing a single output value.
function coordKey(trail) {
  return `${trail.lat.toFixed(2)},${trail.lng.toFixed(2)}`;
}

// Group trails by rounded location, preserving first-seen order — that order is
// the request order, and Open-Meteo returns its array in exactly the same one.
export function groupByLocation(trails = TRAILS) {
  const groups = [];
  const index = new Map();
  for (const trail of trails) {
    if (typeof trail.lat !== "number" || typeof trail.lng !== "number") continue;
    const id = coordKey(trail);
    let group = index.get(id);
    if (!group) {
      group = { lat: Number(trail.lat.toFixed(2)), lng: Number(trail.lng.toFixed(2)), keys: [] };
      index.set(id, group);
      groups.push(group);
    }
    group.keys.push(trail.key);
  }
  return groups;
}

export function weatherRequestUrl(groups) {
  const params = new URLSearchParams({
    latitude: groups.map((g) => g.lat).join(","),
    longitude: groups.map((g) => g.lng).join(","),
    hourly: "precipitation_probability,precipitation,temperature_2m",
    temperature_unit: "fahrenheit",
    precipitation_unit: "inch",
    timezone: "America/Chicago",
    timeformat: "unixtime",
    forecast_hours: String(FORECAST_HOURS)
  });
  return `${ENDPOINT}?${params}`;
}

// A multi-location call returns a JSON ARRAY, one entry per coordinate, in
// request order — not the bare object a single-location call returns. Both
// shapes are accepted here so a one-trail request can't blow up.
export function shapeWeatherResponse(payload, groups) {
  const entries = Array.isArray(payload) ? payload : [payload];
  if (entries.length !== groups.length) {
    throw new Error(`Open-Meteo returned ${entries.length} locations for ${groups.length} requested`);
  }

  // Every location comes from one request, so their hour arrays are identical;
  // one shared `times` beats 58 copies of the same 12 numbers.
  let times = null;
  const weather = {};

  entries.forEach((entry, i) => {
    const hourly = entry?.hourly;
    if (!hourly?.time?.length) throw new Error(`Open-Meteo returned no hourly block for location ${i}`);
    if (!times) times = hourly.time.map(Number);

    const value = {
      pop: (hourly.precipitation_probability || []).map((n) => (n == null ? 0 : Math.round(n))),
      precip: (hourly.precipitation || []).map((n) => (n == null ? 0 : Number(n))),
      temp: (hourly.temperature_2m || []).map((n) => (n == null ? null : Math.round(n)))
    };
    // Every trail that rounded to this location gets the same forecast.
    for (const key of groups[i].keys) weather[key] = value;
  });

  return { updatedAt: new Date().toISOString(), times, weather };
}

// How many of a cached block's hours are still ahead of the clock. The number
// of bars the UI can draw is exactly this, capped at DISPLAY_HOURS — which is
// why the Worker treats a block that has fallen below DISPLAY_HOURS as no better
// than an empty one.
export function futureHourCount(times, now = Date.now()) {
  if (!times?.length) return 0;
  const currentHour = Math.floor(now / 3600000) * 3600;
  return times.filter((t) => t >= currentHour).length;
}

export async function fetchWeather(trails = TRAILS, fetchImpl = fetch) {
  const groups = groupByLocation(trails);
  const response = await fetchImpl(weatherRequestUrl(groups));
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  return shapeWeatherResponse(await response.json(), groups);
}

// ---------------------------------------------------------------------------
// Archive side — the variable set the reopening model is built on.
//
// Everything above serves the RIDER: chance of rain for the next 8 hours. What
// follows serves the ARCHIVE, and the two want different columns. Rain and
// temperature alone barely explain drying; the physically right quantity is a
// water balance (rain in, evapotranspiration out), and Open-Meteo will compute
// both for free from the same endpoint:
//
//   et0_fao_evapotranspiration  FAO Penman-Monteith — folds temperature,
//                               humidity, wind and solar radiation into ONE
//                               drying number, which is why temperature on its
//                               own is not in the feature list.
//   soil_moisture_*             the model's own estimate of how wet the dirt is,
//                               which is very nearly the quantity a trail
//                               steward is judging when they walk the trail.
//
// UNITS ARE NOT PER-VARIABLE, and this bites twice. `precipitation_unit` governs
// ET0 as well as rainfall, and `temperature_unit` governs soil temperature as
// well as air temperature — so with the settings below, ET0 comes back in INCHES
// (~0.19 in/day here, which reads like a broken number until you realise it is
// 4.75 mm/day) and soil temperature in FAHRENHEIT. Keeping ET0 in inches is
// deliberate: rainfall and ET0 in one unit makes the water balance a plain
// subtraction. Change either unit and you silently rescale a stored column.
//
// It shares groupByLocation() and ENDPOINT with the display path on purpose:
// one request builder, one rounding rule, no chance of the archive and the UI
// disagreeing about where a trailhead is.

// Order matters — it is the column order of an ARCHIVE_ROW and of the INSERT in
// migrations/0002_weather_history.sql. Add to the end, never the middle.
export const ARCHIVE_VARS = [
  "precipitation",
  "temperature_2m",
  "et0_fao_evapotranspiration",
  "relative_humidity_2m",
  "wind_speed_10m",
  "shortwave_radiation",
  "soil_moisture_0_to_1cm",
  "soil_moisture_1_to_3cm",
  "soil_moisture_3_to_9cm",
  "soil_temperature_0cm"
];

// past_days is capped at 92 by Open-Meteo. Asking for more is not an error — it
// silently returns 92 — so the ceiling is asserted here rather than discovered
// as a short backfill months later.
export const MAX_PAST_DAYS = 92;

export function archiveRequestUrl(groups, { pastDays = 0, forecastDays = 1 } = {}) {
  if (pastDays > MAX_PAST_DAYS) {
    throw new Error(`past_days ${pastDays} exceeds Open-Meteo's ${MAX_PAST_DAYS}-day limit`);
  }
  const params = new URLSearchParams({
    latitude: groups.map((g) => g.lat).join(","),
    longitude: groups.map((g) => g.lng).join(","),
    hourly: ARCHIVE_VARS.join(","),
    temperature_unit: "fahrenheit",
    precipitation_unit: "inch",
    timezone: "America/Chicago",
    timeformat: "unixtime",
    past_days: String(pastDays),
    forecast_days: String(forecastDays)
  });
  return `${ENDPOINT}?${params}`;
}

// Flattens to one row per trail per hour: [trail_key, hour_ts, ...ARCHIVE_VARS].
// Rows, not nested objects, because the only consumer is a D1 INSERT and the
// shape should not have to be un-nested on the way in.
export function shapeArchiveResponse(payload, groups) {
  const entries = Array.isArray(payload) ? payload : [payload];
  if (entries.length !== groups.length) {
    throw new Error(`Open-Meteo returned ${entries.length} locations for ${groups.length} requested`);
  }

  const rows = [];
  entries.forEach((entry, i) => {
    const hourly = entry?.hourly;
    if (!hourly?.time?.length) throw new Error(`Open-Meteo returned no hourly block for location ${i}`);

    hourly.time.forEach((t, h) => {
      // A null is "the model did not produce a value here", which is not zero.
      // Storing it as NULL keeps a gap in the record distinguishable from a dry
      // hour — the same reason history.js refuses to record "Unavailable".
      const values = ARCHIVE_VARS.map((v) => {
        const n = hourly[v]?.[h];
        return n == null ? null : Number(n);
      });
      for (const key of groups[i].keys) rows.push([key, Number(t), ...values]);
    });
  });
  return rows;
}

export async function fetchArchiveWeather(trails = TRAILS, options = {}, fetchImpl = fetch) {
  const groups = groupByLocation(trails);
  const response = await fetchImpl(archiveRequestUrl(groups, options));
  if (!response.ok) throw new Error(`Open-Meteo returned ${response.status}`);
  return shapeArchiveResponse(await response.json(), groups);
}

// The forward forecast, kept as one row per trail per snapshot.
//
// This is the ONLY thing here that cannot be recovered later. past_days returns
// the model's after-the-fact analysis, never the forecast that was actually on
// screen at the time, so without these a backtest of "what would we have
// predicted on Tuesday" is quietly scored with hindsight it never had.
export function shapeForecastSnapshot(payload, groups, snapshotTs) {
  const entries = Array.isArray(payload) ? payload : [payload];
  const rows = [];
  entries.forEach((entry, i) => {
    const hourly = entry?.hourly;
    if (!hourly?.time?.length) throw new Error(`Open-Meteo returned no hourly block for location ${i}`);
    const times = hourly.time.map(Number);
    const pick = (v) => JSON.stringify((hourly[v] || []).map((n) => (n == null ? null : Number(n))));
    for (const key of groups[i].keys) {
      rows.push([
        key,
        snapshotTs,
        times[0],
        JSON.stringify(times),
        pick("precipitation"),
        pick("temperature_2m"),
        pick("et0_fao_evapotranspiration")
      ]);
    }
  });
  return rows;
}
