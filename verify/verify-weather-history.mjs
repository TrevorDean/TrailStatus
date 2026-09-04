// Verifies the weather archive's pure functions — shaping, unit coupling,
// catch-up arithmetic, and the reported_at parser.
//
// No jsdom, no D1, no network: every function under test takes its input as a
// plain object, which is why recordWeatherHour() takes `now` and `fetchImpl` as
// arguments instead of reaching for the clock and the network itself.
// Exits NON-ZERO on failure, like verify-history and verify-weather.
import {
  ARCHIVE_VARS, MAX_PAST_DAYS,
  archiveRequestUrl, groupByLocation, shapeArchiveResponse, shapeForecastSnapshot
} from "../public/weather.js";
import { catchupFloor, currentHourTs } from "../weather-history.js";
import { parseReportedAt } from "../history.js";

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

// Two trailheads that round to ONE location, plus a third on its own — the
// fan-out case that must give both co-located keys identical rows.
const TRAILS = [
  { key: "alpha", lat: 32.801, lng: -96.721 },
  { key: "beta", lat: 32.804, lng: -96.724 },
  { key: "gamma", lat: 33.25, lng: -96.66 }
];
const groups = groupByLocation(TRAILS);

const hourly = (base) => Object.fromEntries([
  ["time", [1000, 4600]],
  ...ARCHIVE_VARS.map((v, i) => [v, [base + i, base + i + 100]])
]);

console.log("=== request building ===");
{
  const url = new URL(archiveRequestUrl(groups, { pastDays: 7 }));
  check("groups 3 trailheads into 2 locations", groups.length, 2);
  check("asks for every archive variable", url.searchParams.get("hourly"), ARCHIVE_VARS.join(","));
  check("past_days is passed through", url.searchParams.get("past_days"), "7");
  // The unit coupling that silently rescales two columns if it ever changes.
  check("precipitation_unit is inch (governs ET0 too)", url.searchParams.get("precipitation_unit"), "inch");
  check("temperature_unit is fahrenheit (governs soil temp too)", url.searchParams.get("temperature_unit"), "fahrenheit");

  let threw = false;
  try { archiveRequestUrl(groups, { pastDays: MAX_PAST_DAYS + 1 }); } catch { threw = true; }
  check(`past_days over ${MAX_PAST_DAYS} throws rather than silently truncating`, threw, true);
}

console.log("\n=== response shaping ===");
{
  const rows = shapeArchiveResponse([{ hourly: hourly(0) }, { hourly: hourly(500) }], groups);
  check("one row per trail per hour", rows.length, TRAILS.length * 2);
  check("row is [key, hour_ts, ...ARCHIVE_VARS]", rows[0].length, ARCHIVE_VARS.length + 2);
  check("hour_ts is a number, not a string", typeof rows[0][1], "number");

  const alpha = rows.filter((r) => r[0] === "alpha");
  const beta = rows.filter((r) => r[0] === "beta");
  check("co-located trailheads get identical values", alpha.map((r) => r.slice(1)), beta.map((r) => r.slice(1)));
  const gamma = rows.find((r) => r[0] === "gamma");
  check("a separate location does NOT", gamma[2] === alpha[0][2], false);

  // The rule that keeps a backfilled gap distinguishable from a dry hour.
  const withNull = structuredClone(hourly(0));
  withNull.precipitation = [null, 5];
  const nulled = shapeArchiveResponse([{ hourly: withNull }, { hourly: hourly(0) }], groups);
  check("a null stays NULL, it does not become 0", nulled[0][2], null);

  let threw = false;
  try { shapeArchiveResponse([{ hourly: hourly(0) }], groups); } catch { threw = true; }
  check("a short location array throws", threw, true);
}

console.log("\n=== forecast vintages ===");
{
  const rows = shapeForecastSnapshot([{ hourly: hourly(0) }, { hourly: hourly(0) }], groups, 9999);
  check("one row per trail", rows.length, TRAILS.length);
  check("carries the snapshot time", rows[0][1], 9999);
  check("horizon is the first hour covered", rows[0][2], 1000);
  check("arrays are stored as JSON text", typeof rows[0][3], "string");
  check("and round-trip", JSON.parse(rows[0][3]), [1000, 4600]);
}

