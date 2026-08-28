// Hourly weather cron — fetches an 8-hour (12 fetched) chance-of-rain forecast
// for every trailhead and writes it to the KV key "trail_weather".
//
// Sibling of update-trail-status.js, and deliberately the same shape: same
// account/namespace constants, same kvPut over the Cloudflare REST API, same
// CLOUDFLARE_API_TOKEN. Unlike that script this one needs no batching (one
// Open-Meteo request covers all 58 trailheads) and no HTML parsing — the
// request/response handling lives in ../public/weather.js, shared with worker.js.
//
//   node scripts/update-weather.js             # fetch + write KV (needs the token)
//   node scripts/update-weather.js --dry-run   # fetch + print, no token, no write

import { TRAILS } from "../public/trails.js";
import { fetchWeather, DISPLAY_HOURS } from "../public/weather.js";

const ACCOUNT_ID = "671443894874b1e4965be5de8232dd92";
const KV_NAMESPACE_ID = "84a3ba80c5fd4563b0bdb87f852a1993";
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

async function kvPut(key, value) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${key}`,
    {
      method: "PUT",
      headers: { Authorization: `Bearer ${API_TOKEN}`, "Content-Type": "text/plain" },
      body: JSON.stringify(value)
    }
  );
  if (!res.ok) throw new Error(`KV put failed for ${key}: ${await res.text()}`);
}

(async () => {
  const dryRun = process.argv.includes("--dry-run");
  if (!dryRun && !API_TOKEN) {
    console.error("CLOUDFLARE_API_TOKEN not set");
    process.exit(1);
  }

  let data;
  try {
    data = await fetchWeather(TRAILS);
  } catch (error) {
    // Never write a partial or empty forecast: a failed run leaves the previous
    // good value in KV, and the frontend degrades to "—" only once it ages out.
    console.error(`Weather fetch failed, leaving KV untouched: ${error.message}`);
    process.exit(1);
  }

  const keys = Object.keys(data.weather);
  const peaks = keys.map((k) => Math.max(...data.weather[k].pop.slice(0, DISPLAY_HOURS)));
  console.log(`${keys.length} trailheads, ${data.times.length} hours from ${new Date(data.times[0] * 1000).toISOString()}`);
  console.log(`Peak chance of rain over the next ${DISPLAY_HOURS}h: ${Math.min(...peaks)}%–${Math.max(...peaks)}%`);

  if (dryRun) {
    console.log(JSON.stringify(data, null, 2));
    return;
  }

  await kvPut("trail_weather", data);
  console.log("Wrote trail_weather.");
})();
