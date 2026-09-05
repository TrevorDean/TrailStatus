// Derives the training table: one row per closure episode, weather joined.
//
// This is the artifact to actually stare at — not weather_hourly, not
// status_events, but the join of the two that answers "the trail took N hours to
// reopen after M inches of rain, on this soil, in this month". It writes nothing
// to D1; it is a read-only view built fresh each time, so re-deriving after a
// definition changes costs nothing and leaves no stale copy behind.
//
//   node scripts/build-episodes.js              # local D1
//   node scripts/build-episodes.js --remote     # the real archive
//   node scripts/build-episodes.js --remote --csv > episodes.csv
//
// Reads through `wrangler d1 execute`, so it needs no CLOUDFLARE_API_TOKEN —
// wrangler's own OAuth session covers it.

import { execFileSync } from "node:child_process";
import { TRAILS } from "../public/trails.js";

const DB = "ntx-history";
const HOUR = 3600;

// Mirrors statusClassFor() in public/script.js: Wet and Prevalent Mud sit in the
// same bucket as Closed, because all three mean "do not ride". That is a
// MODELLING CHOICE, not a fact about the data — status_events stores every
// status verbatim precisely so this line can be redrawn later without a
// re-scrape. If it changes here, change it there too or the site and the model
// will disagree about what a closure is.
export function isClosedStatus(status) {
  const s = String(status || "").toLowerCase();
  return s.includes("closed") || s.includes("wet") || s.includes("mud");
}

function query(sql, remote) {
  const args = ["wrangler", "d1", "execute", DB, "--json", `--command=${sql}`];
  if (remote) args.push("--remote");
  const out = execFileSync("npx", args, { encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });
  return JSON.parse(out.slice(out.indexOf("[")))[0].results || [];
}

// Trailforks' own action time when we have it at full precision, else when the
// scraper saw it. A 10-character reported_ts is day-granular (see history.js) and
// is deliberately NOT preferred — for a transition this archive actually watched,
// observed_at is the more precise of the two.
function eventTime(row) {
  if (row.reported_ts && row.reported_ts.length > 10) return Date.parse(row.reported_ts) / 1000;
  return Date.parse(row.observed_at) / 1000;
}

// Local weekday, America/Chicago. A standing closure is defined by the day a
// human experiences, so UTC is the wrong frame: Big Cedar's Monday closure
// starts around 9:40pm Sunday LOCAL, which is already Monday in UTC.
const DOW = new Intl.DateTimeFormat("en-US", { timeZone: "America/Chicago", weekday: "short" });
const DAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function localDow(ts) {
  return DAYS[DOW.format(new Date(ts * 1000))];
}

// Some trails close on a fixed schedule regardless of weather — Big Cedar is
// shut Sunday morning and all day Monday. Those episodes are REAL closures and
// belong in the archive, but they are not drying events: a model fitted on them
// learns that trails reopen on Tuesdays, which is true and useless.
//
// This flags rather than filters. Dropping data is the modeller's call at fit
// time, not this script's at derive time, and a mis-set schedule that silently
// deleted rows would be far harder to notice than one that mislabels them.
// A steward does not reopen at the stroke of midnight, so the closure spills
// past its own schedule: Big Cedar's Monday closure ends at 1:00am TUESDAY,
// and a strict "every hour is a scheduled day" test rejects it over that one
// hour. The trailing grace absorbs that overhang. It is deliberately one-sided
// — the closure must still START on a scheduled day — so a genuine weather
// closure that happens to begin on a Sunday and run to Thursday is not
// swallowed by it.
const REOPEN_GRACE = 6 * 3600;

export function scheduledOverlap(trail, closedTs, openedTs) {
  const days = trail?.scheduledClosure?.days;
  if (!days?.length) return 0;
  if (!days.includes(localDow(closedTs))) return 0;
  for (let t = closedTs; t < openedTs - REOPEN_GRACE; t += 3600) {
    if (!days.includes(localDow(t))) return 0;
  }
  return 1;
}

