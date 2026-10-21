-- Every estimate the site showed, as it was shown: one row per trail per hourly
-- predictions run, written by recordPredictions() in predictions.js.
--
-- KV "trail_predictions" holds only the newest run, so without this the estimate
-- a visitor saw on Thursday evening is gone by Friday and a storm cannot be
-- graded. Joined against status_events, it answers what the drying-model fit
-- cannot: how far off a reopening estimate was at each lead time, how much
-- warning a closure got (or that it got none), and how often a warning was a
-- false alarm — all against the FORECAST the model actually had, where the fit
-- drains the bucket with observed weather and flatters itself.
--
-- Only entries that carry a time are written: a reopen or close estimate, a
-- "not before" bound, or a scheduled reopening. "Open, nothing coming" is the
-- common case and is implied by a run with no row for that trail. The declining
-- categories (overdue past the band, unexplained, unknown-start, …) show nothing
-- on the site and are not logged.

CREATE TABLE prediction_log (
  trail_key    TEXT    NOT NULL,
  made_at      INTEGER NOT NULL,  -- when the run made this estimate, epoch s UTC
  basis        TEXT    NOT NULL,  -- 'weather' | 'forecast' | 'scheduled' (predictions.js)
  status       TEXT,              -- the trail's status the run saw, verbatim
  reopen_at    INTEGER,           -- predicted reopening, epoch s
  reopen_after INTEGER,           -- "not before this" — the forecast ran out first
  close_at     INTEGER,           -- predicted closure of an open trail, epoch s
  overdue      INTEGER,           -- 1 = drained already, shown as "Should be dry"
  w            REAL,              -- the bucket's level at made_at, inches
  PRIMARY KEY (trail_key, made_at)
) WITHOUT ROWID;

-- No secondary index, like rain_hourly: one write per row. A dry day writes
-- nothing; a storm ~10-20 trails x 24 runs, a few hundred writes a day.
