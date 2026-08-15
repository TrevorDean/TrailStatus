import { allSources } from "./public/trails.js";

// Cold-start scrape list (used only when KV is empty). Canonical data lives in public/trails.js.
const sources = allSources();

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

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/status") {
      return handleStatus(env);
    }
    return env.ASSETS.fetch(request);
  }
};

async function handleStatus(env) {
  if (env.TRAIL_CACHE) {
    const [part1, part2] = await Promise.all([
      env.TRAIL_CACHE.get("trail_statuses_1", { type: "json" }),
      env.TRAIL_CACHE.get("trail_statuses_2", { type: "json" })
    ]);

    if (part1 || part2) {
      const statuses = { ...(part1?.statuses || {}), ...(part2?.statuses || {}) };
      for (const s of Object.values(statuses)) {
        if (s.lta && (s.lta.length > 55 || /please|consider/i.test(s.lta) || s.lta === "Dallas Off Road Bicycle Association")) s.lta = "";
      }
      const updatedAt = [part1?.updatedAt, part2?.updatedAt].filter(Boolean).sort().pop();
      return Response.json({ updatedAt, statuses }, {
        headers: { "Cache-Control": "public, max-age=60" }
      });
    }
  }

  // Cold start — KV not yet populated, fetch directly
  const data = await fetchAllStatuses();
  return Response.json(data, {
    headers: { "Cache-Control": "public, max-age=60" }
  });
}

async function fetchAllStatuses() {
  const results = [];
  for (const source of sources) {
    results.push(await fetchStatus(source));
  }
  return {
    updatedAt: new Date().toISOString(),
    statuses: Object.fromEntries(results.map((r) => [r.key, r]))
  };
}

async function fetchStatus(source) {
  try {
    const response = await fetchWithRetry(source.url);
    if (!response.ok) {
      throw new Error(`Trailforks returned ${response.status}`);
    }

    const html = await response.text();
    const parsed = source.type === "trail" ? parseTrailStatus(html) : parseRegionStatus(html);
    const city = parseCity(html);
    const lta = parseLTA(html);

    return {
      ...source,
      ...parsed,
      ...(city ? { city } : {}),
      ...(lta ? { lta } : {})
    };
  } catch (error) {
    return {
      ...source,
      status: "Unavailable",
      detail: error.message,
      updated: ""
    };
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
  if (match) {
    return { status: normalizeStatus(match[2]), updated: cleanUpdated(match[1]), detail: "Trail status" };
  }

  const reportMatch = text.match(/Trail Reports\s+status date description\s+[^#]+?\s+(Open|Closed)\.?\s*([^#]*)/i);
  if (reportMatch) {
    return { status: normalizeStatus(reportMatch[1]), updated: "", detail: clean(reportMatch[2] || "Trail report fallback") };
  }

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

// Reduce a scraped "updated" capture to just a date, so page/menu text swallowed
// by the non-greedy status regex never reaches the response or the UI.
function cleanUpdated(value) {
  const s = clean(value);
  if (!s) return "";
  const date = s.match(/[A-Za-z]{3,9}\.?\s+\d{1,2},?\s+\d{4}/);
  if (date) return date[0];
  const relative = s.match(/^\d+\s+(?:minute|hour|day|week|month|year)s?(?:\s+ago)?/i);
  if (relative) return relative[0];
  return s.length <= 24 ? s : "";
}