// A closure with no weather behind it did not happen for weather reasons, and
// must not teach the model that trails close out of a clear sky. Mineola was
// shut on 2026-09-04 for a CONCERT; Big Cedar shuts on a schedule. Neither is a
// drying event, and both were invisible in the data until someone said so.
//
// Two signals, not one, and the second is the important one. Judging by rainfall
// alone would be wrong here: precip_in comes from HRRR while soil moisture comes
// from ICON, and on 2026-09-03 at Mineola they disagreed 27-fold (0.03 in vs
// 0.80 in). A rain-only rule would therefore also discard REAL rain closures
// that HRRR happened to miss — the opposite error, and a much more expensive one
// because those are the rows the model actually needs.
//
// So a closure is only called weatherless when BOTH agree nothing happened: no
// meaningful rain AND no rise in soil moisture. If rainfall says nothing but the
// ground got wetter, that is a disagreement to investigate, not a closure to
// throw away.
const NO_RAIN_IN = 0.05;        // inches over the 72h before closing
const NO_SOIL_RISE = 0.05;      // m³/m³ rise vs the week before

// How much wetter the ground got in the run-up, versus its baseline a week out.
function soilRise(rows, closedTs) {
  const window = rows.filter((r) => r.hour_ts >= closedTs - 72 * HOUR && r.hour_ts <= closedTs)
    .map((r) => r.soil_moist_0_1).filter((v) => v != null);
  const baseline = rows.filter((r) => r.hour_ts >= closedTs - 10 * 24 * HOUR && r.hour_ts < closedTs - 72 * HOUR)
    .map((r) => r.soil_moist_0_1).filter((v) => v != null);
  if (!window.length || !baseline.length) return null;
  return Math.max(...window) - (baseline.reduce((a, b) => a + b, 0) / baseline.length);
}

// Ground truth the weather can never supply. The automated test above did NOT
// catch Mineola's 2026-09-04 closure: it was a concert, but ICON rain fell two
// days earlier, so the soil DID get wetter and the episode reads as a genuine
// drying event. Only a human knew otherwise. Hence this: a place to record a
// cause that no column can show, keyed to the date the closure began.
export function knownNonWeather(trail, closedTs) {
  const list = trail?.knownNonWeatherClosures;
  if (!list?.length) return null;
  const day = new Date(closedTs * 1000).toISOString().slice(0, 10);
  const hit = list.find((c) => day >= c.from && (c.to === null || day <= c.to));
  return hit ? hit.reason : null;
}

function sum(rows, field, from, to) {
  return rows.reduce((acc, r) => (r.hour_ts >= from && r.hour_ts < to ? acc + (r[field] || 0) : acc), 0);
}

// Guarded so verify/ can import scheduledOverlap() without the module shelling
// out to wrangler on import.
const isMain = process.argv[1] && process.argv[1].endsWith("build-episodes.js");

