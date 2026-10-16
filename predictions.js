// Live reopening and closing predictions, written hourly to KV
// "trail_predictions" and served at GET /api/predictions.
//
// For every trailhead: run the drying model (drying-model.js) over the last ten
// days of observed rain and ET0, then on through a seven-day forecast, and read
// off when the bucket drains (a closed trail) or fills (an open one). The
// parameters are public/drying-params.js, fitted offline by
// scripts/fit-drying-model.js — nothing is learned here.
//
// Only a closure the weather caused gets a reopening time. The classifier
// (closure-classify.js) is the gate, the same one that labelled the training
// data: a scheduled closure, a known event, a stale closure or one the rain does
// not explain all get a `basis` saying why and no time. Declining is the right
// answer for those; a drying curve applied to a concert is confidently wrong.
//
// KV, not D1: the result is one small value replaced every hour, and D1's
// write quota is account-wide (CLAUDE.md, the 2026-09-04 outage). Reads are
// ~30k rows an hour from D1, well inside the free tier.

import { TRAILS } from "./public/trails.js";
import { DRYING_PARAMS } from "./public/drying-params.js";
import { fetchPredictionForecast } from "./public/weather.js";
import { isClosedStatus, isRideableStatus } from "./public/status-buckets.js";
import { classifyClosure, eventTime, mergeRain, scheduledReopen, pastSchedule, inScheduledClosure } from "./closure-classify.js";
import { simulate, predictReopen, predictClose, wasWetted, levelAt, snapToWindow } from "./drying-model.js";

const HOUR = 3600;
// Per environment, because staging shares production's KV namespace: on
// 2026-10-13 one stray staging cron run (its trigger was still propagating
// after being removed) wrote 58 "no-data" predictions built from the staging
// database over production's. Staging sets PREDICTIONS_KEY in wrangler.toml.
const kvKey = (env) => env.PREDICTIONS_KEY || "trail_predictions";
const HISTORY_DAYS = 10;      // spin-up: a full bucket drains well inside this
const EVENTS_DAYS = 30;       // how far back to look for when a closure began
const CLOSE_HORIZON_H = 48;   // only warn about a closure this close
const REFRESH_S = 55 * 60;
const SOIL_BASELINE = (72 + 10 * 24) * HOUR; // classifyClosure's look-back + soilRise's baseline

// The moment each trail's CURRENT closure began: the first closed status after
// its last rideable one. null when it is not closed, or when the closure is
// older than the events read — too old to be a drying event anyway.
//
// A closure first seen as a first-ever observation, or as a closed-to-closed
// change (Closed → Wet) with no rideable status before it in the window, began
// at some unknown earlier time, and is null rather than timed from when we
// happened to see it.
export function closureStarts(events) {
  const starts = {};
  for (const e of events) {
    if (!isClosedStatus(e.status)) {
      delete starts[e.trail_key];
    } else if (!(e.trail_key in starts)) {
      const knownStart = e.prev_status !== null && !isClosedStatus(e.prev_status);
      starts[e.trail_key] = knownStart ? eventTime(e) : null;
    }
  }
  return starts;
}

// The first forecast closure that matters. A crossing inside a scheduled window
// is moot — the trail is shut then anyway — unless the bucket is still over
// `close` when the window ends, in which case that is when it fails to reopen.
function closeOutsideSchedule(trail, series, now, params) {
  for (let from = now, i = 0; i < 10; i++) {
    const close = predictClose(series, from, params);
    if (close === null || !inScheduledClosure(trail, close)) return close;
    const end = scheduledReopen(trail, close);
    if ((levelAt(series, end) ?? 0) >= params.close) return end;
    from = end;
  }
  return null;
}

// One trail's prediction. Pure, so verify/ can drive it with synthetic rows.
export function predictTrail(trail, status, closedTs, observed, forecast, now, params = DRYING_PARAMS) {
  if (!observed.length) return { basis: "no-data" };
  const lastObs = observed[observed.length - 1].hour_ts;
  const rows = observed.concat((forecast || []).filter((r) => r.hour_ts > lastObs));
  const series = simulate(rows, trail, params);
  const w = +(levelAt(series, now) ?? 0).toFixed(3);

  if (isClosedStatus(status)) {
    if (closedTs == null) return { basis: "unknown-start", w };
    let cls = classifyClosure(trail, closedTs, observed, now);
    // A scheduled closure reopens when its window ends — unless the trail will
    // be too wet by then, or already is still shut past it. Either way the
    // question becomes a drying one, timed from the window's end: the rain that
    // fell during Big Cedar's Monday closure decides whether it opens Tuesday.
    if (cls.category === "scheduled") {
      const end = scheduledReopen(trail, closedTs);
      if (end > now && (levelAt(series, end) ?? 0) < params.close) return { basis: "scheduled", reopenAt: end, w };
      if (end <= now) cls = classifyClosure(trail, end, observed, now);
      else cls = { predictable: true };
      closedTs = end;
    }
    if (!cls.predictable) return { basis: cls.category, w };
    if (!wasWetted(series, closedTs, params)) return { basis: "unexplained", w };
    let reopen = predictReopen(series, closedTs, params);
    if (reopen === null) return { basis: "weather", reopenAfter: rows[rows.length - 1].hour_ts, w };
    reopen = pastSchedule(trail, reopen);
    // The bucket has already drained but the steward has not reopened yet:
    // "any time now", pinned to the next steward window rather than the past —
    // but only within the model's own error band. Past that, the drying model
    // no longer explains why the trail is shut (Fossil Creek was still closed a
    // week after its bucket emptied), so it says nothing rather than repeating
    // "any time now" for days.
    if (reopen <= now) {
      if (now - reopen > params.bandHours * HOUR) return { basis: "overdue", w };
      return { basis: "weather", reopenAt: pastSchedule(trail, snapToWindow(now + HOUR, params.reopenWindow)), overdue: true, w };
    }
    return { basis: "weather", reopenAt: reopen, w };
  }

  if (isRideableStatus(status)) {
    const close = closeOutsideSchedule(trail, series, now, params);
    if (close !== null && close - now <= CLOSE_HORIZON_H * HOUR) return { basis: "forecast", closeAt: close, w };
    return { basis: "open", w };
  }
  return { basis: "unknown-status" };
}

