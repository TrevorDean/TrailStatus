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
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";

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
// PARSING
//
// Row shape on a region's /trails/ page (7 cells):
//   0 status  <span class="sicon_small sgreen" title="All Clear / Green">
//   1 name    <a href="https://www.trailforks.com/trails/…">1886</a>
//   2 difficulty <span data-sort="3" class="dicon_small dblue" title="Intermediate / …">
//   3 rating  <ul data-rating data-score title="0 / 5 with 9 votes">   (unused)
//   4 distance <span data-v="4677">3 miles</span>      data-v is METRES
//   5 descent  <span data-v="-68.9">-226 ft</span>     data-v is METRES
//   6 climb    227 ft                                  plain text, may be empty
//
// The rendered distance is rounded to whole miles ("3 miles" for 2.906 mi), so
// data-v is the only usable source. Climb has no data-v and must come from text.
//
// Difficulty is keyed off data-sort, NOT the CSS class: black and double black
// share class="dicon_small dblack" and differ only by data-sort 7 vs 8.
//
// Agreed scoring:
//   white 0.5 | green 1 | blue 2 | black 3 | double black 3.5 | pro 3.5
//   unrated / unmapped: EXCLUDED from the difficulty average, but still counted
//   toward distance and climb.
// ---------------------------------------------------------------------------

const METRES_PER_MILE = 1609.344;

// data-sort value -> difficulty score. Values 2,3,7,8,9 confirmed against live
// pages; 1 is inferred (white/easiest) and unconfirmed. Anything absent here is
// reported by --local/full runs so the map can be completed.
const DIFFICULTY_SCORE = {
  1: 0.5,  // Easiest / White Circle (inferred, not yet observed)
  2: 1,    // Easy / Green Circle
  3: 2,    // Intermediate / Blue Square
  7: 3,    // Very Difficult / Black Diamond
  8: 3.5,  // Extremely Difficult / Dbl Black Diamond
  9: 3.5   // Extremely Difficult & dangerous, pros only
};

const round = (n, dp) => Number(n.toFixed(dp));

function cellsOf(rowHtml) {
  return [...rowHtml.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => m[1]);
}

// "227 ft" / "1,440 ft" / "" -> number of feet
function feetFromText(text) {
  const m = stripTags(text).replace(/,/g, "").match(/(-?\d+(?:\.\d+)?)\s*ft/i);
  return m ? parseFloat(m[1]) : 0;
}

function dataV(cellHtml) {
  const m = String(cellHtml).match(/data-v="(-?\d+(?:\.\d+)?)"/);
  return m ? parseFloat(m[1]) : null;
}

export function parseTrailRows(html) {
  const rows = [];
  for (const match of html.matchAll(/<tr[\s>][\s\S]*?<\/tr>/gi)) {
    const row = match[0];
    const nameMatch = row.match(/<a href="([^"]*\/trails\/[^"]*)"[^>]*>([^<]+)<\/a>/);
    if (!nameMatch) continue; // header or non-trail row
    const cells = cellsOf(row);
    if (cells.length < 7) continue;

    const diffMatch = cells[2].match(/data-sort="(\d+)"/);
    const diffSort = diffMatch ? Number(diffMatch[1]) : null;
    const diffTitle = (cells[2].match(/title="([^"]*)"/) || [, ""])[1];
    const statusTitle = (cells[0].match(/title="([^"]*)"/) || [, ""])[1];

    const metres = dataV(cells[4]);
    rows.push({
      name: nameMatch[2].trim(),
      url: nameMatch[1],
      diffSort,
      diffTitle,
      score: diffSort != null && diffSort in DIFFICULTY_SCORE ? DIFFICULTY_SCORE[diffSort] : null,
      miles: metres == null ? 0 : round(metres / METRES_PER_MILE, 3),
      climbFt: feetFromText(cells[6]),
      status: statusTitle
    });
  }
  return rows;
}

// A region's listing caps at 100 trails per page and paginates with ?page=N
// (Cameron Park has two). Follow every page and dedupe by trail URL.
const MAX_PAGES = 20;

async function fetchRegionRows(baseUrl) {
  const res = await fetchOnce(baseUrl);
  if (!res.ok) return { ok: false, status: res.status, rows: [], html: null, pages: 0 };
  const html = await res.text();

  const pageNums = [...html.matchAll(/[?&]page=(\d+)/g)].map((m) => Number(m[1]));
  const lastPage = Math.min(pageNums.length ? Math.max(...pageNums) : 1, MAX_PAGES);

  const byUrl = new Map();
  for (const r of parseTrailRows(html)) byUrl.set(r.url, r);
  for (let p = 2; p <= lastPage; p++) {
    await delay(400);
    const res2 = await fetchOnce(`${baseUrl}?page=${p}`);
    if (!res2.ok) continue;
    for (const r of parseTrailRows(await res2.text())) byUrl.set(r.url, r);
  }
  return { ok: true, status: res.status, rows: [...byUrl.values()], html, pages: lastPage };
}

export function aggregate(rows) {
  const rated = rows.filter((r) => r.score != null);
  const totalMiles = round(rows.reduce((sum, r) => sum + r.miles, 0), 3);
  const totalClimbFt = Math.round(rows.reduce((sum, r) => sum + r.climbFt, 0));
  return {
    trailCount: rows.length,
    ratedCount: rated.length,
    avgDifficulty: rated.length ? round(rated.reduce((s, r) => s + r.score, 0) / rated.length, 1) : null,
    totalMiles: round(totalMiles, 1),
    totalClimbFt,
    ftPerMile: totalMiles > 0 ? Math.round(totalClimbFt / totalMiles) : null
  };
}

