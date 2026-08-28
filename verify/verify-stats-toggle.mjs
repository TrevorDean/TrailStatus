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
// Favourite one trail so it renders twice (Favorites + city section).
window.localStorage.setItem("ntxmtb-favorites", JSON.stringify(["big-cedar"]));
Object.assign(globalThis, {
  window, document: window.document, localStorage: window.localStorage,
  fetch: window.fetch, L: window.L, location: window.location,
  requestAnimationFrame: (fn) => setTimeout(fn, 0)
});

const script = readFileSync("public/script.js", "utf8")
  .replace('from "/trails.js"', 'from "../public/trails.js"')
  .replace('from "/trail-stats.js"', 'from "../public/trail-stats.js"');
writeFileSync("verify/script-toggle-test.mjs", script);
await import("./script-toggle-test.mjs");
await new Promise((r) => setTimeout(r, 400));

const d = window.document;
d.querySelector('[data-view="list"]').dispatchEvent(new window.Event("click", { bubbles: true }));
await new Promise((r) => setTimeout(r, 200));

const click = (el) => el.dispatchEvent(new window.Event("click", { bubbles: true }));
const rowsFor = (key) => [...d.querySelectorAll(`.trail-row[data-key="${key}"]`)];
const openCount = () => d.querySelectorAll(".trail-row.stats-open").length;
let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

const { TRAIL_STATS } = await import("../public/trail-stats.js");
const { TRAILS } = await import("../public/trails.js");

console.log("=== markup ===");
check("rows rendered", d.querySelectorAll(".trail-row").length, TRAILS.length + 1); // +1 favourite duplicate
check("stats buttons = trailheads with stats (+1 dup)", d.querySelectorAll(".stats-btn").length, Object.keys(TRAIL_STATS).length + 1);
const noStatsKey = TRAILS.find((t) => !TRAIL_STATS[t.key]).key;
check(`no button for '${noStatsKey}' (no stats)`, rowsFor(noStatsKey)[0].querySelector(".stats-btn"), null);
check(`no panel for '${noStatsKey}'`, rowsFor(noStatsKey)[0].querySelector(".trail-stats-tip"), null);
// 8 since the Rain 8h column landed. Bump this together with the two
// grid-template-columns in styles.css and the heading spans in render().
check("row children excl. panel still 8", [...new Set([...d.querySelectorAll(".trail-row")].map(
  (r) => [...r.children].filter((c) => !c.classList.contains("trail-stats-tip")).length))], [8]);
check("panel no longer has role=tooltip", d.querySelector('.trail-stats-tip[role="tooltip"]'), null);

console.log("\n=== toggle ===");
const quanah = rowsFor("quanah-hill")[0];
check("starts closed", quanah.classList.contains("stats-open"), false);
check("aria-expanded starts false", quanah.querySelector(".stats-btn").getAttribute("aria-expanded"), "false");
click(quanah.querySelector(".stats-btn"));
check("opens on tap", quanah.classList.contains("stats-open"), true);
check("aria-expanded true", quanah.querySelector(".stats-btn").getAttribute("aria-expanded"), "true");
click(quanah.querySelector(".stats-btn"));
check("closes on second tap", quanah.classList.contains("stats-open"), false);
check("aria-expanded false again", quanah.querySelector(".stats-btn").getAttribute("aria-expanded"), "false");

console.log("\n=== several open at once ===");
click(rowsFor("quanah-hill")[0].querySelector(".stats-btn"));
click(rowsFor("cameron-park")[0].querySelector(".stats-btn"));
check("both stay open", openCount(), 2);

console.log("\n=== duplicate copies stay in sync (favourited trail) ===");
check("big-cedar renders twice", rowsFor("big-cedar").length, 2);
click(rowsFor("big-cedar")[0].querySelector(".stats-btn"));
check("both copies open from one tap", rowsFor("big-cedar").map((r) => r.classList.contains("stats-open")), [true, true]);
check("both aria-expanded true", rowsFor("big-cedar").map((r) => r.querySelector(".stats-btn").getAttribute("aria-expanded")), ["true", "true"]);

console.log("\n=== survives the render() forced by a star tap ===");
const before = openCount();
click(rowsFor("cameron-park")[0].querySelector(".fav-btn")); // triggers full render()
await new Promise((r) => setTimeout(r, 50));
check("open rows preserved across rebuild", openCount() >= before, true);
check("quanah still open after rebuild", rowsFor("quanah-hill")[0].classList.contains("stats-open"), true);
check("aria-expanded re-emitted after rebuild", rowsFor("quanah-hill")[0].querySelector(".stats-btn").getAttribute("aria-expanded"), "true");

console.log("\n=== does not hijack other taps ===");
const openBefore = openCount();
click(rowsFor("quanah-hill")[0].querySelector(".trail-name"));
check("trail-name link does not toggle", openCount(), openBefore);
click(rowsFor("big-cedar")[0].querySelector(".fav-btn"));
await new Promise((r) => setTimeout(r, 50));
const h2 = d.querySelector(".city-section:not(.favorites-section) h2");
click(h2);
check("section heading still collapses", h2.closest(".city-section").classList.contains("collapsed"), true);

console.log("\n=== CSS (text) ===");
const css = readFileSync("public/styles.css", "utf8");
const mobileBlock = css.slice(css.indexOf("@media (max-width: 760px)"));
const baseBlock = css.slice(0, css.indexOf("@media (max-width: 760px)"));
check("stats-btn hidden by default (desktop)", /\.stats-btn\s*\{[^}]*display:\s*none/.test(baseBlock), true);
check("stats-btn shown on mobile", /\.stats-btn\s*\{\s*display:\s*inline-flex/.test(mobileBlock), true);
check("panel goes in-flow on mobile", /\.trail-stats-tip\s*\{[^}]*position:\s*static/.test(mobileBlock), true);
check("panel spans the card", /\.trail-stats-tip\s*\{[^}]*grid-column:\s*1 \/ -1/.test(mobileBlock), true);
check("panel wraps on mobile", /\.trail-stats-tip\s*\{[^}]*white-space:\s*normal/.test(mobileBlock), true);
check("opacity pinned so hover rule can't fight it", /\.trail-stats-tip\s*\{[^}]*opacity:\s*1/.test(mobileBlock), true);
check("open rule present", /\.trail-row\.stats-open \.trail-stats-tip\s*\{\s*display:\s*block/.test(mobileBlock), true);
check("desktop hover rule untouched", /\.trail-name-cell:hover ~ \.trail-stats-tip,\s*\.trail-name-cell:focus-within ~ \.trail-stats-tip/.test(css), true);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
