// Verifies forecast-cache.js — the Worker cron's hourly write of KV "trail_weather".
//
// No jsdom, no network, no real KV: a fake KV and a fake fetch. The directions
// that matter are the negative ones — a failed fetch must never write, and a
// block from this hour must not be re-fetched on every 5-minute tick.
// Exits NON-ZERO on failure.
import { forecastIsDue, recordForecast, WEATHER_KEY } from "../forecast-cache.js";
import { TRAILS } from "../public/trails.js";
import { groupByLocation } from "../public/weather.js";

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

const T = (iso) => Date.parse(iso);

console.log("=== forecastIsDue: once per clock hour ===");
check("nothing stored → due", forecastIsDue(undefined, T("2026-11-24T10:02:00Z")), true);
check("garbage stored → due", forecastIsDue("not a date", T("2026-11-24T10:02:00Z")), true);
check("written 10:00, now 10:55 → not due", forecastIsDue("2026-11-24T10:00:30Z", T("2026-11-24T10:55:00Z")), false);
check("written 10:55, now 11:00 → due", forecastIsDue("2026-11-24T10:55:00Z", T("2026-11-24T11:00:10Z")), true);
check("written 3 h ago → due", forecastIsDue("2026-11-24T07:10:00Z", T("2026-11-24T10:05:00Z")), true);

const fakeKv = (stored) => {
  const puts = [];
  return {
    puts,
    async get(key) { return key === WEATHER_KEY ? stored : null; },
    async put(key, value) { puts.push({ key, value }); }
  };
};

// A well-formed Open-Meteo multi-location answer for every grouped trailhead.
const groups = groupByLocation(TRAILS);
const okFetch = async () => new Response(JSON.stringify(groups.map(() => ({
  hourly: { time: [1], precipitation_probability: [10], precipitation: [0], temperature_2m: [60] }
}))));

console.log("\n=== recordForecast ===");
{
  const kv = fakeKv({ updatedAt: "2026-11-24T10:00:30Z" });
  const r = await recordForecast({ TRAIL_CACHE: kv }, T("2026-11-24T10:30:00Z"), okFetch);
  check("fresh block: skipped", r.written, false);
  check("fresh block: no KV write", kv.puts.length, 0);
}
{
  let called = 0;
  const kv = fakeKv({ updatedAt: "2026-11-24T10:00:30Z" });
  await recordForecast({ TRAIL_CACHE: kv }, T("2026-11-24T10:30:00Z"), async () => { called++; return okFetch(); });
  check("fresh block: Open-Meteo not even called", called, 0);
}
{
  const kv = fakeKv({ updatedAt: "2026-11-24T09:00:30Z" });
  const r = await recordForecast({ TRAIL_CACHE: kv }, T("2026-11-24T10:00:10Z"), okFetch);
  check("stale block: written", r.written, true);
  check("stale block: one put, to trail_weather", kv.puts.map((p) => p.key), [WEATHER_KEY]);
  check("stale block: every trailhead present", Object.keys(JSON.parse(kv.puts[0].value).weather).length, TRAILS.length);
}
{
  const kv = fakeKv(null);
  const r = await recordForecast({ TRAIL_CACHE: kv }, T("2026-11-24T10:00:10Z"), okFetch);
  check("empty KV: written", r.written, true);
}
for (const [label, f] of [
  ["503", async () => new Response("", { status: 503 })],
  ["network error", async () => { throw new TypeError("fetch failed"); }],
  ["wrong location count", async () => new Response("[]")]
]) {
  const kv = fakeKv({ updatedAt: "2026-11-24T09:00:30Z" });
  let threw = false;
  try { await recordForecast({ TRAIL_CACHE: kv }, T("2026-11-24T10:00:10Z"), f); } catch { threw = true; }
  check(`${label}: throws`, threw, true);
  check(`${label}: KV untouched`, kv.puts.length, 0);
}
{
  const r = await recordForecast({}, T("2026-11-24T10:00:10Z"), okFetch);
  check("no KV binding: quiet no-op", r.written, false);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) process.exit(1);
