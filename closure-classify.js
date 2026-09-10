// Why a trail is closed — the question that must be answered BEFORE any
// reopening prediction is attempted.
//
// "When will this trail open next?" is only a weather question for closures the
// weather caused. For a standing schedule the answer is a calendar lookup; for a
// concert it is unknowable; for a trail shut since March it is not a drying
// question at all. A model that answers all of them with a drying curve is
// confidently wrong three times out of four, and the archive says so: of the
// closures recorded so far, ZERO were drying events.
//
// So this classifies first and predicts never. It is deliberately shared between
// the retrospective path (scripts/build-episodes.js, labelling training rows)
// and any future live path (classifying a closure the moment it happens, with no
// reopen to look at yet) — the same reason public/weather.js is the one place a
// request is built. A live classifier and a training labeller that disagree
// would mean fitting on one definition and predicting on another.
//
// THE STATUS FIELD CANNOT TELL YOU THIS. 55 of the 58 trailheads are Trailforks
// "regions", which report a bare Open/Closed with no condition; only 3 report the
// Ideal/Dry/Wet/Prevalent Mud vocabulary. Wetness therefore has to be inferred
// from the weather archive for almost the whole network. That is the entire
// reason weather_hourly exists.

const HOUR = 3600;

// Matches build-episodes.js, and lives here so the two cannot drift apart.
export const NO_RAIN_IN = 0.05;      // inches over the look-back window
export const NO_SOIL_RISE = 0.05;    // m³/m³ rise above the preceding baseline
export const WET_LOOKBACK_H = 72;

// Past this, a closure is not a drying event whatever the weather did. Nothing
// in North Texas takes three weeks to dry; a trail still shut after that is
// closed for a reason the weather cannot explain — construction, a lease
// dispute, a bridge out. Several trails in this network have carried a Closed
// status since before the archive existed, with Trailforks dates as old as
// March 2026, and they must never enter a drying fit.
export const STALE_CLOSURE_DAYS = 21;

function rainfall(rows, from, to) {
  return rows.reduce((a, r) => (r.hour_ts >= from && r.hour_ts < to ? a + (r.precip_in || 0) : a), 0);
}

// How much wetter the ground got before the closure, against its own baseline a
// week earlier. Absolute soil moisture is not comparable between trails — sand
// and clay sit at different resting values — but a RISE is.
export function soilRise(rows, at, lookbackH = WET_LOOKBACK_H) {
  const win = rows.filter((r) => r.hour_ts >= at - lookbackH * HOUR && r.hour_ts <= at)
    .map((r) => r.soil_moist_0_1).filter((v) => v != null);
  const base = rows.filter((r) => r.hour_ts >= at - 10 * 24 * HOUR && r.hour_ts < at - lookbackH * HOUR)
    .map((r) => r.soil_moist_0_1).filter((v) => v != null);
  if (!win.length || !base.length) return null;
  return Math.max(...win) - base.reduce((a, b) => a + b, 0) / base.length;
}

// The moment the ground last got wet — NOT the moment the trail closed.
//
// The drying clock does not start when a steward flips a switch, and it RESTARTS
// if it rains again mid-closure. Anchoring a prediction to closed_at quietly
// assumes the trail began drying the instant it shut, which is wrong whenever
// the rain continued afterwards — exactly the multi-day storm case where an
// accurate answer matters most.
export function lastWettingHour(rows, from, to) {
  let last = null;
  for (const r of rows) {
    if (r.hour_ts < from || r.hour_ts > to) continue;
    if ((r.precip_in || 0) >= 0.01) last = r.hour_ts;
  }
  return last;
}

export function localDow(ts, tz = "America/Chicago") {
  const d = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(new Date(ts * 1000));
  return { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[d];
}

export function knownNonWeather(trail, closedTs) {
  const list = trail?.knownNonWeatherClosures;
  if (!list?.length) return null;
  const day = new Date(closedTs * 1000).toISOString().slice(0, 10);
  const hit = list.find((c) => day >= c.from && (c.to === null || day <= c.to));
  return hit ? hit.reason : null;
}

// A scheduled closure does not begin at midnight. Big Cedar's SUNDAY closure was
// observed starting 11:28pm SATURDAY local — a steward shutting the gate before
// going to bed — and a bare weekday test called that Saturday, missed the
// schedule, and promoted a routine closure to the archive's only "usable drying
// event" with zero rainfall behind it. That is the precise corruption this whole
// classifier exists to prevent, so the window leads as well as trails.
//
// LEAD_GRACE_H is one-sided and small: it asks "is this closure the start of a
// scheduled day?", not "is it near one". Six hours reaches back across an
// evening without reaching back across an afternoon.
export const LEAD_GRACE_H = 6;

export function onScheduledDay(trail, ts) {
  const days = trail?.scheduledClosure?.days;
  if (!days?.length) return false;
  return days.includes(localDow(ts)) || days.includes(localDow(ts + LEAD_GRACE_H * 3600));
}

/**
 * Classify a closure using only what is knowable AT CLOSURE TIME — no reopen.
 * That constraint is the point: a live predictor has no reopen to look at, and a
 * labeller that used one would be training on information prediction never has.
 *
 * Returns { category, predictable, reason, ... }. `predictable` is the gate:
 * only a weather closure gets a drying prediction. Everything else must decline
 * to answer rather than emit a date it cannot justify.
 */
export function classifyClosure(trail, closedTs, weatherRows = [], now = Date.now() / 1000) {
  const known = knownNonWeather(trail, closedTs);
  const rain = rainfall(weatherRows, closedTs - WET_LOOKBACK_H * HOUR, closedTs);
  const rise = soilRise(weatherRows, closedTs);
  const wet = rain >= NO_RAIN_IN || (rise !== null && rise >= NO_SOIL_RISE);
  const base = { rain_72h: +rain.toFixed(3), soil_rise: rise === null ? null : +rise.toFixed(3) };

  // Order matters. A recorded human cause outranks everything, because it is the
  // only input here that is actually ground truth rather than inference.
  if (known) {
    return { ...base, category: "known-non-weather", predictable: false, reason: known };
  }
  if (onScheduledDay(trail, closedTs)) {
    return { ...base, category: "scheduled", predictable: false,
      reason: "closed on a standing scheduled-closure day; reopening is a calendar lookup, not a drying curve" };
  }
  if ((now - closedTs) / 86400 > STALE_CLOSURE_DAYS) {
    return { ...base, category: "stale", predictable: false,
      reason: `closed longer than ${STALE_CLOSURE_DAYS} days; nothing here takes that long to dry` };
  }
  if (!wet) {
    // The important refusal. No rain AND no soil-moisture rise means something
    // else shut this trail, and we do not know what — so we say so rather than
    // predicting a dry-out that was never happening.
    return { ...base, category: "unexplained", predictable: false,
      reason: "no rain and no soil-moisture rise before closing; cause unknown, so no drying prediction" };
  }
  // Rain and soil moisture disagreeing is still a weather closure — it is the
  // MAGNITUDE that is in doubt, not the fact. Flagged so a fit can down-weight
  // it rather than silently trusting the wrong column.
  const disputed = rain < NO_RAIN_IN && rise !== null && rise >= NO_SOIL_RISE;
  return {
    ...base,
    category: "weather",
    predictable: true,
    disputed,
    wetted_at: lastWettingHour(weatherRows, closedTs - WET_LOOKBACK_H * HOUR, now),
    reason: disputed
      ? "soil moisture rose but the rainfall column disagrees; treat the amount as uncertain"
      : "rain and/or soil moisture rose before closing"
  };
}
