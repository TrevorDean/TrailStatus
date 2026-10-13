// Fits the drying model (../drying-model.js) to the closures the archive has
// actually seen, and reports how well it does — read-only, like
// build-episodes.js, until --write.
//
//   node scripts/fit-drying-model.js --remote          # fit + report, writes nothing
//   node scripts/fit-drying-model.js --remote --write  # ...and emit public/drying-params.js
//   node scripts/fit-drying-model.js --from a.json     # fit a saved loadArchive() dump
//
// Two drying variants are fitted side by side — ET0 and average temperature —
// and the one with the lower LEAVE-ONE-TRAIL-OUT error wins. That error is the
// honest number: it predicts each trail with parameters fitted without it, which
// is the position every trail is in before its own history accumulates.
// In-sample error, with each trail's own multiplier, is printed too, but it is
// flattering by construction and is never used to choose.
//
// The backtest drains the bucket with OBSERVED weather after the closure, where
// the live site has only a forecast, so live error will be somewhat worse. The
// forecast_snapshots table is what an honest forecast-vintage backtest needs,
// once it holds enough storms.
//
// Re-run after every storm. The first fit (2026-10-13) rests on essentially one
// event, the Oct 1 storm, and its parameters should be read that way.

import { readFileSync, writeFileSync } from "node:fs";
import { TRAILS } from "../public/trails.js";
import { loadArchive, deriveEpisodes } from "./build-episodes.js";
import { simulate, predictReopen, wasWetted, levelAt, localHour } from "../drying-model.js";
import { CLOSE_LEAD_H } from "../closure-classify.js";

const HOUR = 3600;
const SPIN_UP = 14 * 24 * HOUR;   // bucket starts empty this long before a closure
const HORIZON = 21 * 24 * HOUR;   // ...and is watched this long after it
const MISS_H = 240;               // error charged when the bucket never drains
const GROUPS = ["A", "B", "C", "D"];
const K_GRID = Array.from({ length: 41 }, (_, i) => +(0.1 * Math.pow(10, i / 20)).toFixed(4)); // 0.1 … 10
const CAP_GRID = [1, 1.5, 2, 2.5, 3, 4, 6, 99];
const OPEN_GRID = [0.01, 0.03, 0.05, 0.1];
const SHRINK = 1; // pseudo-events pulling a trail's multiplier toward 1

const meta = Object.fromEntries(TRAILS.map((t) => [t.key, t]));

function windowRows(rows, from, to) {
  return rows.filter((r) => r.hour_ts >= from && r.hour_ts <= to);
}

// Signed error in hours: positive = predicted too late. A closure the rain does
// not explain gets no prediction (see predictReopen) and is scored separately as
// "declined", never as an error; one that was wet but never drained within the
// horizon is charged MISS_H.
function episodeError(ep, rows, params, trail = meta[ep.trail_key]) {
  if (!isWetted(ep, rows, params, trail)) return null;
  const series = simulate(rows, trail, params);
  const predicted = predictReopen(series, ep.closed_ts, params);
  if (predicted === null) return MISS_H;
  return (predicted - ep.opened_ts) / HOUR;
}

// Whether the rain explains this closure at all — judged with the pooled rate,
// not the candidate one, so the set of scored episodes does not shift while k is
// being searched (a fit could otherwise "improve" by declining its worst cases).
const wettedCache = new Map();
function isWetted(ep, rows, params, trail) {
  const id = `${ep.trail_key}|${ep.closed_ts}|${params.variant}|${params.tBase}|${params.cap}|${params.open}`;
  if (!wettedCache.has(id)) {
    const series = simulate(rows, trail, { ...params, k: {}, kAll: 1, trailMult: {} });
    wettedCache.set(id, wasWetted(series, ep.closed_ts, params));
  }
  return wettedCache.get(id);
}

const scored = (errs) => errs.filter((x) => x !== null);

const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };
const pct = (xs, q) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const mae = (errs) => (errs.length ? mean(errs.map(Math.abs)) : Infinity);

// Best single rate for a set of episodes, everything else held fixed.
function bestK(eps, rowsFor, base) {
  let best = { k: 1, err: Infinity };
  for (const k of K_GRID) {
    const params = { ...base, k: {}, kAll: k, trailMult: {} };
    const err = mae(scored(eps.map((e) => episodeError(e, rowsFor(e), params))));
    if (err < best.err) best = { k, err };
  }
  return best.k;
}

