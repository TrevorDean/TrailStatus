// Verifies the drying model (drying-model.js) and the live predictor built on it
// (predictions.js): the bucket fills, caps and drains; a closure made ahead of
// the rain is not "reopened" before the rain arrives; a closure the rain does
// not explain gets no time at all; night-time crossings wait for a steward; an
// open trail that is merely still damp is not "about to close"; and every
// non-weather closure category declines to predict.
//
// No jsdom, no D1, no network — synthetic rows only.
// Exits NON-ZERO on failure, like verify-rain-history.
import { simulate, predictReopen, predictClose, wasWetted, snapToWindow, localHour } from "../drying-model.js";
import { predictTrail, closureStarts } from "../predictions.js";
import { shapePredictionForecast } from "../public/weather.js";
import { TRAILS } from "../public/trails.js";

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

const H = 3600;
// Wednesday 2026-10-07, noon CDT — not a scheduled-closure day for any trail.
const T0 = Date.parse("2026-10-07T17:00:00Z") / 1000;
const PARAMS = {
  variant: "et0", tBase: null, cap: 1, open: 0.1, close: 0.2,
  kAll: 1, k: {}, trailMult: {}, reopenWindow: { from: 8, to: 20 }, bandHours: 24
};
const TRAIL = { key: "t", hydGroup: "D" };
// n hourly rows from `from`; fn(i) supplies { rain, et0 } for hour i.
const rows = (from, n, fn) => Array.from({ length: n }, (_, i) => {
  const { rain = 0, et0 = 0.01 } = fn(i) || {};
  return { trail_key: "t", hour_ts: from + i * H, precip_in: rain, et0_in: et0 };
});

console.log("=== the bucket ===");
{
  const s = simulate(rows(T0, 3, (i) => (i === 0 ? { rain: 0.5, et0: 0 } : { et0: 0.1 })), TRAIL, PARAMS);
  check("fills with rain, drains by k·ET0", s.map((p) => +p.w.toFixed(2)), [0.5, 0.4, 0.3]);
  const capped = simulate(rows(T0, 1, () => ({ rain: 3, et0: 0 })), TRAIL, PARAMS);
  check("capped: 3 in fills it no further than `cap`", capped[0].w, 1);
  const floor = simulate(rows(T0, 2, () => ({ et0: 0.5 })), TRAIL, PARAMS);
  check("never below empty", floor.map((p) => p.w), [0, 0]);
  const fast = simulate(rows(T0, 2, (i) => (i === 0 ? { rain: 0.5, et0: 0 } : { et0: 0.1 })), TRAIL,
    { ...PARAMS, k: { D: 2 } });
  check("soil-group rate scales the drying", +fast[1].w.toFixed(2), 0.3);
  const temp = simulate([{ hour_ts: T0, precip_in: 0.5, temp_f: 90 }], TRAIL, { ...PARAMS, variant: "temp", tBase: 50 });
  check("temp variant dries on degree-hours above the base", +temp[0].w.toFixed(3), 0.48);
}

console.log("\n=== reopening ===");
{
  // Steward closes at T0; the inch of rain arrives two hours LATER.
  const r = rows(T0 - 24 * H, 24 * 10, (i) => (i === 26 ? { rain: 1, et0: 0 } : {}));
  const s = simulate(r, TRAIL, PARAMS);
  const reopen = predictReopen(s, T0, PARAMS);
  check("a closure ahead of the rain is NOT reopened before the rain arrives", reopen > T0 + 80 * H, true);
  check("...and lands inside the steward window", localHour(reopen) >= 8 && localHour(reopen) < 20, true);

  const dry = simulate(rows(T0 - 24 * H, 24 * 5, () => ({})), TRAIL, PARAMS);
  check("no rain at all: no prediction, not 'reopens now'", predictReopen(dry, T0, PARAMS), null);
  check("...and wasWetted() says so", wasWetted(dry, T0, PARAMS), false);

  const late = simulate(rows(T0 - 24 * H, 24 * 10, (i) => (i === 24 + 48 ? { rain: 1, et0: 0 } : {})), TRAIL, PARAMS);
  check("rain two days after the closure is a different closure: no prediction", predictReopen(late, T0, PARAMS), null);

  const never = simulate(rows(T0, 24, (i) => (i === 0 ? { rain: 1, et0: 0 } : { et0: 0 })), TRAIL, PARAMS);
  check("wet but never drains within the series: null, not a guess", predictReopen(never, T0, PARAMS), null);
}

console.log("\n=== the steward window ===");
{
  const oneAm = Date.parse("2026-10-08T06:00:00Z") / 1000; // 1am CDT
  check("1am local waits for 8am local", snapToWindow(oneAm, { from: 8, to: 20 }), Date.parse("2026-10-08T13:00:00Z") / 1000);
  check("9pm local waits for 8am next day", snapToWindow(Date.parse("2026-10-08T02:00:00Z") / 1000, { from: 8, to: 20 }),
    Date.parse("2026-10-08T13:00:00Z") / 1000);
  check("inside the window: unchanged", snapToWindow(T0, { from: 8, to: 20 }), T0);
  check("no window: unchanged", snapToWindow(oneAm, null), oneAm);
}

console.log("\n=== closing ===");
{
  const damp = simulate(rows(T0 - 5 * H, 30, (i) => (i === 0 ? { rain: 0.6, et0: 0 } : { et0: 0.001 })), TRAIL, PARAMS);
  check("an open trail that is merely still damp is not 'about to close'", predictClose(damp, T0, PARAMS), null);
  const storm = simulate(rows(T0, 30, (i) => (i === 5 ? { rain: 0.3, et0: 0 } : {})), TRAIL, PARAMS);
  check("forecast rain crossing `close` flags that hour", predictClose(storm, T0, PARAMS), T0 + 5 * H);
  const drizzle = simulate(rows(T0, 30, (i) => (i === 5 ? { rain: 0.1, et0: 0 } : {})), TRAIL, PARAMS);
  check("rain below `close` flags nothing", predictClose(drizzle, T0, PARAMS), null);
}

