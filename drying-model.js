// The drying model: one water bucket per trail, filled by rain and emptied by
// drying, that says when a closed trail should reopen and when an open one is
// about to close.
//
//   W ← min(cap, max(0, W + rain − k · dry))      every hour
//   closes when W ≥ close        reopens when W ≤ open
//
// `rain` is observedRain() (MRMS radar, NBM fill, HRRR before 2026-10-01) — the
// one accessor, imported rather than restated. `dry` is one of two variants, and
// scripts/fit-drying-model.js keeps whichever predicts the real reopenings
// better:
//   "et0"  — et0_in, FAO reference evapotranspiration in inches. Already folds
//            temperature, humidity, wind and sun into one number, and shares
//            rain's unit, so the bucket is a plain water balance.
//   "temp" — degree-hours above a base temperature. Simpler, but blind to the
//            cloudy, humid days after a storm, when nothing dries.
//
// Few parameters on purpose. Every trail in the region sees the same storm, so
// the archive holds a handful of independent events, not hundreds (CLAUDE.md,
// "Expect the model to be a year away"). Drying rate `k` is per soil
// hydrologic group, with a per-trail multiplier shrunk toward 1; `cap` stops a
// 4-inch storm counting four times a 1-inch one, because the ground saturates
// and the rest runs off.
//
// Pure — no D1, no fetch, no Node imports — so the Worker can bundle it and the
// fit script, the live predictor and verify/ all run the identical code.

import { observedRain } from "./closure-classify.js";

const HOUR = 3600;

// Inches of "drying" per degree-hour above the base. Only fixes the scale so a
// fitted `k` lands near 1 for both variants; any constant would do.
const TEMP_SCALE = 0.0005;

export function dryAmount(row, params) {
  if (params.variant === "temp") {
    if (row.temp_f == null) return 0;
    return Math.max(0, row.temp_f - params.tBase) * TEMP_SCALE;
  }
  return row.et0_in ?? 0;
}

// The drying rate for one trail: its soil group's rate times its own
// multiplier. A trail with no fitted multiplier, or a group with no fitted
// rate, falls back to the pooled value rather than to nothing.
export function trailRate(trail, params) {
  const group = params.k[trail?.hydGroup] ?? params.kAll;
  const mult = params.trailMult?.[trail?.key] ?? 1;
  return group * mult;
}

// Steps the bucket through `rows` (sorted by hour_ts, one trail). Returns every
// hour's level, so a caller can read the level at any moment or scan forward.
// An hour the archive is missing contributes nothing — neither rain nor drying —
// rather than an invented value.
export function simulate(rows, trail, params, w0 = 0) {
  const k = trailRate(trail, params);
  let w = w0;
  const out = [];
  for (const r of rows) {
    w = Math.min(params.cap, Math.max(0, w + observedRain(r) - k * dryAmount(r, params)));
    out.push({ hour_ts: r.hour_ts, w });
  }
  return out;
}

export function levelAt(series, ts) {
  let level = null;
  for (const p of series) {
    if (p.hour_ts > ts) break;
    level = p.w;
  }
  return level;
}

// Stewards reopen in daylight, after walking the trail. A bucket that drains at
// 3am does not mean a 3am reopening; it means the first check after it. The
// window is local time, learned from the archive by the fit.
export function localHour(ts, tz = "America/Chicago") {
  return Number(new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hour12: false })
    .format(new Date(ts * 1000))) % 24;
}

export function snapToWindow(ts, window) {
  if (!window) return ts;
  let t = ts;
  for (let i = 0; i < 48; i++) {
    const h = localHour(t);
    if (h >= window.from && h < window.to) return t;
    t = Math.floor(t / HOUR) * HOUR + HOUR;
  }
  return ts;
}

// When will this closed trail reopen? `series` is simulate()'s output over the
// observed hours and then the forecast hours, in order. The answer is the first
// hour after `closedTs` at which the bucket has drained to `open`, snapped to
// the steward's daylight window. null when it never drains within the series —
// the forecast simply does not reach far enough to say.
//
// The bucket must have been wet first. Stewards close ahead of the rain, so at
// closedTs the bucket can still be empty, and "first hour it is below `open`"
// would answer "immediately" for a trail about to take two inches. Wetness is
// looked for from LOOKBACK before the closure, so a storm that is already over
// when the gate shuts still counts. A bucket that never got wet at all — the
// rain stayed below `open` — gets NO prediction, and neither does one whose
// rain has not arrived within WET_BY of the closure. The rain does not explain
// such a closure, so the model has nothing to say about it: Sister Grove shut on
// 2026-09-28, two days before any rain, and stayed shut 277 h. Guessing "reopens
// now" was 270 h wrong, and attributing a later storm instead predicted
// Waterloo's dry 2026-09-20 closure to last until the Oct 1 storm drained.
const LOOKBACK = 72 * HOUR;
const WET_BY = 24 * HOUR;

// Did the rain explain this closure — was the bucket above `open` at some point
// from LOOKBACK before it to WET_BY after it?
export function wasWetted(series, closedTs, params) {
  return series.some((p) =>
    p.hour_ts >= closedTs - LOOKBACK && p.hour_ts <= closedTs + WET_BY && p.w > params.open);
}

export function predictReopen(series, closedTs, params) {
  if (!wasWetted(series, closedTs, params)) return null;
  let wet = false;
  for (const p of series) {
    if (p.hour_ts < closedTs - LOOKBACK) continue;
    if (p.w > params.open) wet = true;
    if (p.hour_ts <= closedTs) continue;
    if (wet && p.w <= params.open) return snapToWindow(p.hour_ts, params.reopenWindow);
  }
  return null;
}

// Will this open trail close? The first hour after `fromTs` where the bucket
// RISES through `close`, or null. A crossing, not a level: a trail the steward
// has already reopened while the model still reads it wet is not "about to
// close". Forecast rain is weighted by its probability by the caller, so a 30%
// chance of an inch counts as 0.3 in, not a closure.
export function predictClose(series, fromTs, params) {
  let prev = null;
  for (const p of series) {
    if (p.hour_ts > fromTs && prev !== null && prev < params.close && p.w >= params.close) return p.hour_ts;
    prev = p.w;
  }
  return null;
}
