// Where the line between "closed" and "rideable" is drawn — the ONE place, for
// the site, the archive tooling, and the alert path alike.
//
// This is a MODELLING CHOICE, not a fact about the data. status_events stores
// every status verbatim (Ideal, Very Dry, Prevalent Mud, …) precisely so this
// line can be redrawn later without a re-scrape. It used to live in four places
// — statusClassFor() and the filter in getVisibleTrails() in public/script.js,
// isClosedStatus() in scripts/build-episodes.js — and CLAUDE.md warned that all
// of them had to move together. Emailing people when a trail reopens would have
// made a fifth, and a definition the site and the mailer disagreed about means
// telling someone a trail is open while the page still shows it closed.
//
// Lives in public/ rather than the repo root because the browser needs it too,
// the same reason trails.js and weather.js live here.
//
// Substring matching, not equality: 55 of the 58 trailheads are Trailforks
// "regions" reporting a bare Open/Closed, but the other 3 report the full
// Ideal/Dry/Very Dry/Wet/Variable/Prevalent Mud vocabulary, and a scraped string
// can carry stray whitespace or case. Order matters — "Very Dry" contains "dry"
// and "Prevalent Mud" contains "mud", so the closed test has to run first.
export function statusBucket(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized.includes("closed") || normalized.includes("wet") || normalized.includes("mud")) {
    return "closed";
  }
  if (normalized.includes("caution") || normalized.includes("variable")) {
    return "caution";
  }
  if (normalized.includes("open") || normalized.includes("ideal") || normalized.includes("dry")) {
    return "open";
  }
  if (normalized.includes("manual") || normalized.includes("unavailable")) {
    return "manual";
  }
  return "unknown";
}

export function isClosedStatus(status) {
  return statusBucket(status) === "closed";
}

// "Rideable" deliberately includes caution. The site's own Status filter has
// always grouped it that way — a caution trail is one you can ride with care,
// not one you should stay off — and an alert that fired only on a pristine Open
// would stay silent through the most common reopening there is.
export function isRideableStatus(status) {
  const bucket = statusBucket(status);
  return bucket === "open" || bucket === "caution";
}
