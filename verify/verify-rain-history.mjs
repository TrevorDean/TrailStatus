// Verifies the rain archive (rain-history.js): MRMS radar each hour, NBM filling
// any hour MRMS was missed — and the switch of "rain received" from the HRRR
// model to that archive in closure-classify.js and scripts/build-episodes.js.
//
// No jsdom, no D1, no network: the D1 binding and fetch are fakes, which is why
// recordRainHour() takes `now` and `fetchImpl` as arguments.
// Exits NON-ZERO on failure, like verify-weather-history.
import {
  FILL_LOOKBACK_H, MRMS_LAYER, NBM_MODEL, groupByPoint, hoursToFill, mmToIn, nbmRequestUrl, rainPoint,
  recordRainHour, samplesRequestBody, shapeNbm, shapeSamples
} from "../rain-history.js";
import { classifyClosure, observedRain, rainSource } from "../closure-classify.js";
import { mergeRain } from "../scripts/build-episodes.js";
import { TRAILS as REAL_TRAILS } from "../public/trails.js";

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};
const throws = (label, fn, pattern) => {
  let msg = null;
  try { fn(); } catch (e) { msg = e.message; }
  check(label, msg !== null && pattern.test(msg), true);
};
const rejects = async (label, promise, pattern) => {
  let msg = null;
  try { await promise; } catch (e) { msg = e.message; }
  check(label, msg !== null && pattern.test(msg), true);
};

console.log("=== units: the service's pixels are mm, stored as inches ===");
check("4.7 mm (Big Cedar, 2026-09-30) => 0.185 in", mmToIn("4.700000286"), 0.185);
check("25.4 mm => 1 in", mmToIn("25.400000"), 1);
check("zero stays zero — a dry hour is an observation", mmToIn("0.000000000"), 0);
check("NoData => NULL", mmToIn("NoData"), null);
check("negative (no-coverage flag) => NULL", mmToIn("-3"), null);
check("empty => NULL, not 0", mmToIn(""), null);
check("null => NULL", mmToIn(null), null);

console.log("\n=== where each trail is sampled ===");
check("primary parking lot wins",
  rainPoint({ lat: 1, lng: 1, parking: [{ lat: 2, lng: 2 }, { lat: 3, lng: 3, primary: true }] }), { lat: 3, lng: 3 });
check("else the first lot",
  rainPoint({ lat: 1, lng: 1, parking: [{ lat: 2, lng: 2 }, { lat: 3, lng: 3 }] }), { lat: 2, lng: 2 });
check("else the trail-level parking pin",
  rainPoint({ lat: 1, lng: 1, parkingLat: 4, parkingLng: 4 }), { lat: 4, lng: 4 });
check("else lat/lng", rainPoint({ lat: 1, lng: 1 }), { lat: 1, lng: 1 });
check("no coordinates at all => null", rainPoint({ key: "x" }), null);
const northshore = REAL_TRAILS.find((t) => t.key === "northshore");
const nsPrimary = northshore.parking.find((p) => p.primary);
check("northshore samples its on-trail primary lot, not lot 1",
  rainPoint(northshore), { lat: nsPrimary.lat, lng: nsPrimary.lng });
const realGroups = groupByPoint(REAL_TRAILS);
check("every real trail gets a sample point",
  realGroups.reduce((n, g) => n + g.keys.length, 0), REAL_TRAILS.length);
check("co-located skill parks share one point",
  realGroups.some((g) => g.keys.includes("erwin-park") && g.keys.includes("erwin-park-skill-park")), true);

console.log("\n=== request ===");
const TRAILS = [
  { key: "alpha", lat: 32.8, lng: -96.7, parkingLat: 32.81, parkingLng: -96.71 },
  { key: "alpha-skills", lat: 32.9, lng: -96.9, parkingLat: 32.81, parkingLng: -96.71 },
  { key: "gamma", lat: 33.25, lng: -96.66 }
];
const groups = groupByPoint(TRAILS);
check("co-located trails collapse to one point", groups.map((g) => g.keys), [["alpha", "alpha-skills"], ["gamma"]]);
const body = samplesRequestBody(groups);
check("points are [lng, lat] in request order",
  JSON.parse(body.get("geometry")).points, [[-96.71, 32.81], [-96.66, 33.25]]);
