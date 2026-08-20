import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";

const dom = new JSDOM(readFileSync("public/index.html", "utf8"), { runScripts: "outside-only", url: "http://localhost:8788/" });
const { window } = dom;
const captured = { tooltips: [] };
window.L = {
  map: () => { const m = { setView: () => m, addLayer: () => m, fitBounds: () => m, invalidateSize: () => m, on: () => m }; return m; },
  tileLayer: () => { const t = { addTo: () => t }; return t; },
  layerGroup: () => { const g = { addTo: () => g, clearLayers: () => { captured.tooltips.length = 0; }, addLayer: () => g }; return g; },
  divIcon: () => ({}),
  marker: () => { const m = { bindTooltip: (t) => { captured.tooltips.push(t); return m; }, bindPopup: () => m }; return m; }
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
writeFileSync("verify/script-filter-test.mjs", script);
await import("./script-filter-test.mjs");
await new Promise((r) => setTimeout(r, 400));

const d = window.document;
const { TRAIL_STATS } = await import("../public/trail-stats.js");
const { TRAILS } = await import("../public/trails.js");

const label = [...d.querySelectorAll(".controls label")].map((l) => l.textContent.trim());
console.log("control labels:", label.join(" | "));
console.log("difficulty buttons:", [...d.querySelectorAll("[data-difficulty]")].map((b) => b.textContent).join(", "));

const rawBand = (a) => (a <= 1.4 ? "beginner" : a <= 2.2 ? "intermediate" : "expert");
// Mirror the site: a trails.js `difficulty` override wins over the raw number.
const band = (t) => {
  if (t.difficulty) return t.difficulty.toLowerCase();
  const s = TRAIL_STATS[t.key];
  return s ? rawBand(s.avgDifficulty) : null;
};
const expected = { all: TRAILS.length };
for (const b of ["beginner", "intermediate", "expert"]) {
  expected[b] = TRAILS.filter((t) => band(t) === b).length;
}

// The site now opens on the map, so the list must be selected before counting rows.
d.querySelector('[data-view="list"]').dispatchEvent(new window.Event("click", { bubbles: true }));
console.log("\n--- LIST VIEW ---");
for (const mode of ["all", "beginner", "intermediate", "expert"]) {
  d.querySelector(`[data-difficulty="${mode}"]`).dispatchEvent(new window.Event("click", { bubbles: true }));
  const rows = d.querySelectorAll(".trail-row").length;
  const active = d.querySelector("[data-difficulty].active")?.dataset.difficulty;
  const ok = rows === expected[mode] ? "OK" : `MISMATCH expected ${expected[mode]}`;
  console.log(`  ${mode.padEnd(13)} rows=${String(rows).padStart(3)}  ${ok}  active=${active}`);
  // every visible row must genuinely be in that band
  if (mode !== "all") {
    const wrong = [...d.querySelectorAll(".trail-row")].filter((r) => {
      const key = r.querySelector(".fav-btn").dataset.key;
      const t = TRAILS.find((x) => x.key === key);
      return band(t) !== mode;
    });
    if (wrong.length) console.log("    WRONG BAND ROWS:", wrong.map((r) => r.querySelector(".trail-name").textContent));
  }
}

console.log("\n--- MAP VIEW (markers should thin too) ---");
d.querySelector('[data-view="map"]').dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));
for (const mode of ["all", "expert", "beginner"]) {
  d.querySelector(`[data-difficulty="${mode}"]`).dispatchEvent(new window.Event("click", { bubbles: true }));
  console.log(`  ${mode.padEnd(13)} markers=${captured.tooltips.length}`);
  if (mode === "expert") console.log("    expert parks:", captured.tooltips.map((t) => t.split(" — ")[0]).join(", "));
}

console.log("\n--- band labels now in use ---");
const seen = new Set(TRAILS.map(band).filter(Boolean));
console.log("  ", [...seen].join(", "), "| any 'Advanced' left in script.js:", readFileSync("public/script.js", "utf8").includes("Advanced"));
