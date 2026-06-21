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
  }
];

const headers = {
  "User-Agent": "Mozilla/5.0 (compatible; TrailStatus/1.0)",
  "Accept": "text/html,application/xhtml+xml"
};

export async function onRequestGet() {
  const results = [];

  for (const source of sources) {
    results.push(await fetchStatus(source));
  }

  return Response.json(
    {
      updatedAt: new Date().toISOString(),
      statuses: Object.fromEntries(results.map((result) => [result.key, result]))
    },
    {
      headers: {
        "Cache-Control": "public, max-age=300"
      }
    }
  );
}

async function fetchStatus(source) {
  if (source.type === "manual") {
    return {
      ...source,
      status: "Manual Check",
      detail: "No reliable Trailforks region status found.",
      updated: ""
    };
  }

  try {
    const response = await fetchWithRetry(source.url);
    if (!response.ok) {
      throw new Error(`Trailforks returned ${response.status}`);
    }

    const html = await response.text();
    const parsed = source.type === "trail" ? parseTrailStatus(html) : parseRegionStatus(html);

    return {
      ...source,
      ...parsed
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
  let response = await fetch(url, { headers });

  if (response.status === 403 || response.status >= 500) {
    await delay(250);
    response = await fetch(url, { headers });
  }

  return response;
}

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function parseRegionStatus(html) {
  const text = toText(html);
  const match = text.match(/Region Status\s+([A-Za-z]+)(?:\s+as of\s+([^#]+?))?\s+Local Trail Association/i);

  if (match) {
    return {
      status: normalizeStatus(match[1]),
      updated: clean(match[2] || ""),
      detail: "Region Status"
    };
  }

  const reportMatch = text.match(/Recent Trail Reports\s+status trail date condition info user\s+.+?\s+(Open|Closed)\.?\s*([^A-Z#]*)/i);
  if (reportMatch) {
    return {
      status: normalizeStatus(reportMatch[1]),
      updated: "",
      detail: clean(reportMatch[2] || "Recent trail report fallback")
    };
  }

  return {
    status: "Unknown",
    updated: "",
    detail: "Status not found"
  };
}

function parseTrailStatus(html) {
  const text = toText(html);
  const match = text.match(/Status:\s+on\s+([^#]+?)\s+(Ideal|Dry|Very Dry|Wet|Variable|Prevalent Mud|Closed|Open|Unknown)\s+/i);

  if (match) {
    return {
      status: normalizeStatus(match[2]),
      updated: clean(match[1]),
      detail: "Trail status"
    };
  }

  const reportMatch = text.match(/Trail Reports\s+status date description\s+[^#]+?\s+(Open|Closed)\.?\s*([^#]*)/i);
  if (reportMatch) {
    return {
      status: normalizeStatus(reportMatch[1]),
      updated: "",
      detail: clean(reportMatch[2] || "Trail report fallback")
    };
  }

  return {
    status: "Unknown",
    updated: "",
    detail: "Status not found"
  };
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
  return clean(value).replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