(async () => {
  if (!isMain) return;
  const remote = process.argv.includes("--remote");
  const csv = process.argv.includes("--csv");

  const events = query(
    "SELECT trail_key, prev_status, status, reported_ts, observed_at FROM status_events ORDER BY trail_key, observed_at",
    remote
  );
  const weather = query(
    "SELECT trail_key, hour_ts, precip_in, et0_in, soil_moist_0_1, temp_f FROM weather_hourly ORDER BY trail_key, hour_ts",
    remote
  );

  const byTrailWeather = {};
  for (const w of weather) (byTrailWeather[w.trail_key] ||= []).push(w);

  const meta = Object.fromEntries(TRAILS.map((t) => [t.key, t]));
  const episodes = [];

  const byTrail = {};
  for (const e of events) (byTrail[e.trail_key] ||= []).push(e);

  for (const [key, list] of Object.entries(byTrail)) {
    let closedAt = null;
    for (const e of list) {
      const closed = isClosedStatus(e.status);
      // A first observation (prev_status NULL) that is already closed opens an
      // episode with an UNKNOWN start — the trail had been closed for some time
      // before the archive existed. Those are marked, not silently timed from
      // the moment we happened to start watching.
      if (closed && closedAt === null) {
        closedAt = { ts: eventTime(e), seeded: e.prev_status === null };
      } else if (!closed && closedAt !== null) {
        const openedTs = eventTime(e);
        const w = byTrailWeather[key] || [];
        const t = meta[key] || {};
        const rain72 = sum(w, "precip_in", closedAt.ts - 72 * HOUR, closedAt.ts);
        const rise = soilRise(w, closedAt.ts);
        const known = knownNonWeather(t, closedAt.ts);
        episodes.push({
          trail_key: key,
          org: t.lta || "",
          hyd_group: t.hydGroup || "",
          soil_series: t.soilSeries || "",
          closed_at: new Date(closedAt.ts * 1000).toISOString(),
          opened_at: new Date(openedTs * 1000).toISOString(),
          // A seeded episode's duration is a LOWER BOUND, never a duration.
          // Averaging it in with real ones biases every fit downward.
          start_known: closedAt.seeded ? 0 : 1,
          hours_closed: +((openedTs - closedAt.ts) / HOUR).toFixed(2),
          rain_72h_before: +rain72.toFixed(3),
          rain_during: +sum(w, "precip_in", closedAt.ts, openedTs).toFixed(3),
          et0_during: +sum(w, "et0_in", closedAt.ts, openedTs).toFixed(3),
          soil_moist_at_open: w.find((x) => x.hour_ts >= openedTs - HOUR)?.soil_moist_0_1 ?? null,
          // 1 = every hour of this closure fell on a scheduled-closure day, so
          // the schedule alone explains it. Exclude these before fitting.
          scheduled: scheduledOverlap(t, closedAt.ts, openedTs),
          soil_rise_before: rise === null ? null : +rise.toFixed(3),
          // A recorded human cause always wins over the inferred flags below.
          known_cause: known,
          // 1 = neither rainfall NOR soil moisture shows anything happened, so
          // whatever closed this trail, it was not the weather. EXCLUDE these
          // before fitting; they are closures, but not drying events.
          no_weather_signal: known ? 1 : (rain72 < NO_RAIN_IN && rise !== null && rise < NO_SOIL_RISE) ? 1 : 0,
          // 1 = the two models disagree about whether it rained. Not a verdict,
          // a flag to go and look: one of the two columns is wrong.
          model_disagreement: (rain72 < NO_RAIN_IN && rise !== null && rise >= NO_SOIL_RISE) ? 1 : 0,
          month: new Date(openedTs * 1000).getUTCMonth() + 1,
          closed_dow_local: localDow(closedAt.ts),
          opened_dow_local: localDow(openedTs),
          opened_hour_local: Number(new Intl.DateTimeFormat("en-US", {
            timeZone: "America/Chicago", hour: "2-digit", hour12: false
          }).format(new Date(openedTs * 1000)))
        });
        closedAt = null;
      }
    }
  }

  episodes.sort((a, b) => a.opened_at.localeCompare(b.opened_at));

  if (csv) {
    if (episodes.length === 0) return;
    const cols = Object.keys(episodes[0]);
    console.log(cols.join(","));
    for (const e of episodes) console.log(cols.map((c) => JSON.stringify(e[c] ?? "")).join(","));
    return;
  }

  console.log(`${events.length} status events, ${weather.length} weather hours`);
  const scheduled = episodes.filter((e) => e.scheduled).length;
  const weatherless = episodes.filter((e) => e.no_weather_signal && !e.scheduled).length;
  const knownCause = episodes.filter((e) => e.known_cause).length;
  const disputed = episodes.filter((e) => e.model_disagreement).length;
  const usable = episodes.filter((e) => !e.scheduled && !e.no_weather_signal).length;
  console.log(`${episodes.length} closure episode(s), ${episodes.filter((e) => e.start_known).length} with a known start`);
  console.log(`  ${scheduled} on a standing schedule (exclude)`);
  console.log(`  ${weatherless} with NO weather signal at all (exclude — something else closed it)`);
  console.log(`  ${knownCause} with a RECORDED non-weather cause (exclude — a human told us why)`);
  console.log(`  ${disputed} where rainfall and soil moisture DISAGREE (investigate before using)`);
  console.log(`  ${usable} usable as drying events\n`);
  if (episodes.length === 0) {
    console.log("No completed closures yet — a trail must go closed AND reopen to make an episode.");
    return;
  }
  console.table(episodes.map((e) => ({
    trail: e.trail_key,
    hyd: e.hyd_group,
    closed: e.closed_at.slice(0, 16),
    opened: e.opened_at.slice(0, 16),
    hrs: e.hours_closed,
    known: e.start_known ? "y" : "n",
    sched: e.scheduled ? "y" : "",
    noWx: e.no_weather_signal ? "y" : "",
    dispute: e.model_disagreement ? "y" : "",
    "rain72h": e.rain_72h_before,
    "et0": e.et0_during
  })));
})();