// Group rates, falling back to the pooled rate for a group with no episodes.
function fitRates(eps, rowsFor, base) {
  const kAll = bestK(eps, rowsFor, base);
  const k = {};
  for (const g of GROUPS) {
    const mine = eps.filter((e) => meta[e.trail_key]?.hydGroup === g);
    k[g] = mine.length ? bestK(mine, rowsFor, base) : kAll;
  }
  return { kAll, k };
}

// Each trail's own multiplier, shrunk toward 1 in log space by SHRINK
// pseudo-events — with one event apiece, the raw fit would simply memorise it.
function fitMultipliers(eps, rowsFor, params) {
  const trailMult = {};
  const byTrail = {};
  for (const e of eps) (byTrail[e.trail_key] ||= []).push(e);
  for (const [key, mine] of Object.entries(byTrail)) {
    let best = { m: 1, err: Infinity };
    for (let i = -20; i <= 20; i++) {
      const m = Math.pow(10, i / 20);
      const p = { ...params, trailMult: { [key]: m } };
      const err = mae(scored(mine.map((e) => episodeError(e, rowsFor(e), p))));
      if (err < best.err) best = { m, err };
    }
    const n = mine.length;
    trailMult[key] = +Math.exp((n / (n + SHRINK)) * Math.log(best.m)).toFixed(3);
  }
  return trailMult;
}

function fitVariant(eps, rowsFor, variant, tBase, reopenWindow) {
  let best = null;
  for (const cap of CAP_GRID) {
    for (const open of OPEN_GRID) {
      const base = { variant, tBase, cap, open, reopenWindow };
      const { kAll, k } = fitRates(eps, rowsFor, base);
      const params = { ...base, kAll, k, trailMult: {} };
      const err = mae(scored(eps.map((e) => episodeError(e, rowsFor(e), params))));
      if (!best || err < best.err) best = { params, err };
    }
  }
  const params = best.params;

  // Leave one trail out: refit the rates without it, predict it with no
  // multiplier of its own. cap/open stay at the full-data values — refitting
  // those per fold costs 32x the time and moves them very little.
  const loto = [];
  for (const key of [...new Set(eps.map((e) => e.trail_key))]) {
    const rest = eps.filter((e) => e.trail_key !== key);
    const { kAll, k } = fitRates(rest, rowsFor, params);
    const p = { ...params, kAll, k, trailMult: {} };
    for (const e of eps.filter((x) => x.trail_key === key)) loto.push({ e, err: episodeError(e, rowsFor(e), p) });
  }

  params.trailMult = fitMultipliers(eps, rowsFor, params);
  const inSample = eps.map((e) => ({ e, err: episodeError(e, rowsFor(e), params) }));
  return { params, loto, inSample };
}

function summary(rows) {
  const errs = scored(rows.map((r) => r.err));
  return {
    n: errs.length,
    declined: rows.length - errs.length,
    mae: +mae(errs).toFixed(1),
    median_abs: +median(errs.map(Math.abs)).toFixed(1),
    p80_abs: +pct(errs.map(Math.abs), 0.8).toFixed(1),
    bias: +mean(errs).toFixed(1)
  };
}

// The steward's reopening window, local time: the middle 90% of observed
// reopenings, widened to whole hours.
function learnWindow(eps) {
  const hours = eps.map((e) => localHour(e.opened_ts));
  return { from: pct(hours, 0.05), to: Math.min(24, pct(hours, 0.95) + 1) };
}

// How full was the bucket when stewards closed? Read just after the closure, by
// the same CLOSE_LEAD_H the classifier uses, because closures lead the rain.
function closeLevels(eps, rowsFor, params) {
  return eps.map((e) => {
    const series = simulate(rowsFor(e), meta[e.trail_key], params);
    return { e, w: levelAt(series, e.closed_ts + CLOSE_LEAD_H * HOUR) ?? 0 };
  });
}

