-- Email alerts: who wants to be told when a trail reopens, and what we already told them.
--
-- This is the FIRST personal data the project stores. Everything else here is
-- public trail observations; these three tables are a mailing list. Two rules
-- follow from that and are enforced below rather than by convention:
--   * confirmed_at NULL means NOTHING may be sent to that address, ever. A row
--     exists the moment someone types an address into the form, and anyone can
--     type someone else's address.
--   * manage_token is the only credential. There are no accounts and no
--     passwords, so the token in an unsubscribe link IS the identity. It must be
--     generated with crypto.getRandomValues, never a counter or a timestamp.

CREATE TABLE alert_subscribers (
  email          TEXT PRIMARY KEY,  -- lowercased and trimmed before it gets here
  confirm_token  TEXT,              -- NULL once confirmed; the double opt-in nonce
  manage_token   TEXT NOT NULL,     -- unsubscribe + manage; long-lived, never rotated
  confirmed_at   TEXT,              -- NULL = pending. The send path MUST check this.
  created_at     TEXT NOT NULL,
  last_signup_at TEXT NOT NULL      -- per-address cooldown; see the abuse note below
);

-- Both tokens are looked up by value on every confirm/unsubscribe click, and a
-- table scan for a credential is how a slow endpoint becomes an oracle.
CREATE INDEX idx_alert_confirm ON alert_subscribers(confirm_token);
CREATE INDEX idx_alert_manage  ON alert_subscribers(manage_token);

-- The subscription itself. Composite PK rather than a surrogate id because
-- "this address, this trail" is the whole identity of a row, and re-subscribing
-- to a trail you already follow must be a no-op, not a duplicate email.
CREATE TABLE alert_subscriptions (
  email     TEXT NOT NULL,
  trail_key TEXT NOT NULL,          -- joins public/trails.js; validated before insert
  PRIMARY KEY (email, trail_key)
);

-- The send path starts from a reopening and asks "who follows THIS trail", so
-- the lookup runs the opposite way round from the primary key.
CREATE INDEX idx_alert_sub_trail ON alert_subscriptions(trail_key);

-- The idempotency ledger, and the reason this feature is not fire-and-forget.
--
-- A row is CLAIMED with INSERT OR IGNORE *before* the send, so a cron retry, a
-- status that flaps closed/open/closed, and two overlapping invocations all
-- collapse onto one email. scrape_runs has permanent holes because its writer
-- had no equivalent; the cost of getting this wrong is higher here, because the
-- failure is visible to a stranger's inbox rather than to a query.
--
-- event_at is the transition's observed_at, NOT the send time: it is what makes
-- the key stable across retries.
CREATE TABLE alert_sends (
  email      TEXT NOT NULL,
  trail_key  TEXT NOT NULL,
  event_at   TEXT NOT NULL,
  state      TEXT NOT NULL,          -- 'pending' | 'sent' | 'failed'
  attempts   INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (email, trail_key, event_at)
);

-- Drives the retry sweep on the next cron tick.
CREATE INDEX idx_alert_sends_state ON alert_sends(state);
