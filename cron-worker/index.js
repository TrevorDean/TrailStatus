const SOURCES_1 = [
  { key: "quanah-hill", type: "region", url: "https://www.trailforks.com/region/quanah-hill-19635/" },
  { key: "parks-of-aledo", type: "region", url: "https://www.trailforks.com/region/parks-of-aledo/" },
  { key: "trinity-track", type: "trail", url: "https://www.trailforks.com/trails/trinity-track-green-loop/" },
  { key: "western-heritage-park", type: "trail", url: "https://www.trailforks.com/trails/western-heritage-park-green-trail/" },
  { key: "the-pit", type: "region", url: "https://www.trailforks.com/region/the-pit-trails/" },
  { key: "chisenhall", type: "region", url: "https://www.trailforks.com/region/chisenhall-38370/" },
  { key: "fossil-creek-park", type: "region", url: "https://www.trailforks.com/region/fossil-creek-park-46439/" },
  { key: "gateway-park", type: "region", url: "https://www.trailforks.com/region/gateway-park/" },
  { key: "marion-sansom", type: "region", url: "https://www.trailforks.com/region/marion-sansom-park-14433/" },
  { key: "north-z-boaz-park", type: "region", url: "https://www.trailforks.com/region/north-z-boaz-park-60252/" },
  { key: "the-woods-at-dunlop-park", type: "region", url: "https://www.trailforks.com/region/the-woods-at-dunlop-park-72039/" },
  { key: "arbor-hills", type: "region", url: "https://www.trailforks.com/region/arbor-hills-nature-preserve-off-road-bike-trail/" },
  { key: "barber-hills", type: "region", url: "https://www.trailforks.com/region/barber-hills/" },
  { key: "big-cedar", type: "region", url: "https://www.trailforks.com/region/big-cedar-wilderness-trails/" },
  { key: "binkley-park", type: "region", url: "https://www.trailforks.com/region/binkley-park-24408/" },
  { key: "bonham-state-park", type: "region", url: "https://www.trailforks.com/region/bonham-state-park/" },
  { key: "boulder-park", type: "region", url: "https://www.trailforks.com/region/boulder-park-13783/" },
  { key: "cedar-hill-state-park", type: "region", url: "https://www.trailforks.com/region/cedar-hill-state-park-19031/" },
  { key: "corinth-community-park", type: "region", url: "https://www.trailforks.com/region/corinth-community-park-25637/" },
  { key: "creekside-park-dorba", type: "region", url: "https://www.trailforks.com/region/creekside-park-dorba-trail/" },
  { key: "creekside-park-skillpark", type: "region", url: "https://www.trailforks.com/region/creekside-park-skillpark/" },
  { key: "cross-timbers", type: "region", url: "https://www.trailforks.com/region/cross-timbers/" },
  { key: "dinosaur-valley-state-park", type: "region", url: "https://www.trailforks.com/region/dinosaur-valley-state-park/" },
  { key: "eisenhower-state-park", type: "region", url: "https://www.trailforks.com/region/eisenhower-state-park-23481/" },
  { key: "erwin-park", type: "region", url: "https://www.trailforks.com/region/erwin-park/" },
  { key: "erwin-park-skill-park", type: "trail", url: "https://www.trailforks.com/trails/erwin-park-skills-area-530338/" },
  { key: "frisco-northwest-community-park", type: "region", url: "https://www.trailforks.com/region/frisco-northwest-community-park/" },
  { key: "goat-island-preserve", type: "region", url: "https://www.trailforks.com/region/goat-island-preserve-33774/" },
  { key: "hachie-mtb-trail", type: "region", url: "https://www.trailforks.com/region/hachie-mtb-trail-28103/" },
  { key: "harry-moss-park", type: "region", url: "https://www.trailforks.com/region/harry-moss-park-22007/" }
];