// --- CLI (skipped when this module is imported) -----------------------------
const isEntryPoint = process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop());

if (isEntryPoint) {
  const args = process.argv.slice(2);
  const mode = args.find((a) => a.startsWith("--")) || "";
  const keys = args.filter((a) => !a.startsWith("--"));

  if (mode === "--dump") {
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
  } else if (mode === "--local") {
    // Parse previously dumped HTML — no network, so it works off-Actions.
    const files = keys.length ? keys : readdirSync("dump").filter((f) => f.endsWith(".html")).map((f) => f.replace(/\.html$/, ""));
    const unmapped = new Map();
    for (const key of files) {
      const rows = parseTrailRows(readFileSync(`dump/${key}.html`, "utf8"));
      const agg = aggregate(rows);
      console.log(`\n===== ${key} =====`);
      for (const r of rows) {
        const score = r.score == null ? `UNMAPPED(sort=${r.diffSort})` : r.score;
        console.log(`  ${r.name.padEnd(28)} score=${String(score).padEnd(18)} ${String(r.miles).padStart(6)} mi  ${String(r.climbFt).padStart(5)} ft climb  [${r.diffTitle}]`);
        if (r.score == null) unmapped.set(`${r.diffSort}`, r.diffTitle);
      }
      console.log(`  --> ${agg.trailCount} trails (${agg.ratedCount} rated) | difficulty ${agg.avgDifficulty} | ${agg.totalMiles} mi | ${agg.totalClimbFt} ft climb | ${agg.ftPerMile} ft/mi`);
    }
    if (unmapped.size) {
      console.log(`\n!! UNMAPPED difficulty data-sort values — add to DIFFICULTY_SCORE:`);
      for (const [sort, title] of unmapped) console.log(`   data-sort=${sort}  "${title}"`);
    }
  } else if (mode === "--all") {
    // Full sweep: every trailhead with a /region/ page. The two genuine
    // single-trail entries have no sub-trail listing and are skipped.
    const regions = TRAILS.filter((t) => /\/region\//.test(t.url));
    const skipped = TRAILS.filter((t) => !/\/region\//.test(t.url)).map((t) => t.key);
    console.error(`sweeping ${regions.length} regions; skipping ${skipped.length}: ${skipped.join(", ")}`);

    mkdirSync("dump", { recursive: true });
    const stats = {};
    const unmapped = new Map();
    const problems = [];

    for (const t of regions) {
      const url = trailsListUrl(t.url);
      try {
        const { ok, status, rows, html, pages } = await fetchRegionRows(url);
        if (!ok) {
          problems.push(`${t.key}: HTTP ${status}`);
          console.error(`${t.key}: HTTP ${status}`);
          await delay(400);
          continue;
        }
        writeFileSync(`dump/${t.key}.html`, html);
        const agg = aggregate(rows);
        for (const r of rows) if (r.score == null) unmapped.set(String(r.diffSort), r.diffTitle);
        if (!rows.length) {
          // e.g. a skills-park region with no trail listing — omit rather than
          // publish zeroes the frontend would have to special-case anyway.
          problems.push(`${t.key}: 0 trails parsed — omitted from output`);
          console.error(`${t.key}: 0 trails — omitted`);
          await delay(400);
          continue;
        }
        stats[t.key] = agg;
        console.error(`${t.key}: ${agg.trailCount} trails${pages > 1 ? ` (${pages} pages)` : ""} | diff ${agg.avgDifficulty} | ${agg.totalMiles} mi | ${agg.totalClimbFt} ft | ${agg.ftPerMile} ft/mi`);
      } catch (error) {
        problems.push(`${t.key}: ${error}`);
        console.error(`${t.key}: ERROR ${error}`);
      }
      await delay(400);
    }

    if (unmapped.size) {
      console.error(`\n!! UNMAPPED difficulty data-sort values:`);
      for (const [sort, title] of unmapped) console.error(`   data-sort=${sort}  "${title}"`);
    }
    if (problems.length) console.error(`\n!! PROBLEMS:\n   ${problems.join("\n   ")}`);

    const generated = `// GENERATED by scripts/extract-trail-stats.js --all — do not edit by hand.
// Per-trailhead aggregates derived from each region's Trailforks /trails/ page.
//   avgDifficulty  white .5 | green 1 | blue 2 | black 3 | dbl black 3.5 | pro 3.5
//                  averaged over rated trails only
//   totalMiles     summed from each trail's exact distance (metres), 1dp
//   totalClimbFt   summed climb, feet
//   ftPerMile      totalClimbFt / totalMiles, nearest foot
export const TRAIL_STATS = ${JSON.stringify(stats, null, 2)};
`;
    writeFileSync("dump/trail-stats.js", generated);
    console.error(`\nwrote dump/trail-stats.js — ${Object.keys(stats).length} trailheads`);
  } else {
    console.error("usage:");
    console.error("  node scripts/extract-trail-stats.js --dump <key…>    fetch + save HTML (Actions only)");
    console.error("  node scripts/extract-trail-stats.js --local [key…]   parse saved HTML offline");
    console.error("  node scripts/extract-trail-stats.js --all            sweep all regions (Actions only)");
    process.exit(1);
  }
}
