// Email alerts: "tell me when this trail opens again".
//
// The detection half of this feature already existed. history.js diffs the KV
// scrape against D1 every five minutes and produces exactly the transitions this
// needs; it simply threw them away after writing the archive. So what lives here
// is not trail logic — it is consent, addressing, and delivery.
//
// THE RULE THAT SHAPES EVERYTHING BELOW: an alert is irreversible. A wrong row
// in status_events can be re-derived; a wrong email is in a stranger's inbox
// forever. Every guard here is one-directional for that reason — when in doubt,
// send nothing. A missed reopening costs someone one ride. A false one, or one
// sent to an address its owner never confirmed, costs the sending domain.

import { isClosedStatus, isRideableStatus } from "./public/status-buckets.js";
import { scheduledOverlap } from "./closure-classify.js";
import { TRAILS } from "./public/trails.js";

const TRAIL_BY_KEY = new Map(TRAILS.map((t) => [t.key, t]));

// A subscription is not a newsletter — nobody follows 58 trails, and a request
// that claims to is either a mistake or someone probing the endpoint.
export const MAX_TRAILS_PER_SUBSCRIPTION = 20;

// How long a confirmation link stays good. Long enough for someone who signed up
// on a phone and opens mail on a laptop that evening; short enough that a stale
// link in an inbox two months later does not silently activate.
export const CONFIRM_TTL_H = 48;

// One confirmation mail per address per window, however many times the form is
// submitted. This is the guard that stops the subscribe endpoint being used to
// bomb a third party: the attacker can POST all day, the victim gets one mail.
export const SIGNUP_COOLDOWN_MIN = 15;

// A circuit breaker, not a business limit. A signup flood would burn the D1 free
// tier's 100k daily writes, and that quota is ACCOUNT-WIDE — blowing it takes the
// status archive down with it, which has already happened once for 17 hours.
// The alerts are the expendable half of that pair, so they are what stops first.
export const MAX_SIGNUPS_PER_DAY = 500;

// Retry a failed send, but not forever and not into the distant future. A
// reopening is perishable news: a trail that opened yesterday may be shut again
// today, and mailing someone about it is worse than staying quiet.
export const MAX_SEND_ATTEMPTS = 3;
export const SEND_STALE_H = 6;

// Resend accepts up to 100 messages per batch call.
export const RESEND_BATCH_SIZE = 100;

/**
 * Is this transition a reopening worth telling someone about?
 *
 * Pure, and deliberately narrow. Two cases that look like reopenings are not:
 *
 *  - prev_status === null is a trail's FIRST-EVER observation. The archive began
 *    2026-08-30; every trail generated one of these, and none of them is news.
 *    history-report.js filters the same case for the same reason.
 *  - Unknown/Unavailable never reach here — isRealStatus() in history.js drops
 *    them before diffStatuses() emits an event. That is what stops a transient
 *    Trailforks 403 from reading as "everything just opened" and mailing the
 *    entire list. If that guard ever moves, this function needs its own copy.
 */
export function isReopening(event) {
  if (!event || event.prev_status === null || event.prev_status === undefined) return false;
  return isClosedStatus(event.prev_status) && isRideableStatus(event.status);
}

/**
 * Was the closure that just ended simply the calendar?
 *
 * Big Cedar is shut every Sunday morning and all day Monday by its steward. Those
 * are real closed-to-open transitions and they would fire a real email twice a
 * week, forever, for a trail whose schedule the subscriber already knows.
 * Suppressing them is the difference between an alert people trust and one they
 * filter.
 *
 * Needs the time the closure STARTED, which the event itself does not carry —
 * the caller reads it from status_events. When that lookup finds nothing (a
 * closure older than the archive), the honest answer is "not explained", and the
 * mail goes out: unexplained-therefore-send is the right bias for a trail nobody
 * has a schedule for.
 */
export function isScheduledReopening(trailKey, closedTs, openedTs) {
  const trail = TRAIL_BY_KEY.get(trailKey);
  if (!trail || closedTs === null || closedTs === undefined) return false;
  return scheduledOverlap(trail, closedTs, openedTs) === 1;
}

// Deliberately permissive. Address syntax is not a useful filter — the
// confirmation mail is the real validation, and an address that cannot receive
// one never gets confirmed. This rejects only what cannot be an address at all,
// plus a length cap so the column is not a storage vector.
const EMAIL_RE = /^[^\s@,;<>"]+@[^\s@,;<>".]+\.[^\s@,;<>"]+$/;

export function normalizeEmail(raw) {
  return String(raw || "").trim().toLowerCase();
}

export function isValidEmail(raw) {
  const email = normalizeEmail(raw);
  return email.length >= 6 && email.length <= 254 && EMAIL_RE.test(email);
}

/**
 * Validate a subscribe request. Returns { ok, error, email, trails }.
 *
 * Trail keys are checked against public/trails.js rather than stored as given:
 * these end up in a SQL parameter and in an email body, and "the canonical list
 * is the only valid input" is cheaper than escaping both.
 */
export function validateSubscription(body) {
  const email = normalizeEmail(body?.email);
  if (!isValidEmail(email)) return { ok: false, error: "invalid email" };

  const requested = Array.isArray(body?.trails) ? body.trails : [];
  if (requested.length === 0) return { ok: false, error: "no trails selected" };
  if (requested.length > MAX_TRAILS_PER_SUBSCRIPTION) return { ok: false, error: "too many trails" };

  // Deduping before the cap check would be wrong — a request carrying 40 copies
  // of one key is malformed, not a 1-trail subscription.
  const unique = new Set(requested);
  const trails = [...unique].filter((k) => TRAIL_BY_KEY.has(k));
  if (trails.length !== unique.size) return { ok: false, error: "unknown trail" };

  return { ok: true, email, trails };
}

// The token IS the credential — there are no accounts here. crypto.getRandomValues
// is available in Workers and in Node 18+; anything derived from time or from the
// address itself would let one subscriber guess another's unsubscribe link.
export function newToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Turn reopenings into (email, trail) pairs to send.
 *
 * Pure so it can be tested without D1: the caller supplies the subscriber rows.
 * Confirmed-only filtering happens in the SQL too, but it is repeated here
 * because this is the last place before a message is addressed, and an
 * unconfirmed address reaching Resend is the one failure this design exists to
 * prevent.
 */
export function selectRecipients(reopenings, subscriberRows) {
  const byTrail = new Map();
  for (const row of subscriberRows || []) {
    if (!row.confirmed_at) continue;
    if (!byTrail.has(row.trail_key)) byTrail.set(row.trail_key, []);
    byTrail.get(row.trail_key).push(row);
  }

  const sends = [];
  const seen = new Set();
  for (const event of reopenings) {
    for (const row of byTrail.get(event.trail_key) || []) {
      // One person following one trail gets one mail per transition, even if the
      // same trail somehow appears twice in a single batch.
      const key = `${row.email} ${event.trail_key} ${event.observed_at}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const trail = TRAIL_BY_KEY.get(event.trail_key);
      sends.push({
        email: row.email,
        manage_token: row.manage_token,
        trail_key: event.trail_key,
        trail_name: trail?.name || event.trail_key,
        city: trail?.city || "",
        url: trail?.url || "",
        status: event.status,
        event_at: event.observed_at
      });
    }
  }
  return sends;
}

export function chunk(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Display name for a trail key, for email bodies and the manage page. A key like
// "big-cedar" is fine in a database and wrong in a sentence.
export function trailName(key) {
  return TRAIL_BY_KEY.get(key)?.name || key;
}
