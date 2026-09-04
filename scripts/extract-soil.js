// One-time soil lookup for every trailhead, from USDA NRCS SSURGO.
//
// Soil is the largest non-weather driver of how long a trail stays closed, and
// this network spans the full range of it: Big Cedar sits on Stephen silty clay
// (hydrologic group D — highest runoff, slowest to drain) while Lindsey Park in
// Tyler is on Pickton loamy fine sand (group A). Identical rain on those two
// does not produce remotely similar reopening times, and no amount of extra
// weather detail can tell you that. One static field does.
//
//   node scripts/extract-soil.js              # look up + print, write nothing
//   node scripts/extract-soil.js --write      # also splice fields into trails.js
//   node scripts/extract-soil.js --update     # accept current values into the lock
//
// Unlike extract-parking.js this needs no GitHub runner — Soil Data Access is a
// public API with no key and no bot blocking, so it runs anywhere.
//
// It writes trails.js DIRECTLY, which extract-parking.js deliberately does not.
// The difference: parking re-scrapes a field that already holds hand-corrections
// a splice could silently revert, whereas these three fields are new, are looked
// up once, and are never re-swept. The lock file guards them from here on.

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { TRAILS } from "../public/trails.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const LOCK = join(HERE, "soil.lock.json");
const TRAILS_JS = join(HERE, "..", "public", "trails.js");
const ENDPOINT = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest";

// A trailhead coordinate is not a survey marker — CLAUDE.md records that ~17 of
// the 58 are city-center approximations — so a point can easily land in a lake
// or on a car park and come back "Water" or empty. Rather than accept that, try
// progressively: the trail point, then the parking point, then a ring around it.
// ~0.0025 deg is about 275 m here.
const RING = [0.0025, 0.006].flatMap((r) =>
  [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]].map(([dlat, dlng]) => ({ dlat, dlng, r }))
);

const NO_SOIL = /^(water|no digital data available|dam|pits|urban land)/i;

function delay(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function lookup(lat, lng) {
  const query = `SELECT TOP 1 mu.muname, c.compname, c.drainagecl, c.hydgrp
    FROM SDA_Get_Mukey_from_intersection_with_WktWgs84('point(${lng} ${lat})') AS m
    JOIN mapunit mu ON mu.mukey = m.mukey
    JOIN component c ON c.mukey = mu.mukey
    ORDER BY c.comppct_r DESC`;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ format: "JSON+COLUMNNAME", query })
  });
  if (!res.ok) throw new Error(`SDA returned ${res.status}`);
  const row = (await res.json())?.Table?.[1];
  if (!row) return null;
  const [muname, compname, drainagecl, hydgrp] = row;
  if (!muname || NO_SOIL.test(muname) || !hydgrp) return null;
  return { muname, compname, drainagecl: drainagecl || null, hydgrp };
}

async function resolve(trail) {
  const points = [{ lat: trail.lat, lng: trail.lng, via: "trail" }];
  if (typeof trail.parkingLat === "number") {
    points.push({ lat: trail.parkingLat, lng: trail.parkingLng, via: "parking" });
  }
  if (Array.isArray(trail.parking)) {
    for (const lot of trail.parking) points.push({ lat: lot.lat, lng: lot.lng, via: `lot:${lot.name}` });
  }
  for (const { dlat, dlng, r } of RING) {
    points.push({ lat: trail.lat + dlat, lng: trail.lng + dlng, via: `ring:${r}` });
  }

  for (const point of points) {
    try {
      const hit = await lookup(point.lat, point.lng);
      if (hit) return { ...hit, via: point.via };
    } catch (error) {
      if (!/50\d/.test(error.message)) throw error;
    }
    await delay(120);
  }
  return null;
}

function snapshot(list) {
  return Object.fromEntries(
    list.filter((r) => r.soil).map((r) => [r.key, {
      soilSeries: r.soil.compname,
      drainageClass: r.soil.drainagecl,
      hydGroup: r.soil.hydgrp
    }])
  );
}

// Splices the three fields in after `city`, which every entry has, so the shape
// of trails.js is unchanged apart from three added keys per line.
function spliceTrailsJs(results) {
  let source = readFileSync(TRAILS_JS, "utf8");
  let added = 0;
  for (const r of results) {
    if (!r.soil) continue;
    // [\s\S] rather than [^\n]: northshore's `parking:` array spans four lines,
    // and a line-bounded match silently skipped it on the first run.
    const entry = new RegExp(`(\\{ key: "${r.key}",[\\s\\S]*?)(, city: )`);
    if (!entry.test(source)) { console.warn(`  ! could not locate ${r.key} in trails.js`); continue; }
    if (new RegExp(`key: "${r.key}",[\\s\\S]*?hydGroup[\\s\\S]*?, city: `).test(source)) continue;
    const fields = `, soilSeries: ${JSON.stringify(r.soil.compname)}` +
      `, drainageClass: ${JSON.stringify(r.soil.drainagecl)}` +
      `, hydGroup: ${JSON.stringify(r.soil.hydgrp)}`;
    source = source.replace(entry, `$1${fields}$2`);
    added++;
  }
  writeFileSync(TRAILS_JS, source);
  return added;
}

(async () => {
  const write = process.argv.includes("--write");
  const update = process.argv.includes("--update");

  const results = [];
  for (const trail of TRAILS) {
    const soil = await resolve(trail);
    results.push({ key: trail.key, soil });
    const label = soil
      ? `${soil.hydgrp}  ${soil.compname} (${soil.muname})${soil.via === "trail" ? "" : "  via " + soil.via}`
      : "UNRESOLVED";
    console.log(trail.key.padEnd(30), label);
  }

  const resolved = results.filter((r) => r.soil);
  const groups = {};
  for (const r of resolved) groups[r.soil.hydgrp] = (groups[r.soil.hydgrp] || 0) + 1;
  console.log(`\n${resolved.length}/${TRAILS.length} resolved.`);
  console.log("hydrologic group:", Object.entries(groups).sort().map(([g, n]) => `${g}=${n}`).join("  "));
  const unresolved = results.filter((r) => !r.soil).map((r) => r.key);
  if (unresolved.length) console.log("UNRESOLVED (needs a hand-picked point):", unresolved.join(", "));

  if (write) {
    const added = spliceTrailsJs(results);
    console.log(`\nSpliced ${added} entries into public/trails.js.`);
  }

  if (write || update) {
    writeFileSync(LOCK, JSON.stringify(snapshot(results), null, 2) + "\n");
    console.log(`Wrote ${LOCK}.`);
  } else if (existsSync(LOCK)) {
    const locked = JSON.stringify(JSON.parse(readFileSync(LOCK, "utf8")));
    if (locked !== JSON.stringify(snapshot(results))) {
      console.error("\nDRIFT: soil values differ from scripts/soil.lock.json. Re-run with --update to accept.");
      process.exit(1);
    }
    console.log("Matches soil.lock.json.");
  }
})();
