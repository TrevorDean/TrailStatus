// One-off backfill of weather_hourly, reaching back before the archive existed.
//
// The status archive starts 2026-08-30 and cannot be extended — nobody recorded
// those transitions. Weather is different: Open-Meteo serves 92 days of past
// hours from the SAME endpoint and the SAME model the hourly cron uses, so the
// weather side of the training set can start three months earlier than the
// status side, with no seam between backfilled and live rows.
//
//   node scripts/backfill-weather.js --dry-run          # fetch + report, write nothing
//   node scripts/backfill-weather.js                    # write .sql files to dump/
//   node scripts/backfill-weather.js --apply            # ...and run them against prod D1
//   node scripts/backfill-weather.js --days 20 --apply  # a safe bite (see below)
//   node scripts/backfill-weather.js --days 92 --apply --force  # paid plans only
//
// WRITE BUDGET, enforced below rather than merely advised — because the advisory
// version was written right here and then ignored. A full 92-day backfill is
// ~129,000 rows, and D1's free tier allows 100,000 ROW WRITES PER DAY.
//
// The trap is that a row is not a write. weather_hourly is WITHOUT ROWID with a
// composite primary key AND an index on hour_ts, so **every row costs about two
// writes**. Sizing a chunk by row count alone understates the cost by half,
// which is how 92 days became ~270,000 writes — 2.7x the daily limit — when this
// was first run on 2026-09-04.
//
// Going over does not fail loudly, and it does not fail here. D1 starts refusing
// writes ACCOUNT-WIDE until midnight UTC, so the Worker's own scheduled() writes
// begin failing too; the status heartbeat has no retry, so every rejected run is
// a permanent hole in scrape_runs. The weather archive survives only because
// recordWeatherHour() re-derives its own catch-up window and retries.
//
// The Cloudflare dashboard will not show you this: those analytics count writes
// through the Workers binding, while the quota also counts the REST-API writes
// this script makes. The dashboard read 7k rows for the week while the quota was
// already 2.7x blown. `wrangler d1 info` is the number that tells the truth.
//
// It writes SQL for `wrangler d1 execute` rather than calling the Cloudflare
// REST API, deliberately. wrangler carries its own OAuth session, so this needs
// no CLOUDFLARE_API_TOKEN — and the token therefore never needs D1 permissions
// added to it. See CLAUDE.md on that token's blast radius.

import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TRAILS } from "../public/trails.js";
import {
  ARCHIVE_VARS,
  MAX_PAST_DAYS,
  archiveRequestUrl,
  groupByLocation,
  shapeArchiveResponse
} from "../public/weather.js";

const OUT_DIR = join(dirname(fileURLToPath(import.meta.url)), "..", "dump");
const DB = "ntx-history";

const COLUMNS = [
  "trail_key", "hour_ts",
  "precip_in", "temp_f", "et0_in", "humidity_pct", "wind_kmh",
  "radiation_wm2", "soil_moist_0_1", "soil_moist_1_3", "soil_moist_3_9", "soil_temp_f"
];

// Rows per generated file. `wrangler d1 execute --file` reads the whole thing
// into one request, so this is about staying inside that rather than about D1's
// row limits — a few large files beat hundreds of small ones.
const ROWS_PER_FILE = 20000;
const ROWS_PER_STATEMENT = 40;

// D1 free tier. WRITES_PER_ROW is the index amplification described above; the
// safety margin leaves room for the hourly cron, which needs ~3,200 writes a day
// and must not be starved by a backfill that spent the budget to the last row.
const FREE_TIER_DAILY_WRITES = 100000;
const WRITES_PER_ROW = 2;
const SAFETY = 0.8;
const MAX_ROWS_PER_RUN = Math.floor((FREE_TIER_DAILY_WRITES * SAFETY) / WRITES_PER_ROW);

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i === -1 ? fallback : process.argv[i + 1];
}

function sqlValue(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "NULL";
  return `'${String(v).replace(/'/g, "''")}'`;
}

function toStatements(rows) {
  const out = [];
  for (let i = 0; i < rows.length; i += ROWS_PER_STATEMENT) {
    const values = rows
      .slice(i, i + ROWS_PER_STATEMENT)
      .map((r) => `(${r.map(sqlValue).join(",")})`)
      .join(",");
    out.push(`INSERT OR REPLACE INTO weather_hourly (${COLUMNS.join(",")}) VALUES ${values};`);
  }
  return out;
}

