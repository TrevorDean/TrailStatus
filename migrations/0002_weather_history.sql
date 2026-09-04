-- Weather archive + forecast vintages: the training data for reopening prediction.
--
-- The question this exists to answer is "when will a closed trail open again?".
-- The physical half of that is a water balance — rain in, evapotranspiration out
-- — so this stores ET0 and modelled soil moisture alongside rainfall, not just
-- rain and temperature. See public/weather.js (ARCHIVE_VARS) for why.
--
-- Weather is BACKFILLABLE (Open-Meteo serves 92 days of past hours from the same
-- endpoint), which is why this table can be created late and still reach back
-- before the status archive began on 2026-08-30. forecast_snapshots is the one
-- table that can never be backfilled — see below.

-- One row per trailhead per hour. Per-trail rather than per-grid-cell: only 3 of
-- the 58 trailheads share a rounded location, so normalising would save ~5% of
-- rows and cost every query a join.
CREATE TABLE weather_hourly (
  trail_key         TEXT    NOT NULL,
  hour_ts           INTEGER NOT NULL,  -- epoch seconds, top of the hour, UTC

  precip_in         REAL,              -- inches, THIS hour only (not cumulative)
  temp_f            REAL,
  et0_in            REAL,              -- FAO Penman-Monteith reference ET
  humidity_pct      REAL,              -- %
  wind_kmh          REAL,              -- km/h (NOT affected by temperature_unit)
  radiation_wm2     REAL,              -- W/m²
  soil_moist_0_1    REAL,              -- m³/m³, 0-1 cm — the surface a tyre meets
  soil_moist_1_3    REAL,              -- m³/m³
  soil_moist_3_9    REAL,              -- m³/m³
  soil_temp_f       REAL,              -- °F, and see the unit note below

  -- UNITS ARE NOT PER-VARIABLE. Open-Meteo applies `precipitation_unit` to ET0
  -- as well as rainfall, and `temperature_unit` to soil temperature as well as
  -- air temperature. Both are set in public/weather.js, so ET0 arrives in INCHES
  -- (0.187 in/day, not 4.75 mm/day) and soil temperature in FAHRENHEIT.
  --
  -- Inches for ET0 is the happy accident worth keeping: rainfall and ET0 in the
  -- same unit makes the water balance this whole table exists to support a plain
  -- subtraction, precip_in - et0_in, with no conversion to get wrong. Changing
  -- either unit in weather.js silently rescales a stored column — rename it here
  -- in the same commit if that ever happens.

  -- NULL means "the model produced no value for this hour", which is NOT zero.
  -- Same rule as history.js's Unavailable handling: absence of an observation is
  -- not an observation of absence, and a backfilled gap must stay visible.

  PRIMARY KEY (trail_key, hour_ts)
) WITHOUT ROWID;

CREATE INDEX idx_weather_hour ON weather_hourly(hour_ts);

-- The forward forecast as it stood at a moment in time.
--
-- THIS IS THE ONLY TABLE HERE THAT CANNOT BE RECONSTRUCTED LATER. past_days
-- returns the model's after-the-fact analysis of what happened, never the
-- forecast that was actually available at the time. Backtesting "what would we
-- have predicted on Tuesday" against the analysis silently grades the model with
-- hindsight it would not have had, and every score comes out flattering.
--
-- Arrays are stored as JSON rather than exploded into rows because nothing
-- queries inside a vintage in SQL — a backtest loads the whole horizon at once.
CREATE TABLE forecast_snapshots (
  trail_key    TEXT    NOT NULL,
  snapshot_ts  INTEGER NOT NULL,  -- when this forecast was taken
  horizon_ts   INTEGER NOT NULL,  -- first hour it covers
  times_json   TEXT    NOT NULL,
  precip_json  TEXT    NOT NULL,
  temp_json    TEXT    NOT NULL,
  et0_json     TEXT    NOT NULL,
  PRIMARY KEY (trail_key, snapshot_ts)
) WITHOUT ROWID;

-- Trailforks' own "last updated" string, resolved to an absolute time.
--
-- status_events.reported_at is stored verbatim ("2 mins", "Jul 17, 2026",
-- "Nov 14, 2025") and stays that way — it is the raw record. But the STEWARD's
-- action time is the correct label for a model predicting steward behaviour,
-- and observed_at is only when the scraper noticed (up to 5 minutes later, and
-- arbitrarily later across a cron outage).
--
-- Resolution differs by age and the model must not pretend otherwise: recent
-- entries are relative and minute-accurate, older ones are day-granular with no
-- time at all. Prefer observed_at for transitions this archive actually watched;
-- use reported_ts to seed events that predate 2026-08-30.
ALTER TABLE status_events ADD COLUMN reported_ts TEXT;

CREATE INDEX idx_events_reported_ts ON status_events(reported_ts);