check("the layer is pinned by name, not left to the mosaic",
  JSON.parse(body.get("mosaicRule")).where, `name='${MRMS_LAYER}'`);
check("layer is the one-hour accumulation", MRMS_LAYER, "conus_QPE_01H");

console.log("\n=== shaping a response ===");
const END = Date.UTC(2026, 8, 30, 23);            // 23:00Z, top of an hour
const sample = (locationId, value, end = END) =>
  ({ locationId, value, attributes: { name: MRMS_LAYER, idp_validendtime: end } });
const shaped = shapeSamples({ samples: [sample(0, "2.540000"), sample(1, "0.000000")] }, groups);
check("the hour comes from validend, as the END of the hour", shaped.hourTs, END / 1000);
check("fan-out: both co-located keys get the same value, gamma its own",
  shaped.rows, [["alpha", END / 1000, 0.1, "mrms"], ["alpha-skills", END / 1000, 0.1, "mrms"], ["gamma", END / 1000, 0, "mrms"]]);
check("a point the service omitted (no coverage) is NULL, not 0",
  shapeSamples({ samples: [sample(1, "1.0")] }, groups).rows.map((r) => r[2]), [null, null, 0.0394]);
throws("a service error body throws, even with HTTP 200",
  () => shapeSamples({ error: { code: 400, message: "Invalid or missing input parameters." } }, groups), /400/);
throws("no samples at all throws", () => shapeSamples({ samples: [] }, groups), /no samples/);
throws("samples from two rasters throw",
  () => shapeSamples({ samples: [sample(0, "1"), sample(1, "1", END - 3600e3)] }, groups), /2 rasters/);
throws("a validend that is not the top of an hour throws",
  () => shapeSamples({ samples: [sample(0, "1", END + 60e3)] }, groups), /top of an hour/);

console.log("\n=== NBM fill: request and shaping ===");
const nbmUrl = new URL(nbmRequestUrl(groups));
check("NBM is pinned by model name", nbmUrl.searchParams.get("models"), NBM_MODEL);
check("...in inches", nbmUrl.searchParams.get("precipitation_unit"), "inch");
check("...at the same points as MRMS", [nbmUrl.searchParams.get("latitude"), nbmUrl.searchParams.get("longitude")],
  ["32.81,33.25", "-96.71,-96.66"]);
check("...with two days of past hours", nbmUrl.searchParams.get("past_days"), "2");
{
  const h1 = END / 1000 - 3600, h2 = END / 1000;
  const loc = (vals) => ({ hourly: { time: [h1 - 3600, h1, h2], precipitation: vals } });
  const rows = shapeNbm([loc([9, 0.02, null]), loc([9, 0, 0.1])], groups, [h1, h2]);
  check("only the requested hours, fanned out, source nbm, null stays NULL",
    rows, [["alpha", h1, 0.02, "nbm"], ["alpha-skills", h1, 0.02, "nbm"], ["alpha", h2, null, "nbm"], ["alpha-skills", h2, null, "nbm"],
      ["gamma", h1, 0, "nbm"], ["gamma", h2, 0.1, "nbm"]]);
  throws("a location-count mismatch throws", () => shapeNbm([loc([0, 0, 0])], groups, [h1]), /1 locations for 2/);
}

