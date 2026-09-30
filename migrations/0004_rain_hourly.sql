-- Rain that actually fell, per trailhead per hour: NOAA MRMS radar, with the NWS
-- National Blend of Models (NBM) filling any hour MRMS was missed.
--
-- weather_hourly.precip_in is a MODEL's first guess (HRRR via Open-Meteo, ~3 km),
-- captured minutes into the hour and never revised. It routinely disagrees with
-- the gauges around it: on 2026-09-30 it put 0.28 in on Big Cedar while the
-- Redbird airport gauge 9 km away caught 0.35 in and the USGS Joe Pool Lake gauge
-- 4 km away caught 0.08 in. This table is the replacement for "how much rain did
-- this trail get"; precip_in stays for comparison. Open-Meteo remains the source
-- for FORECASTS — this is only about rain already received.
--
-- source = 'mrms': the NWS MRMS QPE image service (mapservices.weather.noaa.gov,
-- obs/mrms_qpe), layer conus_QPE_01H — a 1 km radar mosaic of the last hour's
-- accumulation, sampled at each trailhead's own coordinates. RADAR-ONLY, not
-- gauge-corrected (its own description says "based only on radar data"); on
-- 2026-09-30 it read 0.17 in over the Redbird gauge that measured 0.35 in.
--
-- source = 'nbm': Open-Meteo's ncep_nbm_conus, same coordinates. A MODEL, used
-- only because the MRMS service keeps nothing but the newest hour — an hour not
-- sampled while it was current can never be fetched again. See rain-history.js
-- for when a fill happens. Filter on source when the distinction matters.
--
-- A row with rain_in NULL means "fetched, but no value for that point". A missing
-- row means neither source ever covered that hour (e.g. an outage longer than
-- NBM's 48-hour look-back). Neither is zero.

CREATE TABLE rain_hourly (
  trail_key  TEXT    NOT NULL,
  hour_ts    INTEGER NOT NULL,  -- END of the hour the rain fell in, epoch s UTC. MRMS's
                                -- validend and Open-Meteo's "sum of the preceding hour"
                                -- both use this convention, so this joins weather_hourly
                                -- on (trail_key, hour_ts) directly.
  rain_in    REAL,              -- inches. MRMS is converted from MILLIMETRES (its legend
                                -- says inches; its pixel values are mm).
  source     TEXT    NOT NULL,  -- 'mrms' | 'nbm'
  PRIMARY KEY (trail_key, hour_ts)
) WITHOUT ROWID;

-- No secondary index on purpose: WITHOUT ROWID with only the primary key keeps
-- this at ONE write per row (weather_hourly costs two), ~1,400 writes a day.
