// Read the status history archive back. There is deliberately no /api/history
// endpoint and no UI — the archive is collected but not published — so this is
// the way to look at it without hand-writing SQL every time.
//
//   node scripts/history-report.js                    # local D1 (wrangler dev's copy)
//   node scripts/history-report.js --remote           # the real archive
//   node scripts/history-report.js --remote --trail quanah-hill
//   node scripts/history-report.js --remote --days 30
//
// Wraps `wrangler d1 execute --json`; wrangler's own OAuth session authenticates
// it, so no API token is involved.

import { execFileSync } from "node:child_process";

const DB = "ntx-history";
const args = process.argv.slice(2);
const remote = args.includes("--remote");
const trail = valueOf("--trail");
const days = Number(valueOf("--days") || 14);

function valueOf(flag) {
  const i = args.indexOf(flag);
  return i === -1 ? null : args[i + 1];
}

function query(sql) {
  const out = execFileSync(
    "npx",
    ["wrangler", "d1", "execute", DB, remote ? "--remote" : "--local", "--json", "--command", sql],
    { encoding: "utf8", maxBuffer: 32 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] }
  );
  // wrangler prints its version banner before the JSON on some paths.
  return JSON.parse(out.slice(out.indexOf("[")))[0].results;
}

const since = new Date(Date.now() - days * 86400000).toISOString();
const scope = trail ? ` AND trail_key = '${trail.replace(/'/g, "''")}'` : "";

console.log(`${remote ? "REMOTE" : "LOCAL"} archive · last ${days} days${trail ? ` · ${trail}` : ""}\n`);

const totals = query(
  `SELECT (SELECT COUNT(*) FROM status_events) AS events,
          (SELECT COUNT(*) FROM trail_state)  AS trails,
          (SELECT COUNT(*) FROM scrape_runs)  AS runs,
          (SELECT MIN(observed_at) FROM status_events) AS first_seen,
          (SELECT MAX(ran_at) FROM scrape_runs) AS last_run`
)[0];
console.log(`  ${totals.events} events across ${totals.trails} trails · ${totals.runs} runs`);
console.log(`  recording since ${totals.first_seen || "never"} · last run ${totals.last_run || "never"}\n`);

// Coverage first: a gap here means the archive is missing time, and every other
// number below has to be read in that light.
const coverage = query(
  `SELECT COUNT(*) AS runs, MIN(trails_observed) AS min_seen, MAX(trails_unusable) AS worst_unusable
   FROM scrape_runs WHERE ran_at >= '${since}'`
)[0];
console.log("Coverage");
console.log(`  ${coverage.runs} runs · fewest trails observed in one run: ${coverage.min_seen ?? "—"} · most unusable: ${coverage.worst_unusable ?? "—"}`);
const expected = Math.round((days * 24 * 60) / 5);
console.log(`  expected ~${expected} runs at one per 5 min → ${coverage.runs ? Math.round((coverage.runs / expected) * 100) : 0}% of the window covered\n`);

console.log("Recent changes");
const events = query(
  `SELECT observed_at, trail_key, prev_status, status FROM status_events
   WHERE observed_at >= '${since}'${scope} AND prev_status IS NOT NULL
   ORDER BY id DESC LIMIT 40`
);
if (!events.length) console.log("  (none — every trail held its status)");
for (const e of events) {
  console.log(`  ${e.observed_at.slice(0, 16).replace("T", " ")}  ${e.trail_key.padEnd(28)} ${e.prev_status} → ${e.status}`);
}

if (!trail) {
  console.log("\nMost changeable trails");
  const busiest = query(
    `SELECT trail_key, COUNT(*) AS changes FROM status_events
     WHERE observed_at >= '${since}' AND prev_status IS NOT NULL
     GROUP BY trail_key ORDER BY changes DESC LIMIT 10`
  );
  if (!busiest.length) console.log("  (none yet)");
  for (const r of busiest) console.log(`  ${String(r.changes).padStart(3)}  ${r.trail_key}`);
}
