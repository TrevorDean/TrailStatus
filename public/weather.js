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
