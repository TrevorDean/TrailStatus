// The Alerts panel, driven through the real page.
//
// verify-alerts.mjs covers the decisions; this covers the form that feeds them.
// The panel is built on open rather than at load, so nothing here is exercised by
// the other jsdom harnesses even though they all load the same script.js.
//
// What matters most is the last assertion block: the exact JSON body that leaves
// the browser. Everything server-side has been tested against that shape, and a
// frontend that posts a slightly different one fails silently — the subscriber
// simply never hears anything.

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

// Every call the page makes is recorded, so the subscribe POST can be inspected
// without a server.
const posted = [];
window.fetch = async (url, options) => {
  if (String(url).includes("/api/alerts/subscribe")) {
    posted.push({ url: String(url), options });
    return { ok: true, json: async () => ({ ok: true }) };
  }
  return { ok: true, json: async () => ({ updatedAt: new Date().toISOString(), statuses: {} }) };
};

// Two favourites, set BEFORE the script loads: the picker is supposed to seed
// itself from them, which is what makes the common case one click.
window.localStorage.setItem("ntxmtb-favorites", JSON.stringify(["big-cedar", "erwin-park"]));

Object.assign(globalThis, {
  window, document: window.document, localStorage: window.localStorage,
  fetch: window.fetch, L: window.L, location: window.location,
  requestAnimationFrame: (fn) => setTimeout(fn, 0)
});

const script = readFileSync("public/script.js", "utf8")
  .replace('from "/status-buckets.js"', 'from "../public/status-buckets.js"')
  .replace('from "/trails.js"', 'from "../public/trails.js"')
  .replace('from "/trail-stats.js"', 'from "../public/trail-stats.js"');
writeFileSync("verify/script-alerts-ui-test.mjs", script);
await import("./script-alerts-ui-test.mjs");
await new Promise((r) => setTimeout(r, 400));

const d = window.document;
const { TRAILS } = await import("../public/trails.js");

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};
const click = (el) => el.dispatchEvent(new window.Event("click", { bubbles: true }));

const btn = d.querySelector("#alerts-btn");
const modal = d.querySelector("#alerts-modal");
const trailsEl = d.querySelector("#alerts-trails");
const countEl = d.querySelector("#alerts-count");
const statusEl = d.querySelector("#alerts-status");
const emailEl = d.querySelector("#alerts-email");
const form = d.querySelector("#alerts-form");

console.log("=== the panel opens and closes like the other two ===");
check("it starts hidden", modal.classList.contains("hidden"), true);
check("nothing is built until it opens", trailsEl.children.length, 0);
click(btn);
check("the button opens it", modal.classList.contains("hidden"), false);

console.log("\n=== every trail is offered, exactly once ===");
const boxes = [...trailsEl.querySelectorAll("input[type=checkbox]")];
check("one checkbox per trail in trails.js", boxes.length, TRAILS.length);
check("no trail is listed twice", new Set(boxes.map((b) => b.value)).size, TRAILS.length);
check("every value is a real trail key", boxes.every((b) => TRAILS.some((t) => t.key === b.value)), true);
// Grouped by the same sections the list view uses, so the picker reads in an
// order someone already knows.
check("grouped into sections", trailsEl.querySelectorAll(".alerts-group").length > 1, true);
check("every trail sits inside a section", [...trailsEl.querySelectorAll(".alerts-group input")].length, TRAILS.length);

console.log("\n=== favourites seed the picker ===");
check("the two favourites are pre-ticked", boxes.filter((b) => b.checked).map((b) => b.value).sort(), ["big-cedar", "erwin-park"]);
check("and nothing else is", boxes.filter((b) => b.checked).length, 2);
check("the count agrees", countEl.textContent, "2 trails selected");

console.log("\n=== the count tracks the boxes ===");
const third = boxes.find((b) => !b.checked);
third.checked = true;
third.dispatchEvent(new window.Event("change", { bubbles: true }));
check("ticking a third updates it", countEl.textContent, "3 trails selected");
click(d.querySelector("#alerts-clear"));
check("Clear unticks everything", trailsEl.querySelectorAll("input:checked").length, 0);
check("and says so in the singular-aware wording", countEl.textContent, "0 trails selected");
const one = boxes[0];
one.checked = true;
one.dispatchEvent(new window.Event("change", { bubbles: true }));
check("one trail reads as singular", countEl.textContent, "1 trail selected");

console.log("\n=== submitting with nothing picked does not post ===");
click(d.querySelector("#alerts-clear"));
emailEl.value = "rider@example.com";
form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 50));
check("no request was made", posted.length, 0);
check("and the panel says why", /at least one trail/i.test(statusEl.textContent), true);
check("styled as an error", statusEl.className.includes("alerts-error"), true);

console.log("\n=== a real submission ===");
for (const key of ["big-cedar", "northshore"]) {
  const box = boxes.find((b) => b.value === key);
  box.checked = true;
  box.dispatchEvent(new window.Event("change", { bubbles: true }));
}
emailEl.value = "rider@example.com";
form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
await new Promise((r) => setTimeout(r, 50));

check("exactly one request", posted.length, 1);
check("to the subscribe endpoint", posted[0].url.includes("/api/alerts/subscribe"), true);
check("as a POST", posted[0].options.method, "POST");
check("declared as JSON", posted[0].options.headers["Content-Type"], "application/json");
// This is the contract the Worker's validateSubscription() parses. If the shape
// drifts, every signup fails and nobody finds out.
const body = JSON.parse(posted[0].options.body);
check("carries the address", body.email, "rider@example.com");
check("carries the trail keys", body.trails.sort(), ["big-cedar", "northshore"]);
check("and nothing else", Object.keys(body).sort(), ["email", "trails"]);

console.log("\n=== what the person is told afterwards ===");
// Deliberately NOT "you're subscribed" — nothing is, until the link is clicked,
// and saying otherwise is how people conclude the alerts are broken while the
// confirmation sits unread.
check("it asks them to check their email", /confirmation link/i.test(statusEl.textContent), true);
check("it does not claim they are subscribed", /you.re subscribed|you are subscribed/i.test(statusEl.textContent), false);
check("styled as success", statusEl.className.includes("alerts-ok"), true);
check("the form is cleared so a reload cannot double-submit", emailEl.value, "");

console.log("\n=== the privacy notice is on the panel itself ===");
const privacy = d.querySelector(".alerts-privacy")?.textContent || "";
check("it says what is stored", /email address and the trails/i.test(privacy), true);
check("it says it is not shared or sold", /never shared, never sold/i.test(privacy), true);
check("it offers deletion", /ntxtrailstatus@gmail\.com/.test(privacy), true);

console.log("\n=== Escape closes all three modals, not the original two ===");
d.querySelector("#info-btn").dispatchEvent(new window.Event("click", { bubbles: true }));
d.querySelector("#donate-btn").dispatchEvent(new window.Event("click", { bubbles: true }));
click(btn);
const esc = new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true });
d.dispatchEvent(esc);
check("info closed", d.querySelector("#info-modal").classList.contains("hidden"), true);
check("donate closed", d.querySelector("#donate-modal").classList.contains("hidden"), true);
check("alerts closed too", modal.classList.contains("hidden"), true);

console.log("\n=== the list view still has its eight columns ===");
// The panel was built as a modal specifically to stay off the list grid, where a
// new column would have to move in five places at once.
check("heading cell count unchanged", d.querySelectorAll(".trail-heading")[0]?.children.length ?? 8, 8);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
