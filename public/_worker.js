const sources = [
  {
    key: "quanah-hill",
    name: "Quanah Hill",
    type: "region",
    url: "https://www.trailforks.com/region/quanah-hill-19635/"
  },
  {
    key: "parks-of-aledo",
    name: "Parks of Aledo",
    type: "region",
    url: "https://www.trailforks.com/region/parks-of-aledo/"
  },
  {
    key: "trinity-track",
    name: "Trinity Track",
    type: "trail",
    url: "https://www.trailforks.com/trails/trinity-track-green-loop/"
  },
  {
    key: "western-heritage-park",
    name: "Western Heritage Park",
    type: "trail",
    url: "https://www.trailforks.com/trails/western-heritage-park-green-trail/"
  },
  {
    key: "the-pit",
    name: "The Pit",
    type: "region",
    url: "https://www.trailforks.com/region/the-pit-trails/"
  },
  {
    key: "chisenhall",
    name: "Chisenhall",
    type: "region",
    url: "https://www.trailforks.com/region/chisenhall-38370/"
  },
  {
    key: "fossil-creek-park",
    name: "Fossil Creek Park",
    type: "region",
    url: "https://www.trailforks.com/region/fossil-creek-park-46439/"
  },
  {
    key: "gateway-park",
    name: "Gateway Park",
    type: "region",
    url: "https://www.trailforks.com/region/gateway-park/"
  },
  {
    key: "marion-sansom",
    name: "Marion Sansom",
    type: "region",
    url: "https://www.trailforks.com/region/marion-sansom-park-14433/"
  },
  {
    key: "north-z-boaz-park",
    name: "North Z Boaz Park",
    type: "region",
    url: "https://www.trailforks.com/region/north-z-boaz-park-60252/"
  },
  {
    key: "the-woods-at-dunlop-park",
    name: "The Woods at Dunlop Park",
    type: "region",
    url: "https://www.trailforks.com/region/the-woods-at-dunlop-park-72039/"
  },
  {
    key: "arbor-hills",
    name: "Arbor Hills Nature Preserve Off Road Bike Trail",
    type: "region",
    url: "https://www.trailforks.com/region/arbor-hills-nature-preserve-off-road-bike-trail/"
  },
  {
    key: "barber-hills",
    name: "Barber Hills",
    type: "region",
    url: "https://www.trailforks.com/region/barber-hills/"
  },
  {
    key: "big-cedar",
    name: "Big Cedar Wilderness Trails",
    type: "region",
    url: "https://www.trailforks.com/region/big-cedar-wilderness-trails/"
  },
  {
    key: "binkley-park",
    name: "Binkley Park",
    type: "region",
    url: "https://www.trailforks.com/region/binkley-park-24408/"
  },
  {
    key: "bonham-state-park",
    name: "Bonham State Park",
    type: "region",
    url: "https://www.trailforks.com/region/bonham-state-park/"
  },
  {
    key: "boulder-park",
    name: "Boulder Park",
    type: "region",
    url: "https://www.trailforks.com/region/boulder-park-13783/"
  },
  {
    key: "cedar-hill-state-park",
    name: "Cedar Hill State Park",
    type: "region",
    url: "https://www.trailforks.com/region/cedar-hill-state-park-19031/"
  },
  {
    key: "corinth-community-park",
    name: "Corinth Community Park",
    type: "region",
    url: "https://www.trailforks.com/region/corinth-community-park-25637/"
  },
  {
    key: "creekside-park-dorba",
    name: "Creekside Park DORBA Trail",
    type: "region",
    url: "https://www.trailforks.com/region/creekside-park-dorba-trail/"
  },
  {
    key: "creekside-park-skillpark",
    name: "Creekside Park Skillpark",
    type: "region",
    url: "https://www.trailforks.com/region/creekside-park-skillpark/"
  },
  {
    key: "cross-timbers",
    name: "Cross Timbers",
    type: "region",
    url: "https://www.trailforks.com/region/cross-timbers/"
  },
  {
    key: "dinosaur-valley-state-park",
    name: "Dinosaur Valley State Park",
    type: "region",
    url: "https://www.trailforks.com/region/dinosaur-valley-state-park/"
  },
  {
    key: "eisenhower-state-park",
    name: "Eisenhower State Park",
    type: "region",
    url: "https://www.trailforks.com/region/eisenhower-state-park-23481/"
  },
  {
    key: "erwin-park",
    name: "Erwin Park",
    type: "region",
    url: "https://www.trailforks.com/region/erwin-park/"
  },
  {
    key: "erwin-park-skill-park",
    name: "Erwin Park Skill Park",
    type: "trail",
    url: "https://www.trailforks.com/trails/erwin-park-skills-area-530338/"
  },
  {
    key: "frisco-northwest-community-park",
    name: "Frisco Northwest Community Park",
    type: "region",
    url: "https://www.trailforks.com/region/frisco-northwest-community-park/"
  },
  {
    key: "goat-island-preserve",
    name: "Goat Island Preserve",
    type: "region",
    url: "https://www.trailforks.com/region/goat-island-preserve-33774/"
  },
  {
    key: "hachie-mtb-trail",
    name: "Hachie MTB Trail",
    type: "region",
    url: "https://www.trailforks.com/region/hachie-mtb-trail-28103/"
  },
  {
    key: "harry-moss-park",
    name: "Harry Moss Park",
    type: "region",
    url: "https://www.trailforks.com/region/harry-moss-park-22007/"
  },
  {
    key: "horseshoe",
    name: "Horseshoe",
    type: "region",
    url: "https://www.trailforks.com/region/horseshoe-13746/"
  },
  {
    key: "katie-jackson-park-dorba",
    name: "Katie Jackson Park DORBA Trail",
    type: "region",
    url: "https://www.trailforks.com/region/katie-jackson-park-dorba-trail/"
  },
  {
    key: "katie-jackson-park-skillpark",
    name: "Katie Jackson Park Skillpark",
    type: "region",
    url: "https://www.trailforks.com/region/katie-jackson-park-skillpark-45471/"
  },
  {
    key: "knob-hills",
    name: "Knob Hills",
    type: "region",
    url: "https://www.trailforks.com/region/knob-hills-22005/"
  },
  {
    key: "lb-houston-park",
    name: "L.B. Houston Park",
    type: "region",
    url: "https://www.trailforks.com/region/l-b-houston-park-22065/"
  },
  {
    key: "mineola-nature-preserve",
    name: "Mineola Nature Preserve",
    type: "region",
    url: "https://www.trailforks.com/region/mineola-nature-preserve-greer-hill-mtb-trails/"
  },
  {
    key: "northshore",
    name: "Northshore",
    type: "region",
    url: "https://www.trailforks.com/region/northshore/"
  },
  {
    key: "oak-cliff-nature-preserve",
    name: "Oak Cliff Nature Preserve",
    type: "region",
    url: "https://www.trailforks.com/region/oak-cliff-nature-preserve/"
  },
  {
    key: "paul-dryer-preserve",
    name: "Paul S. Dryer Preserve at Windmill Hill",
    type: "region",
    url: "https://www.trailforks.com/region/paul-s-dryer-preserve-at-windmill-hill/"
  },
  {
    key: "pecan-grove-park",
    name: "Pecan Grove Park",
    type: "region",
    url: "https://www.trailforks.com/region/pecan-grove-park/"
  },
  {
    key: "ray-roberts-isle-du-bois",
    name: "Ray Roberts Lake Isle Du Bois Unit",
    type: "region",
    url: "https://www.trailforks.com/region/ray-roberts-lake-isle-du-bois-unit/"
  },
  {
    key: "ray-roberts-johnson-branch",
    name: "Ray Roberts Lake Johnson Branch Unit",
    type: "region",
    url: "https://www.trailforks.com/region/ray-roberts-lake-johnson-branch-unit-13751/"
  },
  {
    key: "river-legacy-park",
    name: "River Legacy Park",
    type: "region",
    url: "https://www.trailforks.com/region/river-legacy-park/"
  },
  {
    key: "rowlett-creek-preserve",
    name: "Rowlett Creek Preserve",
    type: "region",
    url: "https://www.trailforks.com/region/rowlett-creek-preserve-19612/"
  },
  {
    key: "sister-grove-park",
    name: "Sister Grove Park",
    type: "region",
    url: "https://www.trailforks.com/region/sister-grove-park-24208/"
  },
  {
    key: "squabble-creek",
    name: "Squabble Creek Mountain Bike Trails",
    type: "region",
    url: "https://www.trailforks.com/region/squabble-creek-mountain-bike-trails-33812/"
  },
  {
    key: "waterloo-lake",
    name: "Waterloo Lake Regional Park",
    type: "region",
    url: "https://www.trailforks.com/region/waterloo-lake-regional-park-24406/"
  },
  {
    key: "wildcat-ranch",
    name: "Wildcat Ranch",
    type: "region",
    url: "https://www.trailforks.com/region/wildcat-ranch/"
  },
  {
    key: "lindsey-park",
    name: "Lindsey Park",
    type: "region",
    url: "https://www.trailforks.com/region/lindsey-park-13827/"
  },
  {
    key: "faulkner-park",
    name: "Faulkner Park",
    type: "region",
    url: "https://www.trailforks.com/region/faulkner-park-13829/"
  },
  {
    key: "tyler-state-park",
    name: "Tyler State Park",
    type: "region",
    url: "https://www.trailforks.com/region/tyler-state-park/"
  },
  {
    key: "cameron-park",
    name: "Cameron Park",
    type: "region",
    url: "https://www.trailforks.com/region/cameron-park/"
  },
  {
    key: "lacy-point",
    name: "Lacy Point Nature Trail",
    type: "region",
    url: "https://www.trailforks.com/region/lacy-point-nature-trail-60140/"
  },
  {
    key: "woodway-park",
    name: "Woodway Park",
    type: "region",
    url: "https://www.trailforks.com/region/woodway-park/"
  }
];

