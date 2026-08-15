// Maintenance utility (run via the "Extract Parking Links" workflow_dispatch —
// Trailforks blocks non-GitHub-Actions IPs). Fetches each trail's Trailforks
// page and extracts the Google Maps parking link(s) it embeds
// (maps.google.com/maps?q=LAT,+LNG). Prints a JSON array between markers so the
// results can be lifted out of the Actions log and spliced into public/trails.js.
import { TRAILS } from "../public/trails.js";

const fetchHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
  "Cache-Control": "no-cache",
  "Pragma": "no-cache",
  "Upgrade-Insecure-Requests": "1",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1"
};

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Grab ~140 chars of preceding text so we can tell "main parking" from other pins.
const PARKING_RE = /(.{0,140}?)maps\.google\.com\/maps\?q=(-?\d{1,3}(?:\.\d+)?),\s*\+?\s*(-?\d{1,3}(?:\.\d+)?)/gi;

function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function extractParking(html) {
  const seen = new Set();
  const out = [];
  for (const m of html.matchAll(PARKING_RE)) {
    const lat = parseFloat(m[2]);
    const lng = parseFloat(m[3]);
    const dedupeKey = `${lat},${lng}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ lat, lng, context: stripTags(m[1]).slice(-80) });
  }
  return out;
}

async function fetchOnce(url) {
  let res = await fetch(url, { headers: fetchHeaders });
  if (res.status === 403 || res.status >= 500) {
    await delay(400);
    res = await fetch(url, { headers: fetchHeaders });
  }
  return res;
}

const results = [];
for (const t of TRAILS) {
  const url = t.scrapeUrl || t.url;
  try {
    const res = await fetchOnce(url);
    const html = await res.text();
    const parking = res.ok ? extractParking(html) : [];
    results.push({ key: t.key, status: res.status, url, parking });
    console.error(`${t.key}: HTTP ${res.status} — ${parking.length} parking link(s)`);
  } catch (error) {
    results.push({ key: t.key, status: 0, url, parking: [], error: String(error) });
    console.error(`${t.key}: ERROR ${error}`);
  }
  await delay(400);
}

console.log("===PARKING_JSON_START===");
console.log(JSON.stringify(results));
console.log("===PARKING_JSON_END===");
