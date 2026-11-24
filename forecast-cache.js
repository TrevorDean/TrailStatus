// Keeps KV "trail_weather" — the Rain 8h forecast — fresh, from the Worker's own
// 5-minute cron. Moved here from a GitHub Actions workflow on 2026-11-24.
//
// That workflow (driven by a cron-job.org pinger, with GitHub `schedule:` as a
// backup) failed 50 of 400 runs on a single attempt, and still failed with
// retries when one runner could not connect to Open-Meteo at all for 90 s, while
// this Worker reached Open-Meteo every hour the same evening. Open-Meteo does
// not block Cloudflare (Trailforks does — this is NOT a precedent for moving the
// status scrape here).
//
// Written at most once per clock hour: the first tick of an hour whose stored
// block is from an earlier hour fetches and writes. A failed fetch writes
// nothing and the next tick, five minutes later, simply tries again — the retry
// comes free with the cadence. The last good forecast is never blanked.
import { fetchWeather } from "./public/weather.js";
import { TRAILS } from "./public/trails.js";

export const WEATHER_KEY = "trail_weather";
const HOUR_MS = 3600000;

// Pure: is a block written at `updatedAt` due for replacement at `now`?
export function forecastIsDue(updatedAt, now = Date.now()) {
  const written = Date.parse(updatedAt);
  if (!Number.isFinite(written)) return true; // missing or unreadable: write one
  return Math.floor(written / HOUR_MS) < Math.floor(now / HOUR_MS);
}

export async function recordForecast(env, now = Date.now(), fetchImpl = fetch) {
  const kv = env.TRAIL_CACHE;
  if (!kv) return { written: false, reason: "no KV binding" };

  const cached = await kv.get(WEATHER_KEY, { type: "json" });
  if (!forecastIsDue(cached?.updatedAt, now)) return { written: false, reason: "fresh" };

  const data = await fetchWeather(TRAILS, fetchImpl); // throws → nothing written
  await kv.put(WEATHER_KEY, JSON.stringify(data));
  return { written: true, trails: Object.keys(data.weather).length };
}
