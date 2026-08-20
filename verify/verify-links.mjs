import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";

const dom = new JSDOM(readFileSync("public/index.html", "utf8"), { runScripts: "outside-only", url: "http://localhost:8788/" });
const { window } = dom;
window.L = {
  map: () => { const m = { setView: () => m, addLayer: () => m, fitBounds: () => m, invalidateSize: () => m, on: () => m }; return m; },
  tileLayer: () => { const t = { addTo: () => t }; return t; },
  layerGroup: () => { const g = { addTo: () => g, clearLayers: () => {}, addLayer: () => g }; return g; },
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
writeFileSync("verify/script-links-test.mjs", script);
await import("./script-links-test.mjs");
await new Promise((r) => setTimeout(r, 400));

const d = window.document;
d.querySelector('[data-view="list"]').dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));

const rows = [...d.querySelectorAll(".trail-row")];
console.log("rows:", rows.length);
console.log("rows with a .row-links cell:", rows.filter((r) => r.querySelector(".row-links")).length);
console.log("rows with a directions link:", rows.filter((r) => r.querySelector("a.parking-link")).length);
console.log("rows with the '—' placeholder:", rows.filter((r) => r.querySelector(".parking-none")).length);

const sample = rows.find((r) => r.querySelector(".trail-name").textContent.includes("Quanah Hill"));
const links = [...sample.querySelectorAll(".row-links a")];
console.log("\nQuanah Hill links cell:");
for (const a of links) {
  console.log(`  "${a.textContent.trim()}" -> ${a.getAttribute("href")}`);
  console.log(`     target=${a.getAttribute("target")} rel=${a.getAttribute("rel")}`);
}

// every directions link must be a well-formed maps URL with real coords
const bad = rows.map((r) => r.querySelector("a.parking-link")).filter(Boolean)
  .filter((a) => !/^https:\/\/www\.google\.com\/maps\/dir\/\?api=1&destination=-?\d+\.\d+,-?\d+\.\d+$/.test(a.getAttribute("href")));
console.log("\nmalformed directions URLs:", bad.length ? bad.map((a) => a.getAttribute("href")) : "none");

// label check
const labels = new Set(rows.map((r) => r.querySelector("a.parking-link")?.textContent.trim()).filter(Boolean));
console.log("directions link label(s):", [...labels]);
console.log("any link still saying 'Parking':", [...labels].some((l) => /parking/i.test(l)));