const fetchHeaders = {
  "User-Agent": "Mozilla/5.0 (compatible; TrailStatus/1.0)",
  "Accept": "text/html,application/xhtml+xml"
};

const CACHE_KEY = "trail_statuses";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname === "/api/status") {
      return handleStatus(env);
    }
    return env.ASSETS.fetch(request);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshCache(env));
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
        if (s.lta && s.lta.length > 20) s.lta = s.lta.slice(0, 20).trim();
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

async function refreshCache(env) {
  const data = await fetchAllStatuses();
  await env.TRAIL_CACHE.put(CACHE_KEY, JSON.stringify(data));
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
  if (match) {
    return { status: normalizeStatus(match[1]), updated: clean(match[2] || ""), detail: "Region Status" };
  }

  const reportMatch = text.match(/Recent Trail Reports\s+status trail date condition info user\s+.+?\s+(Open|Closed)\.?\s*([^A-Z#]*)/i);
  if (reportMatch) {
    return { status: normalizeStatus(reportMatch[1]), updated: "", detail: clean(reportMatch[2] || "Recent trail report fallback") };
  }

  const lenientMatch = text.match(/Region Status\s+(Open|Closed|Caution|Wet|Dry|Ideal|Variable|Prevalent Mud)/i);
  if (lenientMatch) {
    return { status: normalizeStatus(lenientMatch[1]), updated: "", detail: "Region Status" };
  }

  return { status: "Unknown", updated: "", detail: "Status not found" };
}

function parseTrailStatus(html) {
  const text = toText(html);

  const match = text.match(/Status:\s+on\s+([^#]+?)\s+(Ideal|Dry|Very Dry|Wet|Variable|Prevalent Mud|Closed|Open|Unknown)\s+/i);
  if (match) {
    return { status: normalizeStatus(match[2]), updated: clean(match[1]), detail: "Trail status" };
  }

  const reportMatch = text.match(/Trail Reports\s+status date description\s+[^#]+?\s+(Open|Closed)\.?\s*([^#]*)/i);
  if (reportMatch) {
    return { status: normalizeStatus(reportMatch[1]), updated: "", detail: clean(reportMatch[2] || "Trail report fallback") };
  }

  return { status: "Unknown", updated: "", detail: "Status not found" };
}

function parseLTA(html) {
  const text = toText(html);
  const match = text.match(/Local Trail Association\s+(.*?)\s+(?:Donate|Trail Reports|Nearby Regions|Latest Conditions|Sponsor|Weather|Photos|Stats|Follow|Subscribe|Maps|About|Recent)/i);
  if (match) return clean(match[1]).slice(0, 20);
  return "";
}

function parseCity(html) {
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    const cityMatch = titleMatch[1].match(/, ([^,|]+) Mountain Biking/i);
    if (cityMatch) return clean(cityMatch[1]);
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