const SOURCES_2 = [
  { key: "horseshoe", type: "region", url: "https://www.trailforks.com/region/horseshoe-13746/" },
  { key: "katie-jackson-park-dorba", type: "region", url: "https://www.trailforks.com/region/katie-jackson-park-dorba-trail/" },
  { key: "katie-jackson-park-skillpark", type: "region", url: "https://www.trailforks.com/region/katie-jackson-park-skillpark-45471/" },
  { key: "knob-hills", type: "region", url: "https://www.trailforks.com/region/knob-hills-22005/" },
  { key: "lb-houston-park", type: "region", url: "https://www.trailforks.com/region/l-b-houston-park-22065/" },
  { key: "mineola-nature-preserve", type: "region", url: "https://www.trailforks.com/region/mineola-nature-preserve-greer-hill-mtb-trails/" },
  { key: "northshore", type: "region", url: "https://www.trailforks.com/region/northshore/" },
  { key: "oak-cliff-nature-preserve", type: "region", url: "https://www.trailforks.com/region/oak-cliff-nature-preserve/" },
  { key: "paul-dryer-preserve", type: "region", url: "https://www.trailforks.com/region/paul-s-dryer-preserve-at-windmill-hill/" },
  { key: "pecan-grove-park", type: "region", url: "https://www.trailforks.com/region/pecan-grove-park/" },
  { key: "ray-roberts-isle-du-bois", type: "region", url: "https://www.trailforks.com/region/ray-roberts-lake-isle-du-bois-unit/" },
  { key: "ray-roberts-johnson-branch", type: "region", url: "https://www.trailforks.com/region/ray-roberts-lake-johnson-branch-unit-13751/" },
  { key: "river-legacy-park", type: "region", url: "https://www.trailforks.com/region/river-legacy-park/" },
  { key: "rowlett-creek-preserve", type: "region", url: "https://www.trailforks.com/region/rowlett-creek-preserve-19612/" },
  { key: "sister-grove-park", type: "region", url: "https://www.trailforks.com/region/sister-grove-park-24208/" },
  { key: "squabble-creek", type: "region", url: "https://www.trailforks.com/region/squabble-creek-mountain-bike-trails-33812/" },
  { key: "waterloo-lake", type: "region", url: "https://www.trailforks.com/region/waterloo-lake-regional-park-24406/" },
  { key: "wildcat-ranch", type: "region", url: "https://www.trailforks.com/region/wildcat-ranch/" },
  { key: "lindsey-park", type: "region", url: "https://www.trailforks.com/region/lindsey-park-13827/" },
  { key: "faulkner-park", type: "region", url: "https://www.trailforks.com/region/faulkner-park-13829/" },
  { key: "tyler-state-park", type: "region", url: "https://www.trailforks.com/region/tyler-state-park/" },
  { key: "cameron-park", type: "region", url: "https://www.trailforks.com/region/cameron-park/" },
  { key: "lacy-point", type: "region", url: "https://www.trailforks.com/region/lacy-point-nature-trail-60140/" },
  { key: "woodway-park", type: "region", url: "https://www.trailforks.com/region/woodway-park/" }
];

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
  async scheduled(event, env, ctx) {
    if (event.cron === "*/5 * * * *") {
      ctx.waitUntil(refreshBatch(env, SOURCES_1, "trail_statuses_1"));
    } else {
      ctx.waitUntil(refreshBatch(env, SOURCES_2, "trail_statuses_2"));
    }
  },

  async fetch(request, env, ctx) {
    return new Response("Trail Status Cron Worker", { status: 200 });
  }
};

