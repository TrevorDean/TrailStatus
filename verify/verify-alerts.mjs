// The email alerts, tested where the decisions are: which transitions count as a
// reopening, which reopenings are just the calendar, what a subscribe request is
// allowed to contain, and who ends up addressed.
//
// No D1, no network, no jsdom — same shape as verify-history.mjs, for the same
// reason. Every function under test takes its inputs as arguments, so the whole
// send decision can be exercised without a database or an API key.
//
// The stakes here are not symmetric. A missed alert costs someone one ride; a
// wrong one is in a stranger's inbox permanently, and one sent to an address its
// owner never confirmed costs the sending domain. So most of what follows checks
// that something is NOT sent.

import {
  isReopening,
  isScheduledReopening,
  isValidEmail,
  normalizeEmail,
  newToken,
  selectRecipients,
  validateSubscription,
  chunk,
  MAX_TRAILS_PER_SUBSCRIPTION
} from "../alerts.js";

let pass = 0;
let fail = 0;
const check = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "OK  " : "FAIL"} ${label}${ok ? "" : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

const reopen = (prev, status) => isReopening({ prev_status: prev, status, trail_key: "erwin-park", observed_at: "2026-09-16T12:00:00.000Z" });

console.log("=== what counts as a reopening ===");
check("Closed -> Open", reopen("Closed", "Open"), true);
check("Closed -> Ideal", reopen("Closed", "Ideal"), true);
check("Closed -> Dry", reopen("Closed", "Dry"), true);
// Caution is rideable on this site — the Status filter has always said so, and an
// alert that waited for a pristine Open would miss the commonest reopening there is.
check("Closed -> Caution", reopen("Closed", "Caution"), true);
check("Wet -> Open", reopen("Wet", "Open"), true);
check("Prevalent Mud -> Very Dry", reopen("Prevalent Mud", "Very Dry"), true);

console.log("\n=== what does not ===");
check("Open -> Closed (the other direction)", reopen("Open", "Closed"), false);
check("Wet -> Prevalent Mud (closed to closed)", reopen("Wet", "Prevalent Mud"), false);
check("Open -> Ideal (rideable to rideable)", reopen("Open", "Ideal"), false);
check("Caution -> Open", reopen("Caution", "Open"), false);

console.log("\n=== the two guards that stop a mass mailing ===");
// The archive began 2026-08-30 and every trail produced one of these. None is news.
check("first-ever sighting (prev_status null)", reopen(null, "Open"), false);
check("first-ever sighting (prev_status undefined)", isReopening({ status: "Open" }), false);
// isRealStatus() in history.js drops these before diffStatuses() emits an event,
// so they should never arrive — but a transient Trailforks 403 reading as "all 58
// trails just opened" is the single worst failure this feature has, and belt and
// braces is cheap.
check("Unavailable -> Open", reopen("Unavailable", "Open"), false);
check("Unknown -> Open", reopen("Unknown", "Open"), false);
check("Closed -> Unavailable", reopen("Closed", "Unavailable"), false);
check("Closed -> Unknown", reopen("Closed", "Unknown"), false);
check("a missing event object", isReopening(null), false);
check("an empty event object", isReopening({}), false);

console.log("\n=== Big Cedar's standing closure must not become a weekly email ===");
// Local weekdays: 0 = Sunday, 1 = Monday. trails.js records scheduledClosure
// { days: [0, 1] } for big-cedar, from the steward, on 2026-09-04.
const ts = (iso) => Date.parse(iso) / 1000;

// The Sunday closure was observed STARTING 11:28pm Saturday local — a steward
// shutting the gate before bed. That is what LEAD_GRACE_H exists for, and a bare
// weekday test once promoted this exact closure to the archive's only "usable
// drying event" with zero rainfall behind it.
check(
  "Saturday 11:28pm -> Sunday 1pm is the schedule",
  isScheduledReopening("big-cedar", ts("2026-09-13T04:28:00Z"), ts("2026-09-13T18:00:00Z")),
  true
);
// And the Monday closure ends at 1:00am TUESDAY, which REOPEN_GRACE absorbs.
check(
  "Monday into Tuesday 1am is the schedule",
  isScheduledReopening("big-cedar", ts("2026-09-14T05:30:00Z"), ts("2026-09-15T06:00:00Z")),
  true
);
// A genuine weather closure at the same trail must still send. This one starts
// on a Wednesday, so it cannot be the schedule however long it runs.
check(
  "a mid-week closure at Big Cedar still sends",
  isScheduledReopening("big-cedar", ts("2026-09-09T15:00:00Z"), ts("2026-09-11T15:00:00Z")),
  false
);
// A closure that starts on a scheduled day but runs for a week is a real closure
// that happened to begin on a Sunday, not a scheduled one.
check(
  "a week-long closure starting Sunday still sends",
  isScheduledReopening("big-cedar", ts("2026-09-13T06:00:00Z"), ts("2026-09-20T15:00:00Z")),
  false
);

console.log("\n=== every other trail has no schedule, so nothing is suppressed ===");
check("erwin-park, same Sunday window", isScheduledReopening("erwin-park", ts("2026-09-13T04:28:00Z"), ts("2026-09-13T18:00:00Z")), false);
check("northshore, same Sunday window", isScheduledReopening("northshore", ts("2026-09-13T04:28:00Z"), ts("2026-09-13T18:00:00Z")), false);
// A closure older than the archive has no start time. "Unexplained" must mean
// "send", not "suppress" — staying silent about a real reopening is the failure.
check("closure start unknown (null) sends", isScheduledReopening("big-cedar", null, ts("2026-09-15T06:00:00Z")), false);
check("a trail key that is not in trails.js sends", isScheduledReopening("not-a-trail", ts("2026-09-14T05:30:00Z"), ts("2026-09-15T06:00:00Z")), false);

console.log("\n=== subscribe requests ===");
check("a good one", validateSubscription({ email: "Rider@Example.COM ", trails: ["big-cedar", "erwin-park"] }), {
  ok: true,
  email: "rider@example.com",
  trails: ["big-cedar", "erwin-park"]
});
check("addresses are lowercased and trimmed", normalizeEmail("  A@B.COM "), "a@b.com");
check("no trails", validateSubscription({ email: "a@b.com", trails: [] }).error, "no trails selected");
check("trails missing entirely", validateSubscription({ email: "a@b.com" }).error, "no trails selected");
// Keys reach both a SQL parameter and an email body; the canonical list is the
// only valid input, which is cheaper than escaping in two places.
check("an invented trail key", validateSubscription({ email: "a@b.com", trails: ["big-cedar", "../../etc/passwd"] }).error, "unknown trail");
check("over the cap", validateSubscription({ email: "a@b.com", trails: Array(MAX_TRAILS_PER_SUBSCRIPTION + 1).fill("big-cedar") }).error, "too many trails");
// Deduping before the cap check would let 40 copies of one key through as a
// 1-trail subscription. It is malformed either way.
check("duplicates collapse to one subscription", validateSubscription({ email: "a@b.com", trails: ["big-cedar", "big-cedar"] }), {
  ok: true,
  email: "a@b.com",
  trails: ["big-cedar"]
});
check("a non-array trails field", validateSubscription({ email: "a@b.com", trails: "big-cedar" }).error, "no trails selected");
check("a missing body", validateSubscription(undefined).error, "invalid email");

console.log("\n=== addresses ===");
check("ordinary", isValidEmail("rider@example.com"), true);
check("plus addressing survives", isValidEmail("rider+trails@example.com"), true);
check("subdomain survives", isValidEmail("rider@mail.example.co.uk"), true);
check("no at sign", isValidEmail("rider.example.com"), false);
check("no domain dot", isValidEmail("rider@example"), false);
check("empty", isValidEmail(""), false);
check("whitespace only", isValidEmail("   "), false);
// Header injection: a newline in a From/To is how a text field becomes a relay.
check("a newline is rejected", isValidEmail("a@b.com\nbcc: victim@example.com"), false);
check("a comma is rejected", isValidEmail("a@b.com,victim@example.com"), false);
check("angle brackets are rejected", isValidEmail("<a@b.com>"), false);
check("over 254 characters", isValidEmail(`${"a".repeat(250)}@b.com`), false);

console.log("\n=== tokens are the only credential here ===");
const tokens = new Set(Array.from({ length: 200 }, newToken));
check("200 tokens, 200 distinct values", tokens.size, 200);
check("each is 32 bytes of hex", [...tokens].every((t) => /^[0-9a-f]{64}$/.test(t)), true);

console.log("\n=== who gets addressed ===");
const events = [
  { trail_key: "big-cedar", status: "Open", observed_at: "2026-09-16T12:00:00.000Z" },
  { trail_key: "erwin-park", status: "Ideal", observed_at: "2026-09-16T12:00:00.000Z" }
];
const subscribers = [
  { trail_key: "big-cedar", email: "a@b.com", manage_token: "t1", confirmed_at: "2026-09-01T00:00:00.000Z" },
  { trail_key: "erwin-park", email: "a@b.com", manage_token: "t1", confirmed_at: "2026-09-01T00:00:00.000Z" },
  { trail_key: "erwin-park", email: "c@d.com", manage_token: "t2", confirmed_at: "2026-09-01T00:00:00.000Z" },
  // Never confirmed. This is the row that must never produce a message.
  { trail_key: "big-cedar", email: "pending@e.com", manage_token: "t3", confirmed_at: null }
];
const sends = selectRecipients(events, subscribers);
check("one message per (person, trail)", sends.map((s) => `${s.email}:${s.trail_key}`).sort(), [
  "a@b.com:big-cedar",
  "a@b.com:erwin-park",
  "c@d.com:erwin-park"
]);
check("an unconfirmed address is never addressed", sends.some((s) => s.email === "pending@e.com"), false);
check("display names, not keys, reach the email", sends.find((s) => s.trail_key === "big-cedar").trail_name, "Big Cedar Wilderness Trails");
check("the manage token travels with the message", sends.find((s) => s.email === "c@d.com").manage_token, "t2");
check("the event time is carried for the idempotency key", sends[0].event_at, "2026-09-16T12:00:00.000Z");
check("nobody subscribed means nobody mailed", selectRecipients(events, []), []);
check("no reopenings means nobody mailed", selectRecipients([], subscribers), []);
check("null subscriber rows do not throw", selectRecipients(events, null), []);

console.log("\n=== a trail appearing twice in one batch still sends one email ===");
const duplicated = [events[0], { ...events[0] }];
check("deduped by (email, trail, event time)", selectRecipients(duplicated, subscribers).length, 1);

console.log("\n=== batching for Resend's 100-per-call limit ===");
check("250 splits 100/100/50", chunk(Array(250).fill("x"), 100).map((c) => c.length), [100, 100, 50]);
check("an exact multiple does not leave an empty tail", chunk(Array(200).fill("x"), 100).length, 2);
check("empty input", chunk([], 100), []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