console.log("\n=== catch-up arithmetic ===");
{
  const hour = currentHourTs(new Date("2026-09-04T12:34:56.000Z"));
  check("currentHourTs floors to the hour", new Date(hour * 1000).toISOString(), "2026-09-04T12:00:00.000Z");
  check("an empty table reaches back 48h", catchupFloor(null, hour), hour - 48 * 3600);
  check("the hour after the last stored one", catchupFloor(hour - 3 * 3600, hour), hour - 2 * 3600);
  // The guard that makes 11 of every 12 cron runs a no-op.
  check("already-recorded hour yields a floor above it", catchupFloor(hour, hour) > hour, true);
  check("a long outage is capped at 48h, not unbounded", catchupFloor(hour - 500 * 3600, hour), hour - 48 * 3600);
}

console.log("\n=== reported_at -> reported_ts ===");
{
  const observed = "2026-09-01T06:00:00.000Z";
  check("relative resolves against observed_at", parseReportedAt("2 mins", observed), "2026-09-01T05:58:00.000Z");
  check("'5 min' singular too", parseReportedAt("5 min", observed), "2026-09-01T05:55:00.000Z");
  check("hours", parseReportedAt("3 hours", observed), "2026-09-01T03:00:00.000Z");
  // Day-granular values stay 10 chars so a reader can tell the precision apart.
  check("an absolute date stays date-only", parseReportedAt("Jul 17, 2026", observed), "2026-07-17");
  check("...and is 10 chars, the precision marker", parseReportedAt("Nov 14, 2025", observed).length, 10);
  check("a resolved relative time is longer than 10", parseReportedAt("2 mins", observed).length > 10, true);
  check("unrecognised text is NULL, not a guess", parseReportedAt("just now", observed), null);
  check("empty is NULL", parseReportedAt("", observed), null);
}

console.log("\n=== standing closures (Big Cedar: Sunday + Monday) ===");
{
  const { scheduledOverlap, localDow } = await import("../scripts/build-episodes.js");
  const { TRAILS } = await import("../public/trails.js");
  const bigCedar = TRAILS.find((t) => t.key === "big-cedar");
  const plain = TRAILS.find((t) => t.key === "northshore");
  const ts = (iso) => Date.parse(iso) / 1000;

  check("Big Cedar carries a schedule", bigCedar.scheduledClosure.days, [0, 1]);
  // 2026-08-30T05:15Z is Sunday 00:15 LOCAL — the UTC day is already the 30th,
  // so getUTCDay() would answer Sunday here by luck and Monday an hour later.
  check("weekday is local, not UTC", localDow(ts("2026-08-31T02:40:00Z")), 0);

  // The two real episodes in the archive.
  check("Sunday-morning closure is flagged",
    scheduledOverlap(bigCedar, ts("2026-08-30T05:00:00Z"), ts("2026-08-30T17:59:00Z")), 1);
  // Closes 9:40pm Sunday, reopens 1am TUESDAY — the overhang the grace absorbs.
  check("Monday closure reopening after midnight is flagged",
    scheduledOverlap(bigCedar, ts("2026-08-31T02:38:00Z"), ts("2026-09-01T05:58:00Z")), 1);

  // A closure that starts on a scheduled day but runs deep into the week is a
  // weather closure wearing a Sunday hat, and must NOT be written off.
  check("Sunday -> Thursday is NOT written off as scheduled",
    scheduledOverlap(bigCedar, ts("2026-08-30T05:00:00Z"), ts("2026-09-03T17:00:00Z")), 0);
  check("a Wednesday closure is not scheduled",
    scheduledOverlap(bigCedar, ts("2026-09-02T14:00:00Z"), ts("2026-09-03T14:00:00Z")), 0);
  check("a trail with no schedule never flags",
    scheduledOverlap(plain, ts("2026-08-30T05:00:00Z"), ts("2026-08-30T17:59:00Z")), 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