console.log("\n=== which hours get filled ===");
{
  const H = 3600, top = END / 1000;          // clock at 23:xx
  const have = (...hs) => new Set(hs);
  // Every hour from `from` to `to` inclusive — an archive with no holes in it.
  const span = (from, to) => { const out = []; for (let h = from; h <= to; h += H) out.push(h); return out; };
  check("empty archive => never fill (a fill repairs gaps, it is not a backfill)",
    hoursToFill({ have: have(), firstEver: null, topOfHour: top }), []);
  check("no gap => nothing",
    hoursToFill({ have: have(...span(top - 10 * H, top - H)), firstEver: top - 10 * H, topOfHour: top }), []);
  check("the previous hour is NOT filled yet — MRMS may still serve it",
    hoursToFill({ have: have(...span(top - 10 * H, top - 2 * H)), firstEver: top - 10 * H, topOfHour: top }), []);
  check("two hours back is gone from MRMS => filled",
    hoursToFill({ have: have(...span(top - 10 * H, top - 3 * H)), firstEver: top - 10 * H, topOfHour: top }), [top - 2 * H]);
  check("once MRMS hour H is written, every earlier hole is filled",
    hoursToFill({ have: have(...span(top - 10 * H, top - 3 * H)), firstEver: top - 10 * H, topOfHour: top, mrmsHour: top }), [top - 2 * H, top - H]);
  check("never before the archive's first hour",
    hoursToFill({ have: have(top - 5 * H), firstEver: top - 5 * H, topOfHour: top, mrmsHour: top }),
    [top - 4 * H, top - 3 * H, top - 2 * H, top - H]);
  check(`never further back than ${FILL_LOOKBACK_H} h (NBM's look-back)`,
    hoursToFill({ have: have(), firstEver: top - 100 * H, topOfHour: top, mrmsHour: top })[0], top - FILL_LOOKBACK_H * H);
}

console.log("\n=== recordRainHour against a fake D1 ===");
// have: hour_ts values the probe trail already holds; firstEver: its MIN(hour_ts).
function fakeDb(have = [], firstEver = have.length ? Math.min(...have) : null) {
  const db = {
    batches: [],
    prepare(sql) {
      const stmt = {
        sql,
        args: [],
        bind: (...args) => ({ ...stmt, args }),
        all: async () => ({ results: have.map((hour_ts) => ({ hour_ts })) }),
        first: async () => ({ h: firstEver })
      };
      return stmt;
    },
    async batch(statements) { db.batches.push(statements); }
  };
  db.rows = () => db.batches.flat().flatMap((s) => {
    const out = [];
    for (let k = 0; k < s.args.length; k += 4) out.push(s.args.slice(k, k + 4));
    return out;
  });
  return db;
}
// Routes MRMS and NBM to separate fakes and records every call.
function fakeFetch({ mrms, nbm }) {
  const f = async (url, init) => {
    f.calls.push({ url: String(url), init });
    const isMrms = /getSamples$/.test(url);
    const r = isMrms ? mrms : nbm;
    if (r instanceof Error) throw r;
    if (r?.status) return { ok: false, status: r.status };
    return { ok: true, json: async () => r };
  };
  f.calls = [];
  f.mrmsCalls = () => f.calls.filter((c) => /getSamples$/.test(c.url)).length;
  f.nbmCalls = () => f.calls.filter((c) => !/getSamples$/.test(c.url)).length;
  return f;
}
const realGroupsCount = groupByPoint(REAL_TRAILS).length;
const mrmsPayload = (end) => ({ samples: Array.from({ length: realGroupsCount }, (_, i) => sample(i, "0.254000", end)) });
const nbmPayload = (hours) => Array.from({ length: realGroupsCount }, () =>
  ({ hourly: { time: hours, precipitation: hours.map(() => 0.03) } }));
const at = (iso) => new Date(iso);
const E = END / 1000, HR = 3600;
const pastHours = Array.from({ length: 72 }, (_, i) => E - 70 * HR + i * HR);

