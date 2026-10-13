// Verifies the drying-model estimates in the page: the second line in the
// Updated cell ("Reopen ~Thu PM", "May close today eve") and the popup's
// Estimate row. An estimate shows only while the live status agrees with it,
// adds no grid cell, and a failed /api/predictions renders nothing at all.
//
// Boots the real public/script.js under jsdom, like verify-weather.mjs.
// Exits NON-ZERO on failure.
import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";
import { TRAILS } from "../public/trails.js";

const html = readFileSync("public/index.html", "utf8");
const src = readFileSync("public/script.js", "utf8")
  .replace('from "/status-buckets.js"', 'from "../public/status-buckets.js"')
  .replace('from "/trails.js"', 'from "../public/trails.js"')
  .replace('from "/trail-stats.js"', 'from "../public/trail-stats.js"');

const [CLOSED, OPEN, REOPENED, OVERDUE, PLAIN] = TRAILS.slice(0, 5).map((t) => t.key);
const now = Date.now() / 1000;
const STATUSES = {
  [CLOSED]: { status: "Closed", updated: "1 day" },
  [OPEN]: { status: "Open", updated: "1 day" },
  [REOPENED]: { status: "Open", updated: "1 min" },   // reopened since the estimate
  [OVERDUE]: { status: "Closed", updated: "3 days" },
  [PLAIN]: { status: "Open", updated: "1 day" }
};
const PREDICTIONS = {
  updatedAt: new Date().toISOString(),
  bandHours: 47,
  predictions: {
    [CLOSED]: { basis: "weather", reopenAt: now + 3 * 86400 },
    [OPEN]: { basis: "forecast", closeAt: now + 6 * 3600 },
    [REOPENED]: { basis: "weather", reopenAt: now + 86400 },
    [OVERDUE]: { basis: "weather", reopenAt: now + 3600, overdue: true },
    [PLAIN]: { basis: "open" }
  }
};

let bootCount = 0;
async function boot(predictionsResponder) {
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
  window.fetch = async (url) => {
    const u = String(url);
    if (u.includes("/api/predictions")) return predictionsResponder();
    if (u.includes("/api/weather")) return { ok: false, status: 503, json: async () => ({}) };
    return { ok: true, json: async () => ({ updatedAt: new Date().toISOString(), statuses: STATUSES }) };
  };
  Object.assign(globalThis, {
    window, document: window.document, localStorage: window.localStorage,
    fetch: window.fetch, L: window.L, location: window.location,
    requestAnimationFrame: (fn) => setTimeout(fn, 0)
  });
  writeFileSync(`verify/script-predictions-${++bootCount}.mjs`, src);
  await import(`./script-predictions-${bootCount}.mjs`);
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
const line = (d, key) => rowFor(d, key).querySelector(".prediction");

console.log("=== estimates present ===");
{
  const { window: w, d, popups } = await boot(() => ({ ok: true, json: async () => PREDICTIONS }));
  check("closed trail: a reopening estimate", /^Reopen ~/.test(line(d, CLOSED)?.textContent || ""), true);
  check("...styled as a reopening", line(d, CLOSED)?.classList.contains("prediction-reopen"), true);
  check("...with the error band in its title", /±47 h/.test(line(d, CLOSED)?.getAttribute("title") || ""), true);
  check("open trail, rain coming: a closing warning", /^May close /.test(line(d, OPEN)?.textContent || ""), true);
  check("...styled as a warning", line(d, OPEN)?.classList.contains("prediction-close"), true);
  check("trail reopened since the estimate: nothing shown", line(d, REOPENED), null);
  check("drained but still shut: 'Should be dry'", line(d, OVERDUE)?.textContent, "Should be dry");
  check("nothing to say: nothing shown", line(d, PLAIN), null);
  check("the estimate lives inside the Updated cell", line(d, CLOSED)?.parentElement.classList.contains("status-updated"), true);
  check("and adds no grid cell", cellsOf(rowFor(d, CLOSED)).length, cellsOf(rowFor(d, PLAIN)).length);
  check("heading still matches the row", d.querySelector(".trail-heading").children.length, cellsOf(rowFor(d, CLOSED)).length);

  d.querySelector('[data-view="map"]').dispatchEvent(new w.Event("click", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 300));
  const latest = popups.slice(-TRAILS.length);
  const popupFor = (key) => latest.find((p) => p.includes(`href="${TRAILS.find((t) => t.key === key).url}"`));
  check("closed trail's popup spells out the estimate", /Estimate:<\/strong> Estimated reopening /.test(popupFor(CLOSED) || ""), true);
  check("open trail's popup carries the warning", /Forecast rain may close/.test(popupFor(OPEN) || ""), true);
  check("a trail with nothing to say has no Estimate row", /Estimate:/.test(popupFor(PLAIN) || ""), false);
}

console.log("\n=== /api/predictions down ===");
{
  const { d } = await boot(() => ({ ok: false, status: 503, json: async () => ({}) }));
  check("no estimate lines anywhere", d.querySelectorAll(".prediction").length, 0);
  check("rows still render", !!rowFor(d, CLOSED), true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