console.log("\n=== predictTrail: who gets a time ===");
{
  const wet = rows(T0 - 48 * H, 48, (i) => (i === 40 ? { rain: 1, et0: 0 } : {}));
  const fc = rows(T0, 24 * 7, () => ({}));
  const p = predictTrail(TRAIL, "Closed", T0 - 6 * H, wet, fc, T0, PARAMS);
  check("weather closure: a reopening time", [p.basis, typeof p.reopenAt], ["weather", "number"]);

  const bigCedar = TRAILS.find((t) => t.key === "big-cedar");
  const sunday = Date.parse("2026-10-11T15:00:00Z") / 1000; // Sunday 10am CDT
  const sun = predictTrail(bigCedar, "Closed", sunday, rows(sunday - 48 * H, 48, (i) => (i === 40 ? { rain: 1, et0: 0 } : {})),
    rows(sunday, 48, () => ({})), sunday + H, PARAMS);
  check("scheduled closure: declines, even with rain", [sun.basis, sun.reopenAt], ["scheduled", undefined]);

  const known = { ...TRAIL, knownNonWeatherClosures: [{ from: "2026-10-07", to: null, reason: "race" }] };
  check("known non-weather closure: declines", predictTrail(known, "Closed", T0 - H, wet, fc, T0, PARAMS).basis, "known-non-weather");

  check("closure start unknown: declines", predictTrail(TRAIL, "Closed", null, wet, fc, T0, PARAMS).basis, "unknown-start");

  const dry = rows(T0 - 48 * H, 48, () => ({}));
  const unexplained = predictTrail(TRAIL, "Closed", T0 - 6 * H, dry, fc, T0, PARAMS);
  check("no rain behind the closure: declines", [unexplained.basis, unexplained.reopenAt], ["unexplained", undefined]);

  // Rain 22 h ago, closed 20 h ago, drained ~16 h ago: overdue, but within the 24 h band...
  const drained = rows(T0 - 120 * H, 120, (i) => (i === 98 ? { rain: 0.3, et0: 0 } : { et0: 0.05 }));
  const within = predictTrail(TRAIL, "Closed", T0 - 20 * H, drained, fc, T0, PARAMS);
  check("drained recently: 'any time now', pinned to a future steward window", [within.overdue, within.reopenAt > T0], [true, true]);
  // ...and far past it.
  const long = rows(T0 - 240 * H, 240, (i) => (i === 10 ? { rain: 0.3, et0: 0 } : { et0: 0.05 }));
  const beyond = predictTrail(TRAIL, "Closed", T0 - 230 * H, long, fc, T0, PARAMS);
  check("drained long ago, still shut: declines rather than repeating 'any time now'", [beyond.basis, beyond.reopenAt], ["overdue", undefined]);

  const openStorm = predictTrail(TRAIL, "Open", null, dry, rows(T0, 72, (i) => (i === 10 ? { rain: 0.5, et0: 0 } : {})), T0, PARAMS);
  check("open trail, heavy rain in 10 h: closeAt", openStorm.closeAt, T0 + 10 * H);
  const openFar = predictTrail(TRAIL, "Open", null, dry, rows(T0, 24 * 7, (i) => (i === 100 ? { rain: 0.5, et0: 0 } : {})), T0, PARAMS);
  check("open trail, rain beyond 48 h: no warning yet", [openFar.basis, openFar.closeAt], ["open", undefined]);
  check("no data: declines", predictTrail(TRAIL, "Closed", T0, [], fc, T0, PARAMS).basis, "no-data");
}

console.log("\n=== closureStarts ===");
{
  const ev = (trail_key, prev_status, status, observed_at) => ({ trail_key, prev_status, status, observed_at, reported_ts: null });
  const s = closureStarts([
    ev("a", "Open", "Closed", "2026-10-01T13:00:00Z"),
    ev("a", "Closed", "Wet", "2026-10-03T13:00:00Z"),
    ev("b", null, "Closed", "2026-09-01T00:00:00Z"),
    ev("c", "Open", "Closed", "2026-10-01T00:00:00Z"),
    ev("c", "Closed", "Open", "2026-10-05T00:00:00Z"),
    ev("d", "Wet", "Closed", "2026-10-02T00:00:00Z")
  ]);
  check("Closed → Wet keeps the original start", s.a, Date.parse("2026-10-01T13:00:00Z") / 1000);
  check("first-ever sighting already closed: unknown start", s.b, null);
  check("reopened: no current closure", "c" in s, false);
  check("closed-to-closed with nothing rideable before it in view: unknown start", s.d, null);
}

console.log("\n=== the forecast feed ===");
{
  const groups = [{ lat: 1, lng: 2, keys: ["x", "y"] }];
  const shaped = shapePredictionForecast([{ hourly: {
    time: [100, 200, 300],
    precipitation: [0.5, 0.5, null],
    precipitation_probability: [40, null, 50],
    et0_fao_evapotranspiration: [0.01, null, 0.02]
  } }], groups);
  check("rain weighted by its probability; no probability = as given; NULL stays NULL",
    shaped.x.map((r) => r.precip_in), [0.2, 0.5, null]);
  check("ET0 passes through, NULL kept", shaped.x.map((r) => r.et0_in), [0.01, null, 0.02]);
  check("fanned out to every trail in the group", shaped.y === shaped.x, true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
