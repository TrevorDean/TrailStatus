import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("public/index.html", "utf8");

// --- static markup check: no flash of the wrong view before JS runs ---
const pre = new JSDOM(html).window.document;
console.log("=== markup before JS ===");
console.log("  active view button :", pre.querySelector("[data-view].active")?.dataset.view);
console.log("  #trail-groups hidden:", pre.querySelector("#trail-groups").classList.contains("hidden"));
console.log("  #trail-map hidden   :", pre.querySelector("#trail-map").classList.contains("hidden"));

const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost:8788/" });
const { window } = dom;
const captured = { markers: 0, invalidate: 0 };
window.L = {
  map: () => { const m = { setView: () => m, addLayer: () => m, fitBounds: () => m, invalidateSize: () => { captured.invalidate++; return m; }, on: () => m }; return m; },
  tileLayer: () => { const t = { addTo: () => t }; return t; },
  layerGroup: () => { const g = { addTo: () => g, clearLayers: () => { captured.markers = 0; }, addLayer: () => { captured.markers++; return g; } }; return g; },
  divIcon: () => ({}),
  marker: () => { const m = { bindTooltip: () => m, bindPopup: () => m }; return m; }
};
window.fetch = async () => ({ ok: true, json: async () => ({ updatedAt: new Date().toISOString(), statuses: {} }) });
Object.assign(globalThis, {
  window, document: window.document, localStorage: window.localStorage,
  fetch: window.fetch, L: window.L, location: window.location,
  requestAnimationFrame: (fn) => setTimeout(fn, 0)
});

const script = readFileSync("public/script.js", "utf8")
  .replace('from "/trails.js"', 'from "../public/trails.js"')
  .replace('from "/trail-stats.js"', 'from "../public/trail-stats.js"');
writeFileSync("verify/script-dv-test.mjs", script);
await import("./script-dv-test.mjs");
await new Promise((r) => setTimeout(r, 500));

const d = window.document;
console.log("\n=== after load ===");
console.log("  active view button :", d.querySelector("[data-view].active")?.dataset.view);
console.log("  #trail-groups hidden:", d.querySelector("#trail-groups").classList.contains("hidden"));
console.log("  #trail-map hidden   :", d.querySelector("#trail-map").classList.contains("hidden"));
console.log("  markers drawn       :", captured.markers);
console.log("  invalidateSize calls:", captured.invalidate);

// --- switching to list must still work ---
d.querySelector('[data-view="list"]').dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));
console.log("\n=== after clicking List ===");
console.log("  active view button :", d.querySelector("[data-view].active")?.dataset.view);
console.log("  rows rendered      :", d.querySelectorAll(".trail-row").length);
console.log("  #trail-map hidden  :", d.querySelector("#trail-map").classList.contains("hidden"));

// --- and back to map ---
d.querySelector('[data-view="map"]').dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));
console.log("\n=== back to Map ===  markers:", captured.markers, "| map hidden:", d.querySelector("#trail-map").classList.contains("hidden"));

// --- Erwin Park Skill Park: override with NO stats data ---
d.querySelector('[data-view="list"]').dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));
const erwin = [...d.querySelectorAll(".trail-row")].find((r) => r.querySelector(".trail-name").textContent.trim() === "Erwin Park Skill Park");
console.log("\n=== Erwin Park Skill Park (override, no stats) ===");
console.log("  difficulty cell:", `"${erwin.querySelector(".trail-difficulty").textContent}"`);
console.log("  has stats tooltip:", !!erwin.querySelector(".trail-stats-tip"), "(expected false — no sub-trail data)");
d.querySelector('[data-difficulty="intermediate"]').dispatchEvent(new window.Event("click", { bubbles: true }));
const shows = [...d.querySelectorAll(".trail-row")].some((r) => r.querySelector(".trail-name").textContent.trim() === "Erwin Park Skill Park");
console.log("  appears under Intermediate filter:", shows);
console.log("  rows with an em dash now:", [...d.querySelectorAll(".trail-difficulty")].filter((c) => c.textContent === "—").length);
