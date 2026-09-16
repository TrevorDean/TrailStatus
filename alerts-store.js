// The stateful half of the alerts feature: D1 reads and writes, the Resend call,
// and the four HTTP handlers. alerts.js next door holds the pure logic; this file
// is everything that touches the outside world, kept separate for the same reason
// diffStatuses() is separable from recordStatusChanges() — the decisions are
// testable without a database, and only the plumbing needs one.

import {
  CONFIRM_TTL_H,
  MAX_SEND_ATTEMPTS,
  MAX_SIGNUPS_PER_DAY,
  RESEND_BATCH_SIZE,
  SEND_STALE_H,
  SIGNUP_COOLDOWN_MIN,
  chunk,
  isReopening,
  isScheduledReopening,
  newToken,
  selectRecipients,
  trailName,
  validateSubscription
} from "./alerts.js";
import { isClosedStatus } from "./public/status-buckets.js";

const JSON_HEADERS = { "Content-Type": "application/json", "Cache-Control": "no-store" };
const HTML_HEADERS = { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" };

// Links in an email cannot be relative, and the cron send path has no request to
// derive an origin from. Configured in wrangler.toml rather than inferred so a
// staging run cannot mail people links into production.
function siteOrigin(env, request) {
  if (env.SITE_ORIGIN) return env.SITE_ORIGIN.replace(/\/$/, "");
  return request ? new URL(request.url).origin : "https://ntx.trailstatus.workers.dev";
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

// The confirm/manage pages are the only HTML this Worker generates. They are
// deliberately plain and self-contained rather than reusing styles.css: they are
// reached from a mail client, often on a phone, and a page that renders correctly
// with no network beyond the HTML itself cannot half-load.
function page(title, bodyHtml) {
  return new Response(
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width, initial-scale=1">` +
      `<title>${escapeHtml(title)}</title><style>` +
      `body{background:#f4f7f3;color:#162018;font:16px/1.5 system-ui,sans-serif;margin:0;padding:2rem}` +
      `main{background:#fff;border:1px solid #d7ded7;border-radius:8px;margin:0 auto;max-width:34rem;padding:1.5rem}` +
      `h1{font-size:1.25rem;margin:0 0 .75rem}` +
      `a{color:#125a37}` +
      `button{background:#1f7a4d;border:0;border-radius:6px;color:#fff;cursor:pointer;font:inherit;padding:.6rem 1rem}` +
      `ul{padding-left:1.2rem}` +
      `</style></head><body><main>${bodyHtml}</main></body></html>`,
    { headers: HTML_HEADERS }
  );
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------

// One place the Resend request is built, for the same reason public/weather.js is
// the one place the Open-Meteo request is built.
//
// List-Unsubscribe is not decoration. Gmail and Yahoo require a one-click
// unsubscribe header on bulk mail, and RFC 8058 specifies it as a POST — which is
// also what makes it safe, because a mail client that prefetches a GET link
// cannot accidentally trip it.
async function resendSend(env, messages, fetchImpl = fetch) {
  const response = await fetchImpl("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(messages)
  });
  if (!response.ok) {
    throw new Error(`resend ${response.status}: ${(await response.text()).slice(0, 200)}`);
  }
  return response.json();
}

function confirmMessage(env, request, email, token, trailNames) {
  const origin = siteOrigin(env, request);
  const link = `${origin}/api/alerts/confirm?token=${token}`;
  return {
    from: env.ALERTS_FROM || "North Texas MTB Trail Status <alerts@ntxtrailstatus.com>",
    to: [email],
    subject: "Confirm your trail alerts",
    text:
      `Someone (hopefully you) asked for trail reopening alerts from North Texas MTB Trail Status.\n\n` +
      `Confirm here, and we will email you when these trails reopen:\n${link}\n\n` +
      trailNames.map((n) => `  - ${n}`).join("\n") +
      `\n\nThe link is good for ${CONFIRM_TTL_H} hours. If this was not you, ignore this ` +
      `message — nothing was subscribed and you will not hear from us again.\n`
  };
}

function alertMessage(env, send, origin) {
  const manageLink = `${origin}/api/alerts/manage?token=${send.manage_token}`;
  const where = send.city ? ` (${send.city})` : "";
  return {
    from: env.ALERTS_FROM || "North Texas MTB Trail Status <alerts@ntxtrailstatus.com>",
    to: [send.email],
    subject: `${send.trail_name} is open again`,
    headers: {
      "List-Unsubscribe": `<${origin}/api/alerts/unsubscribe?token=${send.manage_token}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click"
    },
    text:
      `${send.trail_name}${where} just changed to "${send.status}".\n\n` +
      (send.url ? `Trailforks: ${send.url}\n` : "") +
      `All trails: ${origin}\n\n` +
      `Conditions are reported by volunteer stewards and can change fast — check ` +
      `before you drive out.\n\n` +
      `Manage or stop these alerts: ${manageLink}\n`
  };
}

/**
 * The send path, run from scheduled() AFTER the archive batch has committed.
 *
 * Claim-then-send: a row in alert_sends is inserted as 'pending' before the mail
 * goes out, so a cron retry, a status that flaps, or two overlapping invocations
 * all collapse onto one email. CLAUDE.md blames the permanent holes in
 * scrape_runs on a fire-and-forget writer; the cost of that mistake is higher
 * here, because the failure lands in a stranger's inbox instead of a query.
 */
export async function sendReopenAlerts(env, events, now = new Date(), fetchImpl = fetch) {
  if (!env.TRAIL_HISTORY || !env.RESEND_API_KEY) return { skipped: "missing binding" };

  const db = env.TRAIL_HISTORY;
  const candidates = (events || []).filter(isReopening);
  if (candidates.length === 0) return { reopenings: 0, sent: 0 };

  // Drop the reopenings the calendar already explains. Reading the closure time
  // one trail at a time is fine: a tick with any reopening at all is rare, and a
  // tick with several is rarer still.
  const reopenings = [];
  for (const event of candidates) {
    const closedTs = await lastClosureStart(db, event.trail_key, event.observed_at);
    const openedTs = Date.parse(event.observed_at) / 1000;
    if (isScheduledReopening(event.trail_key, closedTs, openedTs)) continue;
    reopenings.push(event);
  }
  if (reopenings.length === 0) return { reopenings: candidates.length, suppressed: candidates.length, sent: 0 };

  const keys = reopenings.map((e) => e.trail_key);
  const { results } = await db
    .prepare(
      `SELECT s.trail_key, s.email, b.manage_token, b.confirmed_at
         FROM alert_subscriptions s
         JOIN alert_subscribers b ON b.email = s.email
        WHERE b.confirmed_at IS NOT NULL
          AND s.trail_key IN (${keys.map(() => "?").join(",")})`
    )
    .bind(...keys)
    .all();

  const sends = selectRecipients(reopenings, results || []);
  if (sends.length === 0) return { reopenings: reopenings.length, sent: 0 };

  const stamp = now.toISOString();
  // Claim first. INSERT OR IGNORE makes this idempotent; meta.changes tells us
  // which rows are ours to send. D1 caps bound parameters at 100 per statement,
  // hence one statement per claim inside a batch rather than one wide insert.
  const claims = await db.batch(
    sends.map((s) =>
      db
        .prepare(
          `INSERT OR IGNORE INTO alert_sends (email, trail_key, event_at, state, attempts, updated_at)
           VALUES (?, ?, ?, 'pending', 0, ?)`
        )
        .bind(s.email, s.trail_key, s.event_at, stamp)
    )
  );
  const mine = sends.filter((_, i) => (claims[i]?.meta?.changes || 0) === 1);
  if (mine.length === 0) return { reopenings: reopenings.length, sent: 0, alreadyClaimed: sends.length };

  const origin = siteOrigin(env, null);
  let sent = 0;
  let failed = 0;
  for (const group of chunk(mine, RESEND_BATCH_SIZE)) {
    let ok = true;
    try {
      await resendSend(env, group.map((s) => alertMessage(env, s, origin)), fetchImpl);
    } catch (error) {
      ok = false;
      console.error(`alert batch failed: ${error.message}`);
    }
    sent += ok ? group.length : 0;
    failed += ok ? 0 : group.length;
    await db.batch(
      group.map((s) =>
        db
          .prepare(
            `UPDATE alert_sends SET state = ?, attempts = attempts + 1, updated_at = ?
              WHERE email = ? AND trail_key = ? AND event_at = ?`
          )
          .bind(ok ? "sent" : "failed", stamp, s.email, s.trail_key, s.event_at)
      )
    );
  }
  return { reopenings: reopenings.length, sent, failed };
}

/**
 * Retry sweep, run on the same tick as the send.
 *
 * Bounded twice over, because the thing being retried is an email. MAX_SEND_ATTEMPTS
 * stops an address that always fails from being hammered, and SEND_STALE_H stops
 * a backlog from announcing a reopening that has since been reversed — a trail
 * that opened six hours ago and shut again is not news anyone wants.
 */
export async function retryFailedAlerts(env, now = new Date(), fetchImpl = fetch) {
  if (!env.TRAIL_HISTORY || !env.RESEND_API_KEY) return { skipped: "missing binding" };

  const db = env.TRAIL_HISTORY;
  const cutoff = new Date(now.getTime() - SEND_STALE_H * 3600 * 1000).toISOString();
  const { results } = await db
    .prepare(
      `SELECT a.email, a.trail_key, a.event_at, b.manage_token
         FROM alert_sends a
         JOIN alert_subscribers b ON b.email = a.email
        WHERE a.state IN ('pending', 'failed')
          AND a.attempts < ?
          AND a.event_at >= ?
          AND b.confirmed_at IS NOT NULL
        LIMIT ?`
    )
    .bind(MAX_SEND_ATTEMPTS, cutoff, RESEND_BATCH_SIZE)
    .all();

  const rows = results || [];
  if (rows.length === 0) return { retried: 0 };

  // Abandon anything now too old or too tried, so the sweep cannot grow forever.
  await db
    .prepare(
      `UPDATE alert_sends SET state = 'failed', updated_at = ?
        WHERE state IN ('pending', 'failed') AND (attempts >= ? OR event_at < ?)`
    )
    .bind(now.toISOString(), MAX_SEND_ATTEMPTS, cutoff)
    .run();

  // Built directly rather than through selectRecipients(): these rows are already
  // one-per-(email, trail, event), and the SQL above has done the confirmed-only
  // filtering. The status is not re-stated in a retry — by now it may have moved
  // again, and the subject line carries the news on its own.
  const sends = rows.map((r) => ({
    email: r.email,
    manage_token: r.manage_token,
    trail_key: r.trail_key,
    trail_name: trailName(r.trail_key),
    city: "",
    url: "",
    status: "open",
    event_at: r.event_at
  }));
  const origin = siteOrigin(env, null);
  const stamp = now.toISOString();
  let ok = true;
  try {
    await resendSend(env, sends.map((s) => alertMessage(env, s, origin)), fetchImpl);
  } catch (error) {
    ok = false;
    console.error(`alert retry failed: ${error.message}`);
  }
  await db.batch(
    rows.map((r) =>
      db
        .prepare(
          `UPDATE alert_sends SET state = ?, attempts = attempts + 1, updated_at = ?
            WHERE email = ? AND trail_key = ? AND event_at = ?`
        )
        .bind(ok ? "sent" : "failed", stamp, r.email, r.trail_key, r.event_at)
    )
  );
  return { retried: rows.length, ok };
}

// When did the closure that just ended begin? Walks back to the most recent
// transition INTO a closed status before this reopening. Returns null when the
// closure predates the archive, which the caller reads as "not explained by a
// schedule" and therefore sends.
async function lastClosureStart(db, trailKey, openedAt) {
  const { results } = await db
    .prepare(
      `SELECT prev_status, status, reported_ts, observed_at
         FROM status_events
        WHERE trail_key = ? AND observed_at < ?
        ORDER BY observed_at DESC
        LIMIT 40`
    )
    .bind(trailKey, openedAt)
    .all();

  for (const row of results || []) {
    if (!isClosedStatus(row.status)) continue;
    if (isClosedStatus(row.prev_status)) continue; // still inside the same closure
    // Same precision rule as build-episodes.js eventTime(): a 10-character
    // reported_ts is day-granular and loses to the moment we actually saw it.
    const ts = row.reported_ts && row.reported_ts.length > 10 ? row.reported_ts : row.observed_at;
    return Date.parse(ts) / 1000;
  }
  return null;
}

// ---------------------------------------------------------------------------
// HTTP handlers
// ---------------------------------------------------------------------------

/**
 * POST /api/alerts/subscribe
 *
 * Always answers 202, whatever happened. Saying "already subscribed" would turn
 * this into an oracle for whether an address is on the list, and the honest
 * status for "we have accepted this and will mail you if it checks out" is 202
 * anyway.
 */
export async function handleSubscribe(request, env) {
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method not allowed" }), { status: 405, headers: JSON_HEADERS });
  }
  if (!env.TRAIL_HISTORY) {
    return new Response(JSON.stringify({ error: "alerts unavailable" }), { status: 503, headers: JSON_HEADERS });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid request" }), { status: 400, headers: JSON_HEADERS });
  }

  const valid = validateSubscription(body);
  if (!valid.ok) {
    return new Response(JSON.stringify({ error: valid.error }), { status: 400, headers: JSON_HEADERS });
  }

  const db = env.TRAIL_HISTORY;
  const now = new Date();
  const accepted = new Response(JSON.stringify({ ok: true }), { status: 202, headers: JSON_HEADERS });

  // The circuit breaker. D1's write quota is account-wide, so a signup flood
  // does not just break alerts — it takes the status archive with it.
  const today = now.toISOString().slice(0, 10);
  const { results: countRows } = await db
    .prepare("SELECT COUNT(*) AS n FROM alert_subscribers WHERE created_at >= ?")
    .bind(`${today}T00:00:00.000Z`)
    .all();
  if ((countRows?.[0]?.n || 0) >= MAX_SIGNUPS_PER_DAY) {
    console.error("alert signups: daily cap reached");
    return accepted;
  }

  const { results: existingRows } = await db
    .prepare("SELECT email, confirmed_at, confirm_token, manage_token, last_signup_at FROM alert_subscribers WHERE email = ?")
    .bind(valid.email)
    .all();
  const existing = existingRows?.[0];

  // The anti-bombing guard. Repeat submissions still update the trail list, so a
  // genuine person editing their choices is not blocked; what is rate limited is
  // the outbound mail.
  const cooledDown =
    !existing ||
    Date.parse(existing.last_signup_at || 0) < now.getTime() - SIGNUP_COOLDOWN_MIN * 60 * 1000;

  const confirmToken = existing?.confirmed_at ? null : existing?.confirm_token || newToken();
  const manageToken = existing?.manage_token || newToken();
  const stamp = now.toISOString();

  const statements = [
    db
      .prepare(
        `INSERT INTO alert_subscribers (email, confirm_token, manage_token, confirmed_at, created_at, last_signup_at)
         VALUES (?, ?, ?, NULL, ?, ?)
         ON CONFLICT(email) DO UPDATE SET last_signup_at = excluded.last_signup_at`
      )
      .bind(valid.email, confirmToken, manageToken, stamp, stamp),
    db.prepare("DELETE FROM alert_subscriptions WHERE email = ?").bind(valid.email),
    ...valid.trails.map((key) =>
      db.prepare("INSERT OR IGNORE INTO alert_subscriptions (email, trail_key) VALUES (?, ?)").bind(valid.email, key)
    )
  ];
  await db.batch(statements);

  // An address that has already confirmed does not need another confirmation
  // mail just because it edited its trail list.
  if (!existing?.confirmed_at && cooledDown && env.RESEND_API_KEY) {
    const names = valid.trails.map(trailName);
    try {
      await resendSend(env, [confirmMessage(env, request, valid.email, confirmToken, names)]);
    } catch (error) {
      console.error(`confirm mail failed: ${error.message}`);
    }
  }
  return accepted;
}

/** GET /api/alerts/confirm?token= — the double opt-in click. */
export async function handleConfirm(request, env) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!token || !env.TRAIL_HISTORY) return page("Trail alerts", "<h1>That link is not valid.</h1>");

  const db = env.TRAIL_HISTORY;
  const { results } = await db
    .prepare("SELECT email, created_at, confirmed_at FROM alert_subscribers WHERE confirm_token = ?")
    .bind(token)
    .all();
  const row = results?.[0];
  if (!row) {
    return page(
      "Trail alerts",
      "<h1>That link has already been used, or expired.</h1><p>If your alerts are not working, just sign up again.</p>"
    );
  }

  // An expired link is not an error to apologise for — it is the system working.
  if (Date.parse(row.created_at) < Date.now() - CONFIRM_TTL_H * 3600 * 1000) {
    return page("Trail alerts", `<h1>That link expired.</h1><p>Confirmation links are good for ${CONFIRM_TTL_H} hours. Sign up again and we will send a fresh one.</p>`);
  }

  await db
    .prepare("UPDATE alert_subscribers SET confirmed_at = ?, confirm_token = NULL WHERE confirm_token = ?")
    .bind(new Date().toISOString(), token)
    .run();

  return page(
    "Trail alerts confirmed",
    `<h1>You're set.</h1><p>We'll email <strong>${escapeHtml(row.email)}</strong> when one of your trails reopens.</p><p><a href="/">Back to trail status</a></p>`
  );
}

/**
 * GET /api/alerts/manage?token=
 *
 * This exists because unsubscribe must not happen on a GET. Mail clients and
 * corporate link scanners fetch every URL in a message; a GET that deleted would
 * quietly unsubscribe people who never clicked anything. So the link in the email
 * lands here, and the button below POSTs.
 */
export async function handleManage(request, env) {
  const token = new URL(request.url).searchParams.get("token") || "";
  if (!token || !env.TRAIL_HISTORY) return page("Trail alerts", "<h1>That link is not valid.</h1>");

  const db = env.TRAIL_HISTORY;
  const { results } = await db
    .prepare(
      `SELECT b.email, s.trail_key
         FROM alert_subscribers b
         LEFT JOIN alert_subscriptions s ON s.email = b.email
        WHERE b.manage_token = ?`
    )
    .bind(token)
    .all();
  if (!results?.length) return page("Trail alerts", "<h1>That link is not valid.</h1>");

  const trails = results.map((r) => r.trail_key).filter(Boolean);
  return page(
    "Manage trail alerts",
    `<h1>Your trail alerts</h1>` +
      `<p>We email <strong>${escapeHtml(results[0].email)}</strong> when these reopen:</p>` +
      `<ul>${trails.map((t) => `<li>${escapeHtml(trailName(t))}</li>`).join("")}</ul>` +
      `<form method="POST" action="/api/alerts/unsubscribe">` +
      `<input type="hidden" name="token" value="${escapeHtml(token)}">` +
      `<button type="submit">Unsubscribe from all alerts</button></form>` +
      `<p><a href="/">Back to trail status</a></p>`
  );
}

/**
 * POST /api/alerts/unsubscribe
 *
 * Accepts the token as a form field (the manage page) or a query parameter (the
 * RFC 8058 one-click header, which mail providers POST). Deletes rather than
 * flags: someone who unsubscribed asked to be gone, and keeping the row would
 * mean keeping their address.
 */
export async function handleUnsubscribe(request, env) {
  if (request.method !== "POST") {
    return page("Trail alerts", `<h1>Almost.</h1><p>Open the manage link from your email to unsubscribe.</p>`);
  }
  if (!env.TRAIL_HISTORY) return page("Trail alerts", "<h1>Alerts are unavailable right now.</h1>");

  let token = new URL(request.url).searchParams.get("token") || "";
  if (!token) {
    try {
      token = (await request.formData()).get("token") || "";
    } catch {
      token = "";
    }
  }
  if (!token) return page("Trail alerts", "<h1>That link is not valid.</h1>");

  const db = env.TRAIL_HISTORY;
  const { results } = await db
    .prepare("SELECT email FROM alert_subscribers WHERE manage_token = ?")
    .bind(token)
    .all();
  const email = results?.[0]?.email;
  if (!email) {
    return page("Trail alerts", "<h1>You're unsubscribed.</h1><p>Nothing more will be sent to that address.</p>");
  }

  await db.batch([
    db.prepare("DELETE FROM alert_subscriptions WHERE email = ?").bind(email),
    db.prepare("DELETE FROM alert_sends WHERE email = ?").bind(email),
    db.prepare("DELETE FROM alert_subscribers WHERE email = ?").bind(email)
  ]);

  return page(
    "Unsubscribed",
    `<h1>You're unsubscribed.</h1><p>We've deleted <strong>${escapeHtml(email)}</strong> and your trail choices.</p><p><a href="/">Back to trail status</a></p>`
  );
}
