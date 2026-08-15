import { sourcesForBatch } from "../public/trails.js";

const ACCOUNT_ID = "671443894874b1e4965be5de8232dd92";
const KV_NAMESPACE_ID = "84a3ba80c5fd4563b0bdb87f852a1993";
const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;


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

async function kvGet(key) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${KV_NAMESPACE_ID}/values/${key}`,
    { headers: { Authorization: `Bearer ${API_TOKEN}` } }
  );
  if (!res.ok) return null;
  try { return JSON.parse(await res.text()); } catch { return null; }
}

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

async function refreshBatch(sources, cacheKey) {
  const old = await kvGet(cacheKey);
  const oldStatuses = old?.statuses || {};
  const results = [];
  for (const source of sources) {
    const result = await fetchStatus(source);
    if (!result.city && oldStatuses[source.key]?.city) result.city = oldStatuses[source.key].city;
    if (!result.lta && oldStatuses[source.key]?.lta) result.lta = oldStatuses[source.key].lta;
    results.push(result);
    console.log(`  ${source.key}: ${result.status}${result.detail ? ` (${result.detail})` : ""}`);
  }
  const data = {
    updatedAt: new Date().toISOString(),
    statuses: Object.fromEntries(results.map((r) => [r.key, r]))
  };
  await kvPut(cacheKey, data);
}

async function fetchStatus(source) {
  try {
    const response = await fetchWithRetry(source.url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const html = await response.text();
    const parsed = source.type === "trail" ? parseTrailStatus(html) : parseRegionStatus(html);
    const city = parseCity(html);
    const lta = parseLTA(html);
    return { ...source, ...parsed, ...(city ? { city } : {}), ...(lta ? { lta } : {}) };
  } catch (error) {
    return { ...source, status: "Unavailable", detail: error.message, updated: "" };
  }
}

async function fetchWithRetry(url) {
  let response = await fetch(url, { headers: fetchHeaders });
  if (response.status === 403 || response.status >= 500) {
    await delay(250);
    response = await fetch(url, { headers: fetchHeaders });
  }
  return response;
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseRegionStatus(html) {
  const text = toText(html);
  const match = text.match(/Region Status\s+([A-Za-z]+)(?:\s+as of\s+([^#]+?))?\s+Local Trail Association/i);
  if (match) return { status: normalizeStatus(match[1]), updated: clean(match[2] || ""), detail: "Region Status" };
  const dateMatch = text.match(/Region Status\s+([A-Za-z]+)\s+as of\s+([A-Za-z]+\.?\s+\d+,?\s*\d{4})/i);
  if (dateMatch) return { status: normalizeStatus(dateMatch[1]), updated: clean(dateMatch[2]), detail: "Region Status" };
  const lenientMatch = text.match(/Region Status\s+([A-Za-z]+)(?:\s+as of\s+([^#]+?))?\s+(?:Donate|Trail Reports|Nearby|Stats|Follow|Subscribe|Weather|Photos|About|Recent)/i);
  if (lenientMatch) return { status: normalizeStatus(lenientMatch[1]), updated: clean(lenientMatch[2] || ""), detail: "Region Status" };
  const reportMatch = text.match(/Recent Trail Reports\s+status trail date condition info user\s+.+?\s+(Open|Closed)\.?\s*([^A-Z#]*)/i);
  if (reportMatch) return { status: normalizeStatus(reportMatch[1]), updated: "", detail: clean(reportMatch[2] || "Recent trail report fallback") };
  const simpleMatch = text.match(/Region Status\s+(Open|Closed|Caution|Wet|Dry|Ideal|Variable|Prevalent Mud)/i);
  if (simpleMatch) return { status: normalizeStatus(simpleMatch[1]), updated: "", detail: "Region Status" };
  return { status: "Unknown", updated: "", detail: "Status not found" };
}

function parseTrailStatus(html) {
  const text = toText(html);
  const match = text.match(/Status:\s+on\s+([^#]+?)\s+(Ideal|Dry|Very Dry|Wet|Variable|Prevalent Mud|Closed|Open|Unknown)\s+/i);
  if (match) return { status: normalizeStatus(match[2]), updated: cleanUpdated(match[1]), detail: "Trail status" };
  const reportMatch = text.match(/Trail Reports\s+status date description\s+[^#]+?\s+(Open|Closed)\.?\s*([^#]*)/i);
  if (reportMatch) return { status: normalizeStatus(reportMatch[1]), updated: "", detail: clean(reportMatch[2] || "Trail report fallback") };
  return { status: "Unknown", updated: "", detail: "Status not found" };
}

function parseLTA(html) {
  const text = toText(html);
  const match = text.match(/Local Trail Association\s+(.*?)\s+(?:Please|Donate|Donations|Trail Reports|Trail Conditions|Nearby Regions|Nearby|Latest Conditions|Conditions|Sponsor|Weather|Photos|Stats|Follow|Subscribe|Maps|About|Recent|Check|Contact|Events|Volunteer|Region Status)/i);
  if (!match) return "";
  let lta = match[1].replace(/\s*\([^)]*\)\s*/g, " ").trim();
  if (/^(Donate|Trail|Nearby|Latest|Sponsor|Weather|Photos|Stats|Follow|Subscribe|Maps|About|Recent|Trail Karma|Check|Conditions|Contact|Events|Volunteer)/i.test(lta)) return "";
  return lta.slice(0, 55);
}

const BROAD_REGION_TERMS = /^(Texas|North Texas|Central Texas|South Texas|East Texas|West Texas|United States|USA|North America|DFW|Metroplex)$/i;

function parseCity(html) {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const commaMatch = titleMatch[1].match(/,\s*([^,|]+?)\s+Mountain Biking/i);
    if (commaMatch) {
      const city = clean(commaMatch[1]);
      if (!BROAD_REGION_TERMS.test(city)) return city;
    }
    const inMatch = titleMatch[1].match(/Mountain Biking\s+in\s+([^,|<]+)/i);
    if (inMatch) {
      const city = clean(inMatch[1]);
      if (!BROAD_REGION_TERMS.test(city)) return city;
    }
  }
  const jsonLdBlocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1]);
      const city = data?.address?.addressLocality || data?.containedInPlace?.name || data?.location?.address?.addressLocality;
      if (city && !BROAD_REGION_TERMS.test(clean(city))) return clean(city);
    } catch (e) {}
  }
  const lists = [...html.matchAll(/<[ou]l[^>]*>([\s\S]*?)<\/[ou]l>/gi)];
  for (const list of lists) {
    const items = [...list[1].matchAll(/href="\/region\/([^"]+)"[^>]*>\s*([^<]{2,50}?)\s*</gi)];
    if (items.length >= 3) {
      const city = clean(items[items.length - 2][2]);
      if (!BROAD_REGION_TERMS.test(city) && city.length >= 2) return city;
    }
  }
  const metaMatch = html.match(/content="([^"]*Mountain Biking[^"]*)"[^>]*(?:name="description"|property="og:description")/i) ||
                    html.match(/(?:name="description"|property="og:description")[^>]*content="([^"]*Mountain Biking[^"]*)"/i);
  if (metaMatch) {
    const m = metaMatch[1].match(/(?:biking|trails?)\s+in\s+([A-Z][a-zA-Z\s]+?),?\s+Texas/i);
    if (m && !BROAD_REGION_TERMS.test(clean(m[1]))) return clean(m[1]);
  }
  return "";
}

function toText(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeStatus(value) {
  return clean(value).replace(/\b\w/g, (l) => l.toUpperCase());
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

// Reduce a scraped "updated" capture to just a date. The status regexes bridge
// the gap between a trail's date and its status word with a non-greedy match,
// which on some Trailforks pages swallows menu/page text; keep only the date so
// junk never reaches the cache or the UI.
function cleanUpdated(value) {
  const s = clean(value);
  if (!s) return "";
  const date = s.match(/[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}/);
  if (date) return date[0];
  const relative = s.match(/^\d+\s+(?:minute|hour|day|week|month|year)s?(?:\s+ago)?/i);
  if (relative) return relative[0];
  return s.length <= 24 ? s : "";
}

(async () => {
  if (!API_TOKEN) { console.error("CLOUDFLARE_API_TOKEN not set"); process.exit(1); }
  const batch = process.argv[2]; // "1", "2", or undefined = both
  if (batch !== "2") {
    console.log("Refreshing batch 1...");
    await refreshBatch(sourcesForBatch(1), "trail_statuses_1");
  }
  if (batch !== "1") {
    console.log("Refreshing batch 2...");
    await refreshBatch(sourcesForBatch(2), "trail_statuses_2");
  }
  console.log("Done.");
})();
