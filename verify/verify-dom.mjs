// Verifies rendering + data wiring under jsdom. Cannot verify :hover CSS
// (jsdom has no hover state) — that needs a real browser.
import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("public/index.html", "utf8");
const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost:8788/" });
const { window } = dom;

// Stub what script.js touches that jsdom lacks.
window.L = {
  map: () => { const m = { setView: () => m, addLayer: () => m, fitBounds: () => m, invalidateSize: () => m, on: () => m }; return m; },
  tileLayer: () => { const t = { addTo: () => t }; return t; },
  layerGroup: () => { const g = { addTo: () => g, clearLayers: () => {}, addLayer: () => g }; return g; },
  divIcon: () => ({}),
  marker: () => {
    const m = {
      bindTooltip: (text) => { captured.tooltips.push(text); return m; },
      bindPopup: (html) => { captured.popups.push(html); return m; }
    };
    return m;
  }
};
const captured = { tooltips: [], popups: [] };
window.fetch = async () => ({ ok: true, json: async () => ({ updatedAt: new Date().toISOString(), statuses: {} }) });
window.localStorage.setItem("favorites", "[]");

globalThis.window = window;
globalThis.document = window.document;
globalThis.location = window.location;
globalThis.localStorage = window.localStorage;
globalThis.fetch = window.fetch;
globalThis.L = window.L;
globalThis.requestAnimationFrame = (fn) => setTimeout(fn, 0);

const script = readFileSync("public/script.js", "utf8")
  .replace('from "/trails.js"', 'from "../public/trails.js"')
  .replace('from "/trail-stats.js"', 'from "../public/trail-stats.js"');
writeFileSync("verify/script-under-test.mjs", script);
await import("./script-under-test.mjs");
await new Promise((r) => setTimeout(r, 400));

const d = window.document;
const rows = d.querySelectorAll(".trail-row");
const tips = d.querySelectorAll(".trail-stats-tip");
console.log("trail rows rendered:", rows.length);
console.log("stats tooltips in DOM:", tips.length);

const { TRAILS } = await import("../public/trails.js");
const { TRAIL_STATS } = await import("../public/trail-stats.js");
const expected = TRAILS.filter((t) => TRAIL_STATS[t.key]).length;
console.log("trails with stats data:", expected, "| trails without:", TRAILS.length - expected);

// Spot-check one known trailhead end to end.
for (const name of ["Quanah Hill", "Big Cedar Wilderness Trails", "Cameron Park"]) {
  const row = [...rows].find((r) => r.querySelector(".trail-name")?.textContent.trim() === name);
  if (!row) { console.log(`\n${name}: ROW NOT FOUND`); continue; }
  const tip = row.querySelector(".trail-stats-tip");
  console.log(`\n${name}:`);
  console.log("  tip:", tip ? tip.textContent.replace(/\s+/g, " ").trim() : "MISSING");
}

// --- map view: marker tooltips + detail popups ---
d.querySelector('[data-view="map"]').dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 300));

console.log("\n=== MAP MARKER HOVER (should be name + miles + climb, NO status) ===");
for (const t of captured.tooltips.slice(0, 3)) console.log("  ", t);
const withStatus = captured.tooltips.filter((t) => /Open|Closed|Loading|Caution|Unavailable/i.test(t));
console.log("  tooltips still mentioning status:", withStatus.length, withStatus.slice(0, 2));

console.log("\n=== MAP DETAIL POPUP stats block ===");
const popupWithStats = captured.popups.find((p) => p.includes("map-popup-stats"));
if (popupWithStats) {
  const block = popupWithStats.match(/<div class="map-popup-stats">[\s\S]*?<\/div>\s*<\/div>/);
  console.log("  ", block ? block[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() : "?");
}
console.log("  popups containing 'Total Climb':", captured.popups.filter((p) => p.includes("Total Climb")).length);
console.log("  popups still containing a 'Trails:' stat row:", captured.popups.filter((p) => /stat-label">Trails:/.test(p)).length);

// A beginner-band trailhead (<=1.4) should read "Beginner N".
const begPopup = captured.popups.find((p) => p.includes("Beginner"));
console.log("  sample beginner difficulty:", begPopup ? begPopup.match(/Difficulty:<\/span><span class="stat-value">([^<]*)/)?.[1] : "NONE FOUND");

// Trails with no stats must not emit an empty tooltip shell.
const noStats = TRAILS.filter((t) => !TRAIL_STATS[t.key]).map((t) => t.name);
console.log("\ntrailheads with no stats (should have no tip):", noStats.join(", ") || "(none)");
for (const name of noStats) {
  const row = [...rows].find((r) => r.querySelector(".trail-name")?.textContent.trim() === name);
  if (row) console.log(`  ${name}: tip present? ${!!row.querySelector(".trail-stats-tip")}`);
}
