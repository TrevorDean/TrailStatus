// Guards the hand-corrected parking data in public/trails.js.
//
// extract-parking.js re-scrapes Trailforks and its output is spliced into
// trails.js BY HAND. That splice is where hand-corrections die: paste the whole
// array back and a trailhead whose Trailforks pin is wrong silently reverts to
// the wrong pin, with nothing to show for it in review but a changed decimal.
// Marion Sansom (8.12 km out) and Cedar Hill State Park (846 m out) are both in
// that category, and Northshore's three lots have no Trailforks equivalent at all.
//
// So the values are pinned in scripts/manual-parking.lock.json and compared here.
// Any drift fails the check. Changing a value on purpose means running
// `--update`, which rewrites the lock as a separate, reviewable diff.
//
//   node scripts/check-manual-parking.js            # verify (exit 1 on drift)
//   node scripts/check-manual-parking.js --update   # accept current values
//
// This does NOT check whether a coordinate is correct — only that it has not
// changed unnoticed. Correctness still comes from the real world.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TRAILS } from "../public/trails.js";

const LOCK = join(dirname(fileURLToPath(import.meta.url)), "manual-parking.lock.json");

// Only the fields a splice can damage. Key order is fixed so the JSON compares
// stably regardless of how the trails.js entry is written.
function snapshot(trail) {
  const out = { key: trail.key, parkingSource: trail.parkingSource ?? null };
  if (Array.isArray(trail.parking)) {
    out.parking = trail.parking.map(lot => ({
      name: lot.name ?? "",
      lat: lot.lat,
      lng: lot.lng,
      plusCode: lot.plusCode ?? null,
      primary: lot.primary === true
    }));
  } else {
    out.parkingLat = trail.parkingLat ?? null;
    out.parkingLng = trail.parkingLng ?? null;
    out.parkingPlusCode = trail.parkingPlusCode ?? null;
  }
  return out;
}

const current = TRAILS.filter(t => t.parkingSource === "manual").map(snapshot);

if (process.argv.includes("--update")) {
  writeFileSync(LOCK, JSON.stringify(current, null, 2) + "\n");
  console.log(`Updated ${LOCK} — ${current.length} hand-corrected trailhead(s).`);
  process.exit(0);
}

let locked;
try {
  locked = JSON.parse(readFileSync(LOCK, "utf8"));
} catch {
  console.error(`No lock file at ${LOCK}. Run with --update to create it.`);
  process.exit(1);
}

const byKey = a => Object.fromEntries(a.map(e => [e.key, e]));
const lockedBy = byKey(locked);
const currentBy = byKey(current);
const keys = [...new Set([...Object.keys(lockedBy), ...Object.keys(currentBy)])].sort();

const problems = [];
for (const key of keys) {
  const was = lockedBy[key];
  const now = currentBy[key];
  // A trailhead vanishing from the manual set is the exact splice-revert
  // symptom: the flag is gone, so the hand-corrected value went with it.
  if (was && !now) {
    problems.push(`${key}: lost its parkingSource: "manual" flag — a splice probably overwrote it`);
    continue;
  }
  if (!was && now) {
    problems.push(`${key}: newly hand-corrected but not in the lock — run --update to record it`);
    continue;
  }
  const a = JSON.stringify(was);
  const b = JSON.stringify(now);
  if (a !== b) problems.push(`${key}: parking data changed\n    locked:  ${a}\n    current: ${b}`);
}

if (problems.length > 0) {
  console.error("Hand-corrected parking data has drifted:\n");
  for (const p of problems) console.error(`  - ${p}`);
  console.error(`
If a Trailforks re-sweep was just spliced in, this is the revert it was meant to
catch — restore the hand-corrected values. If the change was deliberate, re-run
with --update so the new values land as their own reviewable diff.`);
  process.exit(1);
}

console.log(`OK — ${current.length} hand-corrected trailhead(s) unchanged: ${current.map(c => c.key).join(", ")}`);
