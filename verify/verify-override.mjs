import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";

// Inject a temporary override into a COPY of trails.js to prove the mechanism
// works end to end, without touching the real file.
const trailsSrc = readFileSync("public/trails.js", "utf8")
  .replace('{ key: "cross-timbers"', '{ difficulty: "Beginner", key: "cross-timbers"');
writeFileSync("verify/trails-override.js", trailsSrc);

const dom = new JSDOM(readFileSync("public/index.html", "utf8"), { runScripts: "outside-only", url: "http://localhost:8788/" });
const { window } = dom;
const captured = { tooltips: [], popups: [] };
window.L = {
  map: () => { const m = { setView: () => m, addLayer: () => m, fitBounds: () => m, invalidateSize: () => m, on: () => m }; return m; },
  tileLayer: () => { const t = { addTo: () => t }; return t; },
  layerGroup: () => { const g = { addTo: () => g, clearLayers: () => { captured.popups.length = 0; }, addLayer: () => g }; return g; },
  divIcon: () => ({}),
  marker: () => { const m = { bindTooltip: (t) => { captured.tooltips.push(t); return m; }, bindPopup: (p) => { captured.popups.push(p); return m; } }; return m; }
};
window.fetch = async () => ({ ok: true, json: async () => ({ updatedAt: new Date().toISOString(), statuses: {} }) });
Object.assign(globalThis, {
  window, document: window.document, localStorage: window.localStorage,
  fetch: window.fetch, L: window.L, location: window.location,
  requestAnimationFrame: (fn) => setTimeout(fn, 0)
});

const script = readFileSync("public/script.js", "utf8")
  .replace('from "/trails.js"', 'from "./trails-override.js"')
  .replace('from "/trail-stats.js"', 'from "../public/trail-stats.js"');
writeFileSync("verify/script-ovr-test.mjs", script);
await import("./script-ovr-test.mjs");
await new Promise((r) => setTimeout(r, 400));

const d = window.document;
// DEFAULT_VIEW became "map" in 8bde115, so no .trail-row exists until the list
// is selected. This harness predated that and silently broke; verify-column.mjs
// carries the same click for the same reason.
d.querySelector('[data-view="list"]').dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));
const cellFor = (name) => {
  const r = [...d.querySelectorAll(".trail-row")].find((x) => x.querySelector(".trail-name").textContent.trim() === name);
  return r ? r.querySelector(".trail-difficulty").textContent : "ROW MISSING";
};

console.log("=== column shows band only, no number ===");
for (const n of ["Quanah Hill", "The Pit", "Trinity Track", "Erwin Park Skill Park"]) {
  console.log(`  ${n.padEnd(24)} "${cellFor(n)}"`);
}
const anyDigits = [...d.querySelectorAll(".trail-difficulty")].filter((c) => /\d/.test(c.textContent));
console.log("  cells still containing a digit:", anyDigits.length ? anyDigits.map((c) => c.textContent) : "none");

console.log("\n=== tooltip / popup also band-only ===");
const tip = d.querySelector(".trail-stats-tip").textContent.replace(/\s+/g, " ");
console.log("  tip:", tip);

console.log("\n=== override: cross-timbers forced to Beginner (real value 2.6 = Expert) ===");
console.log("  column cell:", `"${cellFor("Cross Timbers")}"`);
d.querySelector('[data-difficulty="beginner"]').dispatchEvent(new window.Event("click", { bubbles: true }));
const inBeginner = [...d.querySelectorAll(".trail-row")].some((r) => r.querySelector(".trail-name").textContent.trim() === "Cross Timbers");
console.log("  appears under Beginner filter:", inBeginner);
d.querySelector('[data-difficulty="expert"]').dispatchEvent(new window.Event("click", { bubbles: true }));
const stillExpert = [...d.querySelectorAll(".trail-row")].some((r) => r.querySelector(".trail-name").textContent.trim() === "Cross Timbers");
console.log("  still under Expert filter (should be false):", stillExpert);

console.log("\n=== numeric value still present in shipped data ===");
const { TRAIL_STATS } = await import("../public/trail-stats.js");
console.log("  cross-timbers avgDifficulty in trail-stats.js:", TRAIL_STATS["cross-timbers"].avgDifficulty);