(async () => {
  const dryRun = process.argv.includes("--dry-run");
  const apply = process.argv.includes("--apply");
  const days = Math.min(Number(arg("--days", MAX_PAST_DAYS)), MAX_PAST_DAYS);

  const groups = groupByLocation(TRAILS);
  const url = archiveRequestUrl(groups, { pastDays: days, forecastDays: 1 });
  console.log(`Fetching ${days} days for ${groups.length} locations (${TRAILS.length} trailheads)...`);

  const response = await fetch(url);
  if (!response.ok) {
    console.error(`Open-Meteo returned ${response.status}`);
    process.exit(1);
  }

  const nowTs = Math.floor(Date.now() / 1000);
  // Never store a future hour in weather_hourly. A forecast row there would be
  // indistinguishable from an observation later on, which is the exact confusion
  // forecast_snapshots exists to keep out of the training data.
  const rows = shapeArchiveResponse(await response.json(), groups).filter((r) => r[1] <= nowTs);

  if (rows.length === 0) {
    console.error("No rows in range — nothing to write.");
    process.exit(1);
  }

  const hours = [...new Set(rows.map((r) => r[1]))].sort((a, b) => a - b);
  const rainIdx = 2 + ARCHIVE_VARS.indexOf("precipitation");
  const totalRain = rows.reduce((sum, r) => sum + (r[rainIdx] || 0), 0) / TRAILS.length;

  console.log(`${rows.length} rows, ${hours.length} hours`);
  console.log(`  ${new Date(hours[0] * 1000).toISOString()} -> ${new Date(hours[hours.length - 1] * 1000).toISOString()}`);
  console.log(`  mean rainfall per trailhead over the window: ${totalRain.toFixed(2)} in`);

  const writes = rows.length * WRITES_PER_ROW;
  console.log(`  estimated D1 cost: ~${writes.toLocaleString()} row writes (${((writes / FREE_TIER_DAILY_WRITES) * 100).toFixed(0)}% of the free-tier daily limit)`);

  if (dryRun) {
    console.log("\n--dry-run: nothing written.");
    return;
  }

  // Refuse, do not warn. Exceeding the limit disables the Worker's own archive
  // writes for the rest of the UTC day, so the damage lands hours later and far
  // away from whoever ran this.
  if (rows.length > MAX_ROWS_PER_RUN && !process.argv.includes("--force")) {
    const safeDays = Math.floor(MAX_ROWS_PER_RUN / (TRAILS.length * 24));
    console.error(`\nREFUSING: ${rows.length.toLocaleString()} rows is ~${writes.toLocaleString()} writes, over the ${MAX_ROWS_PER_RUN.toLocaleString()}-row ceiling for one day on D1's free tier.`);
    console.error(`Run it in passes on consecutive days: --days ${safeDays}. INSERT OR REPLACE makes the overlap free.`);
    console.error(`On a paid plan (50M writes/month) this ceiling does not apply — pass --force.`);
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  for (const f of readdirSync(OUT_DIR).filter((f) => /^backfill-weather-\d+\.sql$/.test(f))) {
    unlinkSync(join(OUT_DIR, f));
  }

  const files = [];
  for (let i = 0, n = 0; i < rows.length; i += ROWS_PER_FILE, n++) {
    const file = join(OUT_DIR, `backfill-weather-${String(n).padStart(3, "0")}.sql`);
    writeFileSync(file, toStatements(rows.slice(i, i + ROWS_PER_FILE)).join("\n") + "\n");
    files.push(file);
  }
  console.log(`\nWrote ${files.length} file(s) to dump/.`);

  if (!apply) {
    console.log("Re-run with --apply to execute them, or run by hand:");
    for (const f of files) console.log(`  npx wrangler d1 execute ${DB} --remote --file=${f}`);
    return;
  }

  for (const f of files) {
    console.log(`Applying ${f}...`);
    // CI=true so wrangler takes its non-interactive fallback on the "continue?"
    // prompt instead of hanging on a TTY that is not there.
    execFileSync("npx", ["wrangler", "d1", "execute", DB, "--remote", `--file=${f}`], {
      stdio: "inherit",
      env: { ...process.env, CI: "true" }
    });
  }
  console.log("Backfill applied.");
})();
