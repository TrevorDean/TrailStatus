// Verifies diffStatuses() — the whole decision the history archive makes.
//
// No jsdom and no D1: the diff is a pure function of two plain objects, which is
// exactly why history.js takes `now` as an argument instead of calling Date().
// Exits NON-ZERO on failure, like verify-weather and verify-stats-toggle.
import { diffStatuses, isRealStatus } from "../history.js";

let pass = 0, fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

const NOW = new Date("2026-08-30T12:00:00.000Z");
const at = NOW.toISOString();
const state = (status) => ({ status });
const scrape = (status, extra = {}) => ({ status, detail: "Region Status", updated: "Aug 29, 2026", ...extra });
const run = (prev, cur) => diffStatuses(prev, cur, NOW);

console.log("=== what counts as an observation ===");
for (const s of ["Open", "Closed", "Caution", "Ideal", "Very Dry", "Prevalent Mud"]) {
  check(`"${s}" is real`, isRealStatus(s), true);
}
for (const s of ["Unknown", "Unavailable", "unavailable", "", null, undefined]) {
  check(`${JSON.stringify(s)} is not an observation`, isRealStatus(s), false);
}

console.log("\n=== the core rule: transitions, not samples ===");
{
  // First sighting of a trail.
  const first = run({}, { "quanah-hill": scrape("Open") });
  check("a trail's first observation is recorded", first.events.length, 1);
  check("with prev_status NULL, not empty string", first.events[0].prev_status, null);
  check("carrying the scraped fields", [first.events[0].status, first.events[0].reported_at, first.events[0].observed_at],
    ["Open", "Aug 29, 2026", at]);

  // The case that runs 288 times a day and must produce nothing.
  const same = run({ "quanah-hill": state("Open") }, { "quanah-hill": scrape("Open") });
  check("an unchanged status records NOTHING", same.events.length, 0);
  check("but still counts as observed", [same.observed, same.unusable], [1, 0]);

  const changed = run({ "quanah-hill": state("Open") }, { "quanah-hill": scrape("Closed") });
  check("a real change records one event", changed.events.length, 1);
  check("the event is self-describing", [changed.events[0].prev_status, changed.events[0].status], ["Open", "Closed"]);
}

console.log("\n=== Unavailable must not flap (the trap this design exists for) ===");
{
  const prev = { "quanah-hill": state("Open") };

  // A transient Trailforks 403 mid-run.
  const outage = run(prev, { "quanah-hill": scrape("Unavailable", { detail: "HTTP 403" }) });
  check("an outage records no event", outage.events.length, 0);
  check("and is counted as unusable, not observed", [outage.observed, outage.unusable], [0, 1]);

  // Because the outage wrote no state, the NEXT run still compares against Open —
  // so Open -> Unavailable -> Closed collapses to a single Open -> Closed.
  const after = run(prev, { "quanah-hill": scrape("Closed") });
  check("Open -> Unavailable -> Closed yields ONE event", after.events.length, 1);
  check("and it spans the outage", [after.events[0].prev_status, after.events[0].status], ["Open", "Closed"]);

  const unknown = run(prev, { "quanah-hill": scrape("Unknown", { detail: "Status not found" }) });
  check("an unparseable page records nothing either", unknown.events.length, 0);
}

console.log("\n=== the vocabulary is stored verbatim, not bucketed ===");
{
  // statusClassFor() lumps these into status-closed for the UI. The archive must
  // not: bucketing is lossy and a future reader can always bucket, never unbucket.
  const r = run({ "a": state("Wet") }, { "a": scrape("Prevalent Mud") });
  check("Wet -> Prevalent Mud is a recorded transition", r.events.length, 1);
  check("both ends keep their exact wording",
    [r.events[0].prev_status, r.events[0].status], ["Wet", "Prevalent Mud"]);
}

console.log("\n=== whole-fleet shapes ===");
{
  const keys = Array.from({ length: 58 }, (_, i) => `trail-${i}`);
  const all = Object.fromEntries(keys.map((k) => [k, scrape("Open")]));

  const cold = run({}, all);
  check("a cold archive records every trail once", cold.events.length, 58);
  check("and counts them all as observed", [cold.observed, cold.unusable], [58, 0]);

  const warm = run(Object.fromEntries(keys.map((k) => [k, state("Open")])), all);
  check("the very next run records nothing", warm.events.length, 0);

  // A trail present in D1 but missing from this scrape must not crash or be
  // treated as a change — batch 2's KV part can be briefly absent mid-write.
  const partial = run({ "trail-0": state("Open"), "gone": state("Open") }, { "trail-0": scrape("Open") });
  check("a trail missing from the scrape is simply skipped", partial.events.length, 0);
  check("and does not inflate the observed count", partial.observed, 1);

  check("an entirely empty scrape produces an empty, harmless result",
    [run({}, {}).events.length, run({}, {}).observed], [0, 0]);
  check("a null scrape does not throw", run({}, null).events.length, 0);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
