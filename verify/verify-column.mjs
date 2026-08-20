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
writeFileSync("verify/script-col-test.mjs", script);
await import("./script-col-test.mjs");
await new Promise((r) => setTimeout(r, 400));

const d = window.document;
// The site opens on the map now, so select the list before inspecting rows.
d.querySelector('[data-view="list"]').dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));
const css = readFileSync("public/styles.css", "utf8");
const gridCols = (css.match(/grid-template-columns: minmax\(80px[^;]*/g) || []).map((s) => s.split(" ").length - 1);

// header vs row cell counts must match, or the grid silently misaligns
const heads = [...d.querySelectorAll(".trail-heading")];
const headCounts = new Set(heads.map((h) => h.children.length));
const rowCounts = new Set([...d.querySelectorAll(".trail-row")].map(
  (r) => [...r.children].filter((c) => !c.classList.contains("trail-stats-tip")).length
));
console.log("heading cell counts:", [...headCounts], "| headings found:", heads.length);
console.log("row cell counts (excl. tooltip):", [...rowCounts]);
console.log("grid track counts in CSS:", gridCols);
console.log("ALIGNED:", headCounts.size === 1 && rowCounts.size === 1 && [...headCounts][0] === [...rowCounts][0] ? "yes" : "NO — MISMATCH");

// header order
console.log("\nheader order:", [...heads[0].children].map((c) => c.textContent).join(" | "));

// difficulty column position and content
const row = [...d.querySelectorAll(".trail-row")].find((r) => r.querySelector(".trail-name").textContent.includes("Quanah Hill"));
const cells = [...row.children].filter((c) => !c.classList.contains("trail-stats-tip"));
console.log("Quanah Hill cells:", cells.map((c, i) => `${i}:${c.className.split(" ")[0]}`).join(" "));
console.log("difficulty index:", cells.findIndex((c) => c.classList.contains("trail-difficulty")),
            "| city index:", cells.findIndex((c) => c.classList.contains("trail-city")));

console.log("\nsample difficulty cells:");
for (const name of ["Quanah Hill", "The Pit", "Cross Timbers", "Erwin Park Skill Park", "Trinity Track"]) {
  const r = [...d.querySelectorAll(".trail-row")].find((x) => x.querySelector(".trail-name").textContent.trim() === name);
  console.log(`  ${name.padEnd(24)} "${r ? r.querySelector(".trail-difficulty").textContent : "ROW MISSING"}"`);
}
const empty = [...d.querySelectorAll(".trail-row")].filter((r) => !r.querySelector(".trail-difficulty")?.textContent.trim());
console.log("rows with an empty difficulty cell:", empty.length);