{
  const db = fakeDb([E]);
  const f = fakeFetch({ mrms: mrmsPayload(END), nbm: nbmPayload(pastHours) });
  const r = await recordRainHour({ TRAIL_HISTORY: db }, at("2026-09-30T23:40:00Z"), f);
  check("current hour already stored => skip WITHOUT fetching", [r.skipped, f.calls.length], ["hour already recorded", 0]);
}
{
  const db = fakeDb([E - HR, E]);
  const f = fakeFetch({ mrms: mrmsPayload(END), nbm: nbmPayload(pastHours) });
  const r = await recordRainHour({ TRAIL_HISTORY: db }, at("2026-10-01T00:02:00Z"), f);
  check("next hour not published yet => one MRMS fetch, no NBM, no write",
    [r.skipped, f.mrmsCalls(), f.nbmCalls(), db.batches.length], ["no new hour published yet", 1, 0, 0]);
}
{
  const db = fakeDb([E - HR, E]);
  const f = fakeFetch({ mrms: mrmsPayload(END + 3600e3), nbm: nbmPayload(pastHours) });
  const r = await recordRainHour({ TRAIL_HISTORY: db }, at("2026-10-01T00:06:00Z"), f);
  const rows = db.rows();
  check("normal hour => MRMS only, one row per trail, no NBM call",
    [rows.length, rows.every((x) => x[3] === "mrms"), f.nbmCalls(), r.filled], [REAL_TRAILS.length, true, 0, 0]);
  check("...no statement exceeds D1's 100 bound parameters", db.batches.flat().every((s) => s.args.length <= 100), true);
}
{
  // The cron missed 21:05-22:59 entirely: hour 22:00 was never sampled.
  const db = fakeDb([E - 3 * HR, E - 2 * HR]);
  const f = fakeFetch({ mrms: mrmsPayload(END), nbm: nbmPayload(pastHours) });
  const r = await recordRainHour({ TRAIL_HISTORY: db }, at("2026-09-30T23:06:00Z"), f);
  const rows = db.rows();
  const bySrc = (src) => [...new Set(rows.filter((x) => x[3] === src).map((x) => x[1]))];
  check("a missed hour is filled from NBM; the new hour is still MRMS",
    [bySrc("nbm"), bySrc("mrms"), r.filled], [[E - HR], [E], 1]);
  check("...in ONE batch, so the fill and the new hour land together", db.batches.length, 1);
}
{
  // MRMS is down; three hours back is unrecoverable from it by now.
  const db = fakeDb([E - 4 * HR]);
  const f = fakeFetch({ mrms: { status: 503 }, nbm: nbmPayload(pastHours) });
  const r = await recordRainHour({ TRAIL_HISTORY: db }, at("2026-09-30T23:06:00Z"), f);
  const hours = [...new Set(db.rows().map((x) => x[1]))];
  check("MRMS down => NBM still fills what MRMS can no longer supply, and the tick succeeds",
    [hours, r.filled], [[E - 3 * HR, E - 2 * HR], 2]);
}
{
  const db = fakeDb([E - 2 * HR]);
  const f = fakeFetch({ mrms: mrmsPayload(END), nbm: { status: 500 } });
  const r = await recordRainHour({ TRAIL_HISTORY: db }, at("2026-09-30T23:06:00Z"), f);
  check("NBM down => MRMS is still written, and the unfilled hour is reported",
    [[...new Set(db.rows().map((x) => x[3]))], r.unfilled], [["mrms"], 1]);
}
{
  const db = fakeDb([]);
  const f = fakeFetch({ mrms: mrmsPayload(END), nbm: nbmPayload(pastHours) });
  const r = await recordRainHour({ TRAIL_HISTORY: db }, at("2026-09-30T23:06:00Z"), f);
  check("empty table => first MRMS hour written, no NBM backfill", [r.written, f.nbmCalls()], [REAL_TRAILS.length, 0]);
}
await rejects("MRMS down with nothing to fill => throws (the Worker logs it)",
  recordRainHour({ TRAIL_HISTORY: fakeDb([E - HR]) }, at("2026-09-30T23:06:00Z"), fakeFetch({ mrms: { status: 503 } })), /503/);
await rejects("a raster from the future is refused",
  recordRainHour({ TRAIL_HISTORY: fakeDb([]) }, at("2026-09-30T22:30:00Z"), fakeFetch({ mrms: mrmsPayload(END) })), /after the current hour/);
check("no binding => skipped, no throw",
  (await recordRainHour({}, at("2026-09-30T23:06:00Z"), fakeFetch({}))).skipped, "missing binding");