export async function recordPredictions(env, now = Date.now() / 1000) {
  if (!env.TRAIL_CACHE || !env.TRAIL_HISTORY) return { skipped: "no bindings" };
  const existing = await env.TRAIL_CACHE.get(kvKey(env), { type: "json" });
  if (existing?.updatedAt && now - Date.parse(existing.updatedAt) / 1000 < REFRESH_S) return { skipped: "fresh" };

  const db = env.TRAIL_HISTORY;
  const eventsSince = new Date((now - EVENTS_DAYS * 24 * HOUR) * 1000).toISOString();
  const [state, events] = await Promise.all([
    db.prepare("SELECT trail_key, status FROM trail_state").all(),
    db.prepare("SELECT trail_key, prev_status, status, reported_ts, observed_at FROM status_events WHERE observed_at >= ? ORDER BY trail_key, observed_at").bind(eventsSince).all()
  ]);
  const statusOf = Object.fromEntries((state.results || []).map((s) => [s.trail_key, s.status]));
  const starts = closureStarts(events.results || []);

  // Ten days covers every open trail. A closed one needs its rows back past the
  // closure — the classifier looks 72 h before it, and the soil baseline ten
  // days before that — so the few trails closed longer get one more read,
  // reaching from their own closure. Without it, a trail still shut from the
  // Oct 1 storm read as "unexplained": the rain had slid out of the window.
  const since = Math.floor(now - HISTORY_DAYS * 24 * HOUR);
  const older = Object.entries(starts)
    .filter(([key, ts]) => ts != null && isClosedStatus(statusOf[key]) && ts - SOIL_BASELINE < since);
  const olderSince = older.length ? Math.floor(Math.min(...older.map(([, ts]) => ts)) - SOIL_BASELINE) : null;
  const olderKeys = older.map(([key]) => key);
  const inKeys = olderKeys.map(() => "?").join(",");
  // rain_hourly's only index is its (trail_key, hour_ts) primary key, so a bare
  // `hour_ts >= ?` scans the whole, ever-growing table. Naming every key turns
  // it into 58 range seeks — measured 2026-10-13: 14k rows read instead of 19k,
  // and flat from here on rather than rising by 1,400 a day. 58 keys + 1 is 59
  // bound parameters; D1 caps a statement at 100, so past ~99 trails this needs
  // splitting.
  const allKeys = TRAILS.map((t) => t.key);
  const [weather, rain, weatherOld, rainOld, forecast] = await Promise.all([
    db.prepare("SELECT trail_key, hour_ts, precip_in, et0_in, soil_moist_0_1 FROM weather_hourly WHERE hour_ts >= ?").bind(since).all(),
    db.prepare(`SELECT trail_key, hour_ts, rain_in, source FROM rain_hourly WHERE trail_key IN (${allKeys.map(() => "?").join(",")}) AND hour_ts >= ?`).bind(...allKeys, since).all(),
    olderKeys.length
      ? db.prepare(`SELECT trail_key, hour_ts, precip_in, et0_in, soil_moist_0_1 FROM weather_hourly WHERE trail_key IN (${inKeys}) AND hour_ts >= ? AND hour_ts < ?`).bind(...olderKeys, olderSince, since).all()
      : { results: [] },
    olderKeys.length
      ? db.prepare(`SELECT trail_key, hour_ts, rain_in, source FROM rain_hourly WHERE trail_key IN (${inKeys}) AND hour_ts >= ? AND hour_ts < ?`).bind(...olderKeys, olderSince, since).all()
      : { results: [] },
    fetchPredictionForecast()
  ]);

  const rows = mergeRain(
    [...(weatherOld.results || []), ...(weather.results || [])],
    [...(rainOld.results || []), ...(rain.results || [])]
  );
  const byTrail = {};
  for (const r of rows) (byTrail[r.trail_key] ||= []).push(r);

  const predictions = {};
  for (const trail of TRAILS) {
    const p = predictTrail(trail, statusOf[trail.key], starts[trail.key] ?? null,
      byTrail[trail.key] || [], forecast[trail.key], now);
    predictions[trail.key] = p;
  }

  await env.TRAIL_CACHE.put(kvKey(env), JSON.stringify({
    updatedAt: new Date(now * 1000).toISOString(),
    fittedAt: DRYING_PARAMS.fittedAt,
    variant: DRYING_PARAMS.variant,
    bandHours: DRYING_PARAMS.bandHours,
    predictions
  }));
  return { written: Object.keys(predictions).length };
}

export async function handlePredictions(env) {
  const data = env.TRAIL_CACHE ? await env.TRAIL_CACHE.get(kvKey(env), { type: "json" }) : null;
  return Response.json(data || { updatedAt: null, predictions: {} }, {
    headers: { "Cache-Control": "public, max-age=300" }
  });
}
