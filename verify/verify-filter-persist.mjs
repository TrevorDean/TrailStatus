import { JSDOM } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync("public/index.html", "utf8");
const src = readFileSync("public/script.js", "utf8")
  .replace('from "/trails.js"', 'from "../public/trails.js"')
  .replace('from "/trail-stats.js"', 'from "../public/trail-stats.js"');

// A localStorage that survives between the two page loads, the way a real
// browser's does. jsdom gives each JSDOM instance its own, so share one.
const store = new Map();
const sharedStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear()
};

let bootCount = 0;
// switchToList: the row-counting assertions need the list rendered, but that
// click now persists view:"list" — so view assertions must boot without it.
async function boot(switchToList = true) {
  const dom = new JSDOM(html, { runScripts: "outside-only", url: "http://localhost:8788/" });
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
    window, document: window.document, localStorage: sharedStorage,
    fetch: window.fetch, L: window.L, location: window.location,
    requestAnimationFrame: (fn) => setTimeout(fn, 0)
  });
  // Fresh module URL each boot so the module body re-executes.
  const path = `verify/script-persist-${++bootCount}.mjs`;
  writeFileSync(path, src);
  await import(`./script-persist-${bootCount}.mjs`);
  await new Promise((r) => setTimeout(r, 400));
  const d = window.document;
  // Capture the view the page opened on BEFORE switching to the list to count rows.
  const initialView = d.querySelector("[data-view].active")?.dataset.view;
  if (switchToList) {
    d.querySelector('[data-view="list"]').dispatchEvent(new window.Event("click", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 150));
  }
  return { window, d, initialView };
}

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};
const activeOf = (d, attr) => [...d.querySelectorAll(`[data-${attr}].active`)].map((b) => b.dataset[attr === "status-filter" ? "statusFilter" : attr]);

const click = (el, win) => el.dispatchEvent(new win.Event("click", { bubbles: true }));

console.log("=== load 1: defaults, then set filters ===");
// boot(false): a pure page load with no interaction must not write storage.
let { window: w1, d: d1 } = await boot(false);
check("a visit with no interaction writes nothing", sharedStorage.getItem("ntxmtb-filters"), null);
check("region defaults to All", activeOf(d1, "filter"), ["all"]);
check("difficulty defaults to All", activeOf(d1, "difficulty"), ["all"]);
click(d1.querySelector('[data-view="list"]'), w1);
await new Promise((r) => setTimeout(r, 150));
const rowsAll = d1.querySelectorAll(".trail-row").length;
click(d1.querySelector('[data-difficulty="expert"]'), w1);
click(d1.querySelector('[data-filter="Fort Worth"]'), w1);
click(d1.querySelector('[data-status-filter="rideable"]'), w1);
d1.querySelector("#trail-search").value = "park";
d1.querySelector("#trail-search").dispatchEvent(new w1.Event("input", { bubbles: true }));

const saved = JSON.parse(sharedStorage.getItem("ntxmtb-filters"));
console.log("\n  saved payload:", JSON.stringify(saved));
check("regions persisted", saved.regions, ["Fort Worth"]);
check("difficulty persisted", saved.difficulty, "expert");
check("status persisted", saved.status, "rideable");
check("search persisted", saved.search, "park");
const rowsFiltered = d1.querySelectorAll(".trail-row").length;

console.log("\n=== load 2: simulate reload ===");
const { d: d2, initialView: view2 } = await boot();
check("region restored as active", activeOf(d2, "filter"), ["Fort Worth"]);
check("difficulty restored as active", activeOf(d2, "difficulty"), ["expert"]);
check("status restored as active", activeOf(d2, "status-filter"), ["rideable"]);
check("search box restored", d2.querySelector("#trail-search").value, "park");
check("clear button visible for restored search", d2.querySelector("#search-clear").classList.contains("hidden"), false);
check("row count matches the filtered list, not the full one", d2.querySelectorAll(".trail-row").length, rowsFiltered);
check("and is not the unfiltered count", d2.querySelectorAll(".trail-row").length !== rowsAll, true);

console.log("\n=== view persists ===");
// Both boots above ended on the list (the harness switched to it), so that is
// genuinely the last view the "user" left in.
check("saved payload records the list", JSON.parse(sharedStorage.getItem("ntxmtb-filters")).view, "list");
const { window: wv, d: dv, initialView: viewList } = await boot(false);
check("reload reopens on the list, not the map default", viewList, "list");

// Now leave on the map and confirm that round-trips too.
click(dv.querySelector('[data-view="map"]'), wv);
check("saved payload records the map", JSON.parse(sharedStorage.getItem("ntxmtb-filters")).view, "map");
const { initialView: viewMap } = await boot(false);
check("reload reopens on the map", viewMap, "map");

console.log("\n=== stale / corrupt values are ignored ===");
store.set("ntxmtb-filters", JSON.stringify({ regions: ["Atlantis"], status: "bogus", difficulty: "legendary", search: 42, view: "hologram" }));
const { initialView: view3 } = await boot(false);
check("unknown view falls back to the map default", view3, "map");
const { d: d3 } = await boot();
check("unknown region dropped", activeOf(d3, "filter"), ["all"]);
check("unknown status falls back to all", activeOf(d3, "status-filter"), ["all"]);
check("unknown difficulty falls back to all", activeOf(d3, "difficulty"), ["all"]);
check("non-string search ignored", d3.querySelector("#trail-search").value, "");
check("full list shown", d3.querySelectorAll(".trail-row").length, rowsAll);

store.set("ntxmtb-filters", "{not valid json");
const { d: d4 } = await boot();
check("corrupt JSON does not throw, defaults used", activeOf(d4, "filter"), ["all"]);
check("full list after corrupt entry", d4.querySelectorAll(".trail-row").length, rowsAll);

console.log(`\n${fail === 0 ? "ALL PASS" : "FAILURES"}: ${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
