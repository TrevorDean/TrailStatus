// Verifies the Rain 8h column and the map popup's forecast block.
//
// Exits NON-ZERO on failure, like verify-stats-toggle and verify-filter-persist
// and unlike the harnesses that only print — the whole point of the third
// scenario below is that a weather outage must not degrade the status render,
// and that is not a thing anyone should have to notice in a log.
import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";
import { TRAILS } from "../public/trails.js";

const weatherUrl = (t) => `https://weather.com/weather/hourbyhour/l/${t.lat},${t.lng}`;

const html = readFileSync("public/index.html", "utf8");
const src = readFileSync("public/script.js", "utf8")
  .replace('from "/trails.js"', 'from "../public/trails.js"')
  .replace('from "/trail-stats.js"', 'from "../public/trail-stats.js"');

// Half the trailheads get a forecast, half get none — the placeholder path has
// to keep the row's cell count identical to a populated row, or the two grids
// drift the way the difficulty column once did.
const WITH = TRAILS.slice(0, 6).map((t) => t.key);
const WITHOUT = TRAILS.slice(6).map((t) => t.key);
const POPS = [5, 15, 35, 55, 80, 65, 20, 10, 0, 0, 0, 0];

function fakeForecast() {
  const currentHour = Math.floor(Date.now() / 3600000) * 3600;
  return {
    updatedAt: new Date().toISOString(),
    times: Array.from({ length: 12 }, (_, i) => currentHour + i * 3600),
    weather: Object.fromEntries(
      WITH.map((key) => [key, { pop: POPS, precip: POPS.map((p) => p / 1000), temp: POPS.map(() => 88) }])
    )
  };
}

let bootCount = 0;
async function boot(weatherResponder) {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost:8788/" });
  const { window } = dom;
  const popups = [];
  window.L = {
    map: () => { const m = { setView: () => m, addLayer: () => m, fitBounds: () => m, invalidateSize: () => m, on: () => m }; return m; },
    tileLayer: () => { const t = { addTo: () => t }; return t; },
    layerGroup: () => { const g = { addTo: () => g, clearLayers: () => {}, addLayer: () => g }; return g; },
    divIcon: () => ({}),
    marker: () => { const m = { bindTooltip: () => m, bindPopup: (h) => { popups.push(h); return m; } }; return m; }
  };
  // Route by path: the status feed must keep working no matter what weather does.
  window.fetch = async (url) =>
    String(url).includes("/api/weather")
      ? weatherResponder()
      : { ok: true, json: async () => ({ updatedAt: new Date().toISOString(), statuses: {} }) };
  Object.assign(globalThis, {
    window, document: window.document, localStorage: window.localStorage,
    fetch: window.fetch, L: window.L, location: window.location,
    requestAnimationFrame: (fn) => setTimeout(fn, 0)
  });
  const path = `verify/script-weather-${++bootCount}.mjs`;
  writeFileSync(path, src);
  await import(`./script-weather-${bootCount}.mjs`);
  await new Promise((r) => setTimeout(r, 400));
  const d = window.document;
  d.querySelector('[data-view="list"]').dispatchEvent(new window.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 200));
  return { window, d, popups };
}

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};
const rowFor = (d, key) => d.querySelector(`.trail-row[data-key="${key}"]`);
const cellsOf = (row) => [...row.children].filter((c) => !c.classList.contains("trail-stats-tip"));

