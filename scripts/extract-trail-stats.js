// Maintenance utility (run via the "Extract Trail Stats" workflow_dispatch —
// Trailforks blocks non-GitHub-Actions IPs). Fetches each region's
// .../trails/ listing page, which enumerates the individual trails at that
// trailhead along with difficulty, distance and climb.
//
// Two modes:
//   node scripts/extract-trail-stats.js --dump <key>
//       Fetch ONE region and write its raw HTML to dump/<key>.html, plus print
//       a recon summary to the log. Used to work out the page markup before
//       any parser exists.
//   node scripts/extract-trail-stats.js
//       (not implemented until the markup is known — see PARSING below)
import { TRAILS } from "../public/trails.js";
import { mkdirSync, writeFileSync } from "node:fs";

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

// Region page -> its trail listing. https://…/region/foo/ -> https://…/region/foo/trails/
export function trailsListUrl(regionUrl) {
  return `${String(regionUrl).replace(/\/+$/, "")}/trails/`;
}

async function fetchOnce(url) {
  let res = await fetch(url, { headers: fetchHeaders });
  if (res.status === 403 || res.status >= 500) {
    await delay(400);
    res = await fetch(url, { headers: fetchHeaders });
  }
  return res;
}

function stripTags(s) {
  return String(s || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// ---------------------------------------------------------------------------
// Recon: we cannot see this page from a dev machine, so before writing any
// parser, report what the markup actually looks like.
// ---------------------------------------------------------------------------
function recon(html) {
  const out = [];
  const say = (label, value) => out.push(`${label}: ${value}`);

  say("bytes", html.length);
  say("<table> count", (html.match(/<table/gi) || []).length);
  say("<tr> count", (html.match(/<tr[\s>]/gi) || []).length);

  // Class names that plausibly carry the data we want.
  const classes = new Set();
  for (const m of html.matchAll(/class="([^"]{1,160})"/gi)) {
    for (const c of m[1].split(/\s+/)) {
      if (/trail|diff|dist|climb|elev|length|desc|grade|rating|stat/i.test(c)) classes.add(c);
    }
  }
  say("interesting class names", [...classes].sort().slice(0, 60).join(" ") || "(none)");

  // Difficulty is usually conveyed by an icon/sprite name rather than text.
  const diffTokens = new Set();
  for (const m of html.matchAll(/(difficulty[a-z0-9_-]*|diff_[a-z0-9]+|green|blue|black|dblack|double[_-]?black|novice|beginner|intermediate|advanced|expert|pro(?:line)?)/gi)) {
    diffTokens.add(m[1].toLowerCase());
  }
  say("difficulty-ish tokens", [...diffTokens].sort().join(" ") || "(none)");

  // Units — tells us whether distance arrives as "0.4 mi" / "1,200 ft" / raw metres.
  const units = new Set();
  for (const m of html.matchAll(/([\d,]+(?:\.\d+)?)\s*(mi|miles|ft|feet|km|m)\b/gi)) {
    units.add(m[2].toLowerCase());
  }
  say("distance units seen", [...units].sort().join(" ") || "(none)");

  // Embedded JSON is the happy path: far more robust than regexing a table.
  for (const m of html.matchAll(/(var|const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(\[|\{)/g)) {
    if (/trail|data|row|list/i.test(m[2])) out.push(`js var: ${m[2]} = ${m[3]}…`);
  }

  // The first data row, tags intact — the single most useful thing for regexing.
  const rows = [...html.matchAll(/<tr[\s>][\s\S]{0,4000}?<\/tr>/gi)];
  const dataRow = rows.find((r) => /\d/.test(r[0]) && r[0].length > 200);
  if (dataRow) {
    out.push("--- first data-looking <tr> (raw) ---");
    out.push(dataRow[0].slice(0, 2500));
    out.push("--- same row, tags stripped ---");
    out.push(stripTags(dataRow[0]).slice(0, 600));
  } else {
    out.push("(no table rows found — listing is probably JS-rendered; check the js vars above)");
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// PARSING (to be written once the recon output shows the real markup)
//
// Agreed scoring, for whoever implements it:
//   difficulty  white 0.5 | green 1 | blue 2 | black 3 | double black 3.5 | pro 3.5
//               unrated/non-singletrack: EXCLUDED from the difficulty average
//   distance    feet -> miles as ft/5280 rounded to 3dp, then summed; shown to 1dp
//   climb       summed as raw feet
//   ft/mile     totalClimbFt / totalMiles, rounded to nearest integer
//               unrated trails DO count toward distance and climb
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const dumpIndex = args.indexOf("--dump");

if (dumpIndex === -1) {
  console.error("Parser not implemented yet. Run with --dump <key> first, e.g.:");
  console.error("  node scripts/extract-trail-stats.js --dump quanah-hill");
  process.exit(1);
}

const keys = args.slice(dumpIndex + 1).filter((a) => !a.startsWith("--"));
if (!keys.length) {
  console.error("--dump needs at least one trail key");
  process.exit(1);
}

mkdirSync("dump", { recursive: true });

for (const key of keys) {
  const trail = TRAILS.find((t) => t.key === key);
  if (!trail) {
    console.error(`unknown key: ${key}`);
    continue;
  }
  const url = trailsListUrl(trail.url);
  try {
    const res = await fetchOnce(url);
    const html = await res.text();
    writeFileSync(`dump/${key}.html`, html);
    console.log(`\n===== ${key} — HTTP ${res.status} — ${url} =====`);
    console.log(res.ok ? recon(html) : stripTags(html).slice(0, 400));
  } catch (error) {
    console.log(`\n===== ${key} — ERROR — ${url} =====`);
    console.log(String(error));
  }
  await delay(400);
}