console.log("\n=== rain received now means the rain archive ===");
check("the archive wins over HRRR", observedRain({ precip_in: 0.28, rain_obs_in: 0.19, rain_obs_source: "mrms" }), 0.19);
check("an archive zero is a real zero — HRRR does not overrule it",
  observedRain({ precip_in: 0.28, rain_obs_in: 0, rain_obs_source: "mrms" }), 0);
check("an NBM-filled hour is used like any other", observedRain({ precip_in: 0.28, rain_obs_in: 0.02, rain_obs_source: "nbm" }), 0.02);
check("no archive row => fall back to HRRR", observedRain({ precip_in: 0.28 }), 0.28);
check("archive row with NULL => fall back to HRRR", observedRain({ precip_in: 0.28, rain_obs_in: null }), 0.28);
check("neither => 0", observedRain({}), 0);

const H = 3600, T = Date.UTC(2026, 9, 5, 18) / 1000;
const win = (fn) => Array.from({ length: 10 * 24 + 1 }, (_, i) => fn(T - (10 * 24 - i) * H));
const obs = (src) => (h) => ({ hour_ts: h, precip_in: 0, rain_obs_in: 0, rain_obs_source: src });
check("rain_source: all radar", rainSource(win(obs("mrms")), T - 72 * H, T), "mrms");
check("rain_source: all NBM", rainSource(win(obs("nbm")), T - 72 * H, T), "nbm");
check("rain_source: all HRRR (before the archive)", rainSource(win((h) => ({ hour_ts: h, precip_in: 0 })), T - 72 * H, T), "hrrr");
check("rain_source: radar with one NBM-filled hour",
  rainSource(win((h) => obs(h === T - 5 * H ? "nbm" : "mrms")(h)), T - 72 * H, T), "mixed");
check("rain_source: nothing", rainSource([], T - 72 * H, T), "none");

const plain = REAL_TRAILS.find((t) => t.key === "northshore");
{
  // HRRR saw rain, the radar saw none, and the ground stayed dry.
  const rows = win((h) => ({ hour_ts: h, precip_in: h > T - 24 * H ? 0.05 : 0, rain_obs_in: 0, rain_obs_source: "mrms", soil_moist_0_1: 0.06 }));
  const c = classifyClosure(plain, T, rows, T);
  check("HRRR rain the radar did not see does NOT make a weather closure",
    [c.category, c.rain_72h, c.rain_source], ["unexplained", 0, "mrms"]);
}
{
  // HRRR missed a storm the radar caught.
  const rows = win((h) => ({ hour_ts: h, precip_in: 0, rain_obs_in: h === T - 6 * H ? 0.6 : 0, rain_obs_source: "mrms", soil_moist_0_1: 0.06 }));
  const c = classifyClosure(plain, T, rows, T);
  check("radar rain HRRR missed DOES make a weather closure",
    [c.category, c.predictable, c.rain_72h], ["weather", true, 0.6]);
  check("...and the drying clock starts at the radar's last wet hour", c.wetted_at, T - 6 * H);
}

console.log("\n=== joining rain_hourly onto the weather rows ===");
{
  const weather = [
    { trail_key: "b", hour_ts: 100, precip_in: 0.1 },
    { trail_key: "a", hour_ts: 100, precip_in: 0.2 }
  ];
  const merged = mergeRain(weather, [
    { trail_key: "a", hour_ts: 100, rain_in: 0.05, source: "mrms" },
    { trail_key: "a", hour_ts: 200, rain_in: 0.3, source: "nbm" }
  ]);
  check("matching hour gains rain_obs_*; unmatched weather row untouched; orphan rain hour kept; sorted",
    merged.map((r) => [r.trail_key, r.hour_ts, r.precip_in ?? null, r.rain_obs_in ?? null, r.rain_obs_source ?? null]),
    [["a", 100, 0.2, 0.05, "mrms"], ["a", 200, null, 0.3, "nbm"], ["b", 100, 0.1, null, null]]);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