console.log("=== forecast present for some trailheads, absent for the rest ===");
{
  const { window: w, d, popups } = await boot(() => ({ ok: true, json: async () => fakeForecast() }));

  const withRow = rowFor(d, WITH[0]);
  const withoutRow = rowFor(d, WITHOUT[0]);
  check("a trailhead with a forecast renders a rain cell", !!withRow.querySelector(".trail-rain"), true);
  check("its peak is the max over the 8 shown hours", withRow.querySelector(".rain-peak").textContent, "80%");
  check("it draws exactly 8 hour bars", withRow.querySelectorAll(".rain-bar").length, 8);
  check("the strip carries one aria-label, not eight", withRow.querySelectorAll(".rain-bars[aria-label]").length, 1);
  check("the peak takes its colour band from the value", withRow.querySelector(".rain-link").className.includes("rain-text-high"), true);

  check("a trailhead with no forecast renders the placeholder", withoutRow.querySelector(".rain-none")?.textContent, "—");
  check("cell counts match with and without a forecast", cellsOf(withRow).length, cellsOf(withoutRow).length);

  const heading = d.querySelector(".trail-heading");
  check("heading cell count matches row cell count", heading.children.length, cellsOf(withRow).length);
  check("Rain 8h is column 3", heading.children[2].textContent, "Rain 8h");
  check("the rain cell is in column 3 too", cellsOf(withRow)[2].classList.contains("trail-rain"), true);

  // The percentage and the icon share ONE anchor, so the row announces one link
  // rather than two to the same page.
  const peakLink = withRow.querySelector("a.rain-link");
  check("the percentage is a link", !!peakLink, true);
  check("the icon is inside that same anchor, not a second link",
    [peakLink.querySelectorAll(".rain-icon").length, withRow.querySelectorAll(".trail-rain a").length], [1, 1]);
  check("the icon is hidden from screen readers, the anchor is not",
    peakLink.querySelector(".rain-icon").getAttribute("aria-hidden"), "true");
  check("it points at this trailhead's Weather.com page",
    peakLink.getAttribute("href"), weatherUrl(TRAILS.find((t) => t.key === WITH[0])));
  check("it opens in a new tab, with rel=noopener",
    [peakLink.getAttribute("target"), peakLink.getAttribute("rel")], ["_blank", "noopener"]);
  check("it has an accessible name beyond the bare number",
    /Weather\.com/.test(peakLink.getAttribute("aria-label")), true);
  check("the rain cell is still just the link and the bars",
    withRow.querySelector(".trail-rain").children.length, 2);
  check("the placeholder stays inert", withoutRow.querySelector(".trail-rain a"), null);

  // Map popup
  d.querySelector('[data-view="map"]').dispatchEvent(new w.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  // renderMap() re-binds every popup on each render and the harness has driven
  // several by now, so only the newest full sweep of markers is meaningful.
  const latest = popups.slice(-TRAILS.length);
  // Every popup now has a rain block (it carries the Weather link either way);
  // only the ones with data have a strip inside it.
  check("every popup has a rain block", latest.filter((p) => p.includes("map-popup-rain")).length, TRAILS.length);
  const withBlock = latest.filter((p) => p.includes("rain-bars"));
  check("only trailheads with data get the hour strip", withBlock.length, WITH.length);
  check("the popup shows the bare percentage", withBlock[0].includes(">80%<"), true);
  // Text only — the class name is still .rain-peak, which is not what shows.
  check("the word 'peak' is gone from the popup's visible text",
    /peak/i.test(withBlock[0].replace(/<[^>]+>/g, " ")), false);
  check("every popup carries a Weather link, forecast or not",
    latest.filter((p) => p.includes("map-popup-weather")).length, TRAILS.length);
  // The link moved out of the shared links row and under the bars; the block now
  // renders for every trailhead, carrying just the link when there is no data.
  check("the Weather link sits inside the rain block, not the links row",
    /map-popup-rain[\s\S]*map-popup-weather[\s\S]*<\/div>[\s\S]*map-popup-links/.test(withBlock[0]), true);
  check("it comes after the hour bars", withBlock[0].indexOf("rain-bars") < withBlock[0].indexOf("map-popup-weather"), true);
  check("a trailhead with no forecast still gets the link, and no strip",
    latest.filter((p) => p.includes("map-popup-rain-empty") && p.includes("map-popup-weather") && !p.includes("rain-bars")).length,
    WITHOUT.length);
}

console.log("\n=== /api/weather returns 503 ===");
{
  const { d } = await boot(() => ({ ok: false, status: 503, json: async () => ({}) }));
  const rows = [...d.querySelectorAll(".trail-row")];
  check("every row still renders", rows.length, TRAILS.length);
  check("every row shows the placeholder", rows.filter((r) => r.querySelector(".rain-none")).length, TRAILS.length);
  check("no row lost a cell", new Set(rows.map((r) => cellsOf(r).length)).size, 1);
}

// The bug the user spotted on 2026-08-28: a cron that had not run in 8 hours
// left a block with only 4 future hours in it, and the strip silently shrank.
// The Worker now re-fetches rather than serving such a block, but the frontend
// must still degrade gracefully rather than break if one ever reaches it.
console.log("\n=== a partly-stale block (only 4 hours still ahead) ===");
{
  const short = fakeForecast();
  const currentHour = Math.floor(Date.now() / 3600000) * 3600;
  short.times = short.times.map((_, i) => currentHour - (8 - i) * 3600);
  const { d } = await boot(() => ({ ok: true, json: async () => short }));
  const row = rowFor(d, WITH[0]);
  check("it draws one bar per remaining hour, not a broken strip",
    row.querySelectorAll(".rain-bar").length, 4);
  check("the row keeps its cell count", cellsOf(row).length, cellsOf(rowFor(d, WITHOUT[0])).length);
  check("the link still works", !!row.querySelector("a.rain-link"), true);
}

console.log("\n=== the cached block has aged out (all hours in the past) ===");
{
  const stale = fakeForecast();
  const currentHour = Math.floor(Date.now() / 3600000) * 3600;
  stale.times = stale.times.map((_, i) => currentHour - (24 - i) * 3600);
  const { d } = await boot(() => ({ ok: true, json: async () => stale }));
  check("a trailhead with only past hours falls back to the placeholder",
    !!rowFor(d, WITH[0]).querySelector(".rain-none"), true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
