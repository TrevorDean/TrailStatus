-- Trail status history: an archive of every open/closed transition.
--
-- Written by the Worker's scheduled() handler every 5 minutes (see history.js),
-- which diffs the current KV scrape against trail_state. NOT written by
-- scripts/update-trail-status.js — the Worker uses a binding, so no Cloudflare
-- API token needs D1 permissions and the load-bearing scraper stays untouched.
--
-- Statuses are stored VERBATIM as Trailforks reports them (Open, Closed, Caution,
-- Ideal, Dry, Very Dry, Wet, Variable, Prevalent Mud). Do not collapse them into
-- the three buckets statusClassFor() uses for the UI — that is lossy, and a
-- future reader can always bucket, never unbucket.

-- The archive itself: one row per real transition. Low volume by design.
CREATE TABLE status_events (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  trail_key   TEXT NOT NULL,
  prev_status TEXT,               -- NULL on a trail's first-ever observation
  status      TEXT NOT NULL,
  detail      TEXT,
  reported_at TEXT,               -- Trailforks' own "updated" string, verbatim
  observed_at TEXT NOT NULL       -- ISO8601 UTC, when this run saw it
);
CREATE INDEX idx_events_trail_time ON status_events(trail_key, observed_at);
CREATE INDEX idx_events_time       ON status_events(observed_at);

-- Last known REAL status per trail: 58 rows, written only when one changes.
-- The diff compares against THIS, not against the previous KV value, because KV
-- holds whatever was last scraped including "Unavailable" — which is the absence
-- of an observation, not a status. Comparing against KV would record
-- Open -> Unavailable -> Open on every transient Trailforks 403.
CREATE TABLE trail_state (
  trail_key   TEXT PRIMARY KEY,
  status      TEXT NOT NULL,
  detail      TEXT,
  reported_at TEXT,
  observed_at TEXT NOT NULL       -- when this status was first seen
);

-- Heartbeat. Proves we were watching, which is what separates "this trail was
-- open for three days" from "the scraper was dead for three days" — the
-- difference between a usable archive and a misleading one.
CREATE TABLE scrape_runs (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  ran_at           TEXT NOT NULL,
  trails_observed  INTEGER NOT NULL,   -- trails reporting a real status
  trails_unusable  INTEGER NOT NULL,   -- Unknown / Unavailable
  changes_recorded INTEGER NOT NULL
);
CREATE INDEX idx_runs_time ON scrape_runs(ran_at);