async function refreshBatch(env, sources, cacheKey) {
  const results = [];
  for (const source of sources) {
    results.push(await fetchStatus(source));
  }
  const data = {
    updatedAt: new Date().toISOString(),
    statuses: Object.fromEntries(results.map((r) => [r.key, r]))
  };
  await env.TRAIL_CACHE.put(cacheKey, JSON.stringify(data));
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
  // Full match: Region Status + optional date, terminated by Local Trail Association
  const match = text.match(/Region Status\s+([A-Za-z]+)(?:\s+as of\s+([^#]+?))?\s+Local Trail Association/i);
  if (match) return { status: normalizeStatus(match[1]), updated: clean(match[2] || ""), detail: "Region Status" };
  // Date-anchored match: "Region Status [status] as of [Month Day, Year]" — no terminator needed
  const dateMatch = text.match(/Region Status\s+([A-Za-z]+)\s+as of\s+([A-Za-z]+\.?\s+\d+,?\s*\d{4})/i);
  if (dateMatch) return { status: normalizeStatus(dateMatch[1]), updated: clean(dateMatch[2]), detail: "Region Status" };
  // Lenient match: Region Status + optional date, terminated by any common section header
  const lenientMatch = text.match(/Region Status\s+([A-Za-z]+)(?:\s+as of\s+([^#]+?))?\s+(?:Donate|Trail Reports|Nearby|Stats|Follow|Subscribe|Weather|Photos|About|Recent)/i);
  if (lenientMatch) return { status: normalizeStatus(lenientMatch[1]), updated: clean(lenientMatch[2] || ""), detail: "Region Status" };
  // Trail reports fallback
  const reportMatch = text.match(/Recent Trail Reports\s+status trail date condition info user\s+.+?\s+(Open|Closed)\.?\s*([^A-Z#]*)/i);
  if (reportMatch) return { status: normalizeStatus(reportMatch[1]), updated: "", detail: clean(reportMatch[2] || "Recent trail report fallback") };
  // Simple fallback
  const simpleMatch = text.match(/Region Status\s+(Open|Closed|Caution|Wet|Dry|Ideal|Variable|Prevalent Mud)/i);
  if (simpleMatch) return { status: normalizeStatus(simpleMatch[1]), updated: "", detail: "Region Status" };
  return { status: "Unknown", updated: "", detail: "Status not found" };
}

function parseTrailStatus(html) {
  const text = toText(html);
  const match = text.match(/Status:\s+on\s+([^#]+?)\s+(Ideal|Dry|Very Dry|Wet|Variable|Prevalent Mud|Closed|Open|Unknown)\s+/i);
  if (match) return { status: normalizeStatus(match[2]), updated: clean(match[1]), detail: "Trail status" };
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
  // 1. Title: "Name, City Mountain Biking"
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const commaMatch = titleMatch[1].match(/,\s*([^,|]+?)\s+Mountain Biking/i);
    if (commaMatch) {
      const city = clean(commaMatch[1]);
      if (!BROAD_REGION_TERMS.test(city)) return city;
    }
    // 2. Title: "Mountain Biking in City"
    const inMatch = titleMatch[1].match(/Mountain Biking\s+in\s+([^,|<]+)/i);
    if (inMatch) {
      const city = clean(inMatch[1]);
      if (!BROAD_REGION_TERMS.test(city)) return city;
    }
  }
  // 3. JSON-LD structured data
  const jsonLdBlocks = [...html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const block of jsonLdBlocks) {
    try {
      const data = JSON.parse(block[1]);
      const city = data?.address?.addressLocality ||
                   data?.containedInPlace?.name ||
                   data?.location?.address?.addressLocality;
      if (city && !BROAD_REGION_TERMS.test(clean(city))) return clean(city);
    } catch (e) {}
  }
  // 4. Any ol/ul with 3+ /region/ links — likely the breadcrumb hierarchy
  const lists = [...html.matchAll(/<[ou]l[^>]*>([\s\S]*?)<\/[ou]l>/gi)];
  for (const list of lists) {
    const items = [...list[1].matchAll(/href="\/region\/([^"]+)"[^>]*>\s*([^<]{2,50}?)\s*</gi)];
    if (items.length >= 3) {
      const city = clean(items[items.length - 2][2]);
      if (!BROAD_REGION_TERMS.test(city) && city.length >= 2) return city;
    }
  }
  // 5. Meta description: "biking in City, Texas"
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
