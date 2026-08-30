// Trail status history — the write side of the D1 archive (see
// migrations/0001_status_history.sql for the schema and the reasoning).
//
// Runs from worker.js's scheduled() handler every 5 minutes. It does NOT scrape:
// the status data is already in KV, put there by the GitHub Actions scraper, so
// this only has to read what /api/status already reads and notice what changed.
// That is why it can live on a Worker at all — the "Trailforks blocks Cloudflare"
// constraint never comes into play, because Trailforks is never contacted.
//
// Kept out of worker.js so the request path and the cron path stay separately
// legible; worker.js imports exactly one function from here.

// Not statuses — the absence of an observation. "Unavailable" is what
// fetchStatus() returns when a Trailforks fetch throws, and "Unknown" is what the
// parsers return when they find nothing on the page. A trail reporting either is
// skipped for that run: no event, no state write.
//
// This is the single most important rule in this file. 58 trails are polled every
// 5 minutes, so recording Open -> Unavailable -> Open on every transient 403 would
// bury the real transitions in noise within days. Skipping also means a trail that
// goes Open -> Unavailable (3 hours) -> Closed correctly records ONE Open -> Closed.
const NOT_AN_OBSERVATION = new Set(["unknown", "unavailable", ""]);

export function isRealStatus(status) {
  return !NOT_AN_OBSERVATION.has(String(status || "").trim().toLowerCase());
}

// The whole decision, as a pure function of two plain objects — no D1, no KV, no
// clock. Everything interesting about this feature is testable through here
// (verify/verify-history.mjs), which is the reason it takes `now` as an argument
// rather than calling Date() itself.
//
//   previousState: { [trailKey]: { status, detail, reported_at, observed_at } }
//                  — the last REAL status per trail, from the trail_state table
//   current:       { [trailKey]: { status, detail, updated } } — the KV scrape
//
// Returns the events to write; an unchanged status yields nothing, which is the
// point of the whole design (transitions, not samples).
export function diffStatuses(previousState, current, now) {
  const observedAt = now.toISOString();
  const events = [];
  let observed = 0;
  let unusable = 0;

  for (const [trailKey, entry] of Object.entries(current || {})) {
    if (!isRealStatus(entry?.status)) {
      unusable++;
      continue;
    }
    observed++;

    const previous = previousState?.[trailKey];
    if (previous && previous.status === entry.status) continue;

    events.push({
      trail_key: trailKey,
      // NULL rather than "" on a trail's first-ever sighting, so "we have never
      // seen this trail before" is distinguishable from "it changed from nothing".
      prev_status: previous ? previous.status : null,
      status: entry.status,
      detail: entry.detail ?? null,
      reported_at: entry.updated || null,
      observed_at: observedAt
    });
  }

  return { events, observed, unusable, observedAt };
}

// Same merge /api/status performs. Both KV parts are read because the scrape list
// is split into two batches written independently.
async function readCurrentStatuses(env) {
  const [part1, part2] = await Promise.all([
    env.TRAIL_CACHE.get("trail_statuses_1", { type: "json" }),
    env.TRAIL_CACHE.get("trail_statuses_2", { type: "json" })
  ]);
  return { ...(part1?.statuses || {}), ...(part2?.statuses || {}) };
}

async function readPreviousState(db) {
  const { results } = await db.prepare("SELECT trail_key, status FROM trail_state").all();
  return Object.fromEntries((results || []).map((row) => [row.trail_key, row]));
}

export async function recordStatusChanges(env, now = new Date()) {
  if (!env.TRAIL_HISTORY || !env.TRAIL_CACHE) return { skipped: "missing binding" };

  const db = env.TRAIL_HISTORY;
  const current = await readCurrentStatuses(env);
  // An empty KV means the scraper has never run, not that every trail vanished.
  // Recording a run here would be a lie, and writing state would be worse.
  if (Object.keys(current).length === 0) return { skipped: "no statuses in KV" };

  const previousState = await readPreviousState(db);
  const { events, observed, unusable, observedAt } = diffStatuses(previousState, current, now);

  // One batch = one implicit transaction in D1, so a run lands completely or not
  // at all. A half-written run would leave trail_state ahead of status_events and
  // silently swallow the next real transition.
  const statements = [];
  for (const e of events) {
    statements.push(
      db.prepare(
        "INSERT INTO status_events (trail_key, prev_status, status, detail, reported_at, observed_at) VALUES (?, ?, ?, ?, ?, ?)"
      ).bind(e.trail_key, e.prev_status, e.status, e.detail, e.reported_at, e.observed_at),
      db.prepare(
        `INSERT INTO trail_state (trail_key, status, detail, reported_at, observed_at)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(trail_key) DO UPDATE SET
           status = excluded.status,
           detail = excluded.detail,
           reported_at = excluded.reported_at,
           observed_at = excluded.observed_at`
      ).bind(e.trail_key, e.status, e.detail, e.reported_at, e.observed_at)
    );
  }
  statements.push(
    db.prepare(
      "INSERT INTO scrape_runs (ran_at, trails_observed, trails_unusable, changes_recorded) VALUES (?, ?, ?, ?)"
    ).bind(observedAt, observed, unusable, events.length)
  );

  await db.batch(statements);
  return { observed, unusable, changes: events.length };
}
