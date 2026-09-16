// Locks the status-bucket refactor.
//
// statusBucket() replaced four separate copies of "what counts as closed" — two
// in public/script.js, one in scripts/build-episodes.js, and the one the email
// alerts would have added. Collapsing them was the right move and also the
// dangerous one: if the merged version disagrees with any of the originals, the
// Closed filter quietly starts showing a different set of trails, or the alerts
// start mailing people about a trail the page still shows as shut.
//
// So this pins the ORIGINAL behaviour, transcribed from the code as it stood
// before the merge, not from the new implementation.

import { statusBucket, isClosedStatus, isRideableStatus } from "../public/status-buckets.js";

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

// The pre-refactor statusClassFor() from public/script.js, verbatim.
function legacyStatusClass(status) {
  const normalized = status.toLowerCase();
  if (normalized.includes("closed") || normalized.includes("wet") || normalized.includes("mud")) return "status-closed";
  if (normalized.includes("caution") || normalized.includes("variable")) return "status-caution";
  if (normalized.includes("open") || normalized.includes("ideal") || normalized.includes("dry")) return "status-open";
  if (normalized.includes("manual") || normalized.includes("unavailable")) return "status-manual";
  return "status-unknown";
}

// The pre-refactor isClosedStatus() from scripts/build-episodes.js, verbatim.
function legacyIsClosed(status) {
  const s = String(status || "").toLowerCase();
  return s.includes("closed") || s.includes("wet") || s.includes("mud");
}

// The pre-refactor inline filter from getVisibleTrails(), verbatim.
function legacyIsRideable(status) {
  const s = (status || "").toLowerCase();
  return s.includes("open") || s.includes("caution") || s.includes("ideal") || s.includes("dry") || s.includes("variable");
}

// Every string the two parsers in worker.js and update-trail-status.js can emit.
const VOCABULARY = [
  "Open", "Closed", "Caution", "Ideal", "Dry", "Very Dry", "Wet", "Variable",
  "Prevalent Mud", "Unknown", "Unavailable"
];

console.log("=== every status the scrapers can emit maps as it always did ===");
for (const status of VOCABULARY) {
  check(`${status} -> class`, `status-${statusBucket(status)}`, legacyStatusClass(status));
  check(`${status} -> closed?`, isClosedStatus(status), legacyIsClosed(status));
  check(`${status} -> rideable?`, isRideableStatus(status), legacyIsRideable(status));
}

console.log("\n=== the traps inside that vocabulary ===");
// "Very Dry" contains "dry" and "Prevalent Mud" contains "mud": the ordering of
// the tests is the whole correctness argument, so name it explicitly.
check("Very Dry is open, not caught by some earlier rule", statusBucket("Very Dry"), "open");
check("Prevalent Mud is closed, and mud beats nothing else", statusBucket("Prevalent Mud"), "closed");
check("Wet is closed even though it is not the word Closed", statusBucket("Wet"), "closed");
check("Variable is caution, not open", statusBucket("Variable"), "caution");

console.log("\n=== rideable includes caution, on purpose ===");
// The site's Status filter has always grouped caution with rideable. An alert
// that fired only on a pristine Open would miss the most common reopening.
check("Caution counts as rideable", isRideableStatus("Caution"), true);
check("Variable counts as rideable", isRideableStatus("Variable"), true);
check("Closed does not", isRideableStatus("Closed"), false);
check("closed and rideable are mutually exclusive", VOCABULARY.filter((s) => isClosedStatus(s) && isRideableStatus(s)), []);

console.log("\n=== junk input cannot throw, and is never rideable ===");
// isClosedStatus took String(status || "") and statusClassFor took status.toLowerCase(),
// so the merged version has to survive what the stricter of the two never saw.
check("null", statusBucket(null), "unknown");
check("undefined", statusBucket(undefined), "unknown");
check("empty string", statusBucket(""), "unknown");
check("whitespace", statusBucket("   "), "unknown");
check("unrecognised text", statusBucket("Under Construction"), "unknown");
check("nothing unknown is rideable", [null, undefined, "", "Under Construction"].some(isRideableStatus), false);
check("nothing unknown is closed", [null, undefined, "", "Under Construction"].some(isClosedStatus), false);

console.log("\n=== case and whitespace, because these come off scraped HTML ===");
check("lowercase closed", statusBucket("closed"), "closed");
check("uppercase CLOSED", statusBucket("CLOSED"), "closed");
check("padded status", statusBucket("  Open  "), "open");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