(async () => {
  const fromIdx = process.argv.indexOf("--from");
  const archive = fromIdx > 0
    ? JSON.parse(readFileSync(process.argv[fromIdx + 1], "utf8"))
    : loadArchive(process.argv.includes("--remote"));
  const episodes = deriveEpisodes(archive.events, archive.byTrailWeather);
  const eps = episodes.filter((e) => e.usable && e.start_known);
  console.log(`${eps.length} usable drying episodes on ${new Set(eps.map((e) => e.trail_key)).size} trails\n`);

  const rowCache = new Map();
  const rowsFor = (e) => {
    const id = `${e.trail_key}|${e.closed_ts}`;
    if (!rowCache.has(id)) {
      rowCache.set(id, windowRows(archive.byTrailWeather[e.trail_key] || [], e.closed_ts - SPIN_UP, e.closed_ts + HORIZON));
    }
    return rowCache.get(id);
  };

  const reopenWindow = learnWindow(eps);
  console.log(`steward reopen window (local): ${reopenWindow.from}:00 – ${reopenWindow.to}:00\n`);

  const fits = [fitVariant(eps, rowsFor, "et0", null, reopenWindow)];
  for (const tBase of [40, 50, 60]) fits.push(fitVariant(eps, rowsFor, "temp", tBase, reopenWindow));

  const isOct1 = (e) => e.closed_at >= "2026-09-30T12" && e.closed_at < "2026-10-03";
  console.log("Reopen-time error in hours (positive = predicted too late)\n");
  console.table(fits.map((f) => ({
    variant: f.params.variant + (f.params.tBase ? ` >${f.params.tBase}°F` : ""),
    cap: f.params.cap,
    open: f.params.open,
    "LOTO mae": summary(f.loto).mae,
    "LOTO median": summary(f.loto).median_abs,
    "LOTO p80": summary(f.loto).p80_abs,
    "LOTO bias": summary(f.loto).bias,
    "in-sample mae": summary(f.inSample).mae,
    "other storms mae": summary(f.loto.filter((r) => !isOct1(r.e))).mae,
    "other n": summary(f.loto.filter((r) => !isOct1(r.e))).n,
    declined: summary(f.loto).declined
  })));

  const winner = fits.reduce((a, b) => (summary(b.loto).mae < summary(a.loto).mae ? b : a));
  const loser = fits.filter((f) => f.params.variant !== winner.params.variant)
    .reduce((a, b) => (summary(b.loto).mae < summary(a.loto).mae ? b : a));
  console.log(`\nWinner: ${winner.params.variant}${winner.params.tBase ? ` >${winner.params.tBase}°F` : ""} — ` +
    `leave-one-trail-out error ${summary(winner.loto).mae} h vs ${summary(loser.loto).mae} h for the best ${loser.params.variant} fit.`);
  console.log(`rates by soil group: ${GROUPS.map((g) => `${g}=${winner.params.k[g]}`).join("  ")}  (pooled ${winner.params.kAll})`);

  console.log("\nPer episode, winner (LOTO = predicted with parameters fitted without that trail):");
  console.table(winner.loto.map(({ e, err }) => ({
    trail: e.trail_key,
    hyd: e.hyd_group,
    closed: e.closed_at.slice(0, 16),
    "actual h": e.hours_closed,
    "LOTO err h": err === null ? "declined" : +err.toFixed(1),
    mult: winner.params.trailMult[e.trail_key]
  })).sort((a, b) => a.closed.localeCompare(b.closed)));

  const levels = closeLevels(eps, rowsFor, winner.params);
  const ws = levels.map((l) => l.w);
  console.log("\nbucket at closure, sorted:", levels.sort((a, b) => a.w - b.w)
    .map((l) => `${l.e.trail_key}@${l.e.closed_at.slice(5, 10)}=${l.w.toFixed(2)}`).join("  "));
  // The 20th percentile: a level most real closures had reached. Lower would
  // flag every drizzle; higher would miss the stewards who close early.
  const close = +Math.max(winner.params.open * 2, pct(ws, 0.2)).toFixed(3);
  console.log(`\nbucket at closure: min ${Math.min(...ws).toFixed(2)}  p20 ${pct(ws, 0.2).toFixed(2)}  ` +
    `median ${median(ws).toFixed(2)}  max ${Math.max(...ws).toFixed(2)} in  →  close threshold ${close} in`);

  const band = Math.round(summary(winner.loto).p80_abs);
  console.log(`display band: ±${band} h (80th percentile of leave-one-trail-out error)`);

  if (!process.argv.includes("--write")) {
    console.log("\nNothing written. Re-run with --write to emit public/drying-params.js.");
    return;
  }
  const out = {
    fittedAt: new Date().toISOString().slice(0, 10),
    episodes: eps.length,
    variant: winner.params.variant,
    tBase: winner.params.tBase,
    cap: winner.params.cap,
    open: winner.params.open,
    close,
    kAll: winner.params.kAll,
    k: winner.params.k,
    trailMult: winner.params.trailMult,
    reopenWindow,
    bandHours: band
  };
  writeFileSync(
    new URL("../public/drying-params.js", import.meta.url),
    `// GENERATED by scripts/fit-drying-model.js --write — do not edit by hand.\n` +
    `// Re-run the fit after each storm; see CLAUDE.md "Drying model".\n` +
    `export const DRYING_PARAMS = ${JSON.stringify(out, null, 2)};\n`
  );
  console.log("\nwrote public/drying-params.js");
})();
