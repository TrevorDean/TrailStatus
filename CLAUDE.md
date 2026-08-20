# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

North Texas MTB Trail Status — a single-page site showing open/closed status for 58 mountain bike trailheads, with a list view and a map view. The live site is https://ntx.trailstatus.workers.dev/ — there is no custom domain yet.

This is a public repo. Project TODOs and drafts live in the gitignored `private/` directory (local machine only) — keep them and anything else non-public out of tracked files. Status data is scraped from Trailforks trail/region pages by regex-parsing their HTML (there is no Trailforks API in use). Everything runs on Cloudflare; there is no build step, no framework, no tests, and no linter — plain JS, HTML, and CSS.

## Commands

```bash
npm run dev        # wrangler dev --port 8788  (local dev; site at localhost:8788, API at /api/status)
npm run deploy     # wrangler deploy — deploy the live site (Worker "ntx")
npx wrangler deploy --env staging   # deploy to ntx-staging.trailstatus.workers.dev
node scripts/update-trail-status.js # manually run the status scraper (needs CLOUDFLARE_API_TOKEN env var)
node scripts/extract-trail-stats.js --local   # re-parse saved HTML in dump/ offline (no network)
npm run check:parking                        # verify hand-corrected parking hasn't been reverted (exit 1 on drift)
node scripts/check-manual-parking.js --update # deliberately accept new hand-corrected values
```

`staging` and `prod` are Cloudflare **deploy targets**, not git branches — they
are selected by the `--env` flag, not by which branch is checked out. Both share
the same KV namespace, so staging reads production's status data. There is no
deploy-on-push CI: pushing to `main` deploys nothing, and every deploy is manual.

The Cloudflare API token lives only in the GitHub Actions secret `CLOUDFLARE_API_TOKEN`; the cron injects it at runtime. It is not stored locally, so to run the scraper by hand pass it inline: `CLOUDFLARE_API_TOKEN=… node scripts/update-trail-status.js`.

That token is only needed for the **scraper's KV writes**. `wrangler` itself is separately authenticated with a stored OAuth session (`wrangler whoami` to check), so `wrangler dev` and `wrangler deploy` work locally without it.

## Architecture

Two halves, connected by Cloudflare KV (namespace binding `TRAIL_CACHE`, id `84a3ba80...`):

1. **Scraper (write side):** `.github/workflows/trail-status-cron.yml` runs every 5 minutes and executes `scripts/update-trail-status.js` — a plain Node script that fetches each Trailforks page with browser-like headers, regex-parses status/city/LTA out of the tag-stripped HTML, and writes two KV values via the Cloudflare REST API: `trail_statuses_1` and `trail_statuses_2` (the source list is split in half to stay under time limits). Each value is `{ updatedAt, statuses: { [key]: { status, updated, detail, city?, lta? } } }`. City/LTA from the previous run are preserved when a fetch doesn't return them.

2. **Site (read side):** the worker serves static assets from `public/` and handles `GET /api/status`, which merges the two KV parts. (On a cold/empty KV it falls back to scraping live from the Worker — but since Trailforks blocks Cloudflare, expect that fallback to return "Unavailable" statuses.) `public/script.js` fetches `/api/status`, matches results to the `TRAILS` array from `public/trails.js` by `key`, and renders rows grouped into city sections (`SECTION_ORDER`). `LTA_LINKS` in `script.js` maps trail-association names to clickable URLs.

### Deployment (Worker, not Pages)

The live site is the Cloudflare **Worker** `ntx` (`wrangler.toml`: `main = worker.js`, `public/` as assets, plus an `ntx-staging` env), deployed with `npx wrangler deploy`. (There used to be a `public/.assetsignore` excluding `_worker.js` from the asset upload; both are gone.)

**Always pair a deploy with a commit + push to GitHub.** A production deploy (`npm run deploy`) ships whatever is in the working tree, so the repo must reflect exactly what's live. Whenever you deploy, also `git add`/`commit` the deployed changes and `git push` to the current branch's GitHub remote — do not deploy and leave the commit for later. (This is a workflow rule for Claude, not something the `deploy` npm script does automatically.)

The project started on Cloudflare Pages, but the Pages project no longer exists (verified via API 2026-07-15). The last Pages leftover is gone too: `npm run dev` is now plain `wrangler dev`, so local dev and production both run `worker.js`.

### Legacy

Scraping originally ran as a scheduled Cloudflare Worker (`cron-worker/`), but was moved to GitHub Actions because **Trailforks started blocking requests coming from Cloudflare** — do not move scraping back onto a Worker. The old cron worker was deleted from Cloudflare and removed from the repo on 2026-07-15. `research/` is a saved copy of dorba.org used when reverse-engineering trail sources.

## Trail data: one canonical source

`public/trails.js` is the **single source of truth** for every trail. It exports `TRAILS` and is imported by all three consumers:

- `worker.js` — `import { allSources }` (cold-start scrape only)
- `scripts/update-trail-status.js` — `import { sourcesForBatch }` (the cron scraper)
- `public/script.js` — `import { TRAILS as trails }` (frontend rendering)

**Adding or changing a trail is one entry in `public/trails.js`.** Add the org to `LTA_LINKS` in `public/script.js` too if it is a new one. The `batch: 1 | 2` field decides which staggered cron job scrapes it; `type: "region" | "trail"` selects the parse strategy. `key` is the join key against KV.

Five optional fields are **hand-maintained and never regenerated** by a sweep, so they are easy to overlook:

| field | when to use it | count |
| --- | --- | --- |
| `difficulty` | Override the computed band when Trailforks' ratings are wrong. `"Beginner" \| "Intermediate" \| "Expert"`. | 12 |
| `statsUrl` | When the trail-listing page isn't `url + "/trails/"` — e.g. a single-trail entry that still has a region listing. `trinity-track` (Willow Park) and `western-heritage-park`. | 2 |
| `parkingSource` | `"manual"` — the parking coords are **not reproducible from a scrape**, either because Trailforks' pin is wrong or because it serves no pin at all. A sweep must never overwrite these. | 10 |
| `parking` | An array of lots, for a trailhead with more than one. Replaces `parkingLat`/`parkingLng`; implies `parkingSource: "manual"`. `northshore`. | 1 |
| `parkingPlusCode` | An Open Location Code used as the directions destination when Google misroutes the raw coordinate. `cedar-hill-state-park`; `northshore`'s MADD Shelter carries the per-lot `plusCode` equivalent. | 2 |

Counts are current as of the last edit — `npm run check:parking` reports the
`parkingSource` figure, and the others are a one-line filter over `TRAILS`.

### `parkingSource: "manual"` — do not overwrite these

`difficulty` and `statsUrl` are safe because the stats sweep regenerates
`trail-stats.js`, not `trails.js`. **Parking is different**: `extract-parking.js`
emits coordinates for *every* trail, and those get spliced into `trails.js`
by hand from the run log. A trailhead corrected by hand will be handed back to
you as the original wrong value on the next sweep, and splicing the whole batch
in will silently revert the fix.

`parkingSource: "manual"` is the marker that prevents that, and it is now
enforced from both ends rather than relying on anyone remembering:

1. **`extract-parking.js` never emits these trailheads.** It partitions on the
   flag before fetching, so a flagged trailhead is not even requested. It appears
   in a `skipped` list carrying a reason and *no coordinates*, so there is
   nothing to paste in by accident.
2. **It also holds back any trailhead whose scrape would blank good data.** A
   page that yields no pin for an entry that already has coordinates lands in
   `blanked`, not `results` — the quiet version of the same hazard, where the
   splice writes an empty list over a correct value rather than a wrong one.
   This catches a pin disappearing upstream *before* anyone thinks to flag it.
   Output is `{ scraped, spliceable, skipped, blanked, results }`; **`results`
   is the only splice-able array, and is safe to paste wholesale.**
3. **`npm run check:parking` fails if a flagged entry drifts.** Values are
   pinned in `scripts/manual-parking.lock.json`. Run it after any splice. It
   catches both the coordinates changing and the `parkingSource` flag going
   missing — the latter being what a wholesale paste actually does.

Changing a hand-corrected value on purpose means
`node scripts/check-manual-parking.js --update`, which rewrites the lock as its
own reviewable diff instead of letting the change ride along inside a sweep.

The check verifies **stability, not correctness** — it knows a value changed, not
whether it is right. Correctness still comes from the real world.

A `parking` array or a `parkingPlusCode` always implies the flag, since
`extract-parking.js` can only ever emit a single bare coordinate per trailhead.

The case that motivated the field: Trailforks' pin for **Marion Sansom** was
8.12 km from the park, stale rather than merely imprecise. Since `markerLatLng()`
prefers parking coords over `lat`/`lng`, that put the *map marker* in the wrong
place too, not just the directions link. It was corrected by hand to
2501 Roberts Cut Off Rd, Fort Worth (commit `fd3df43`).

Trailforks is the only parking source, so **staleness upstream is invisible from
inside the repo** — a wrong pin looks exactly like a right one. Corrections come
from spotting them in the real world; the field exists so a correction sticks.

Note `lat`/`lng` cannot be used to check parking coords. They are not surveyed
trailhead positions — commit `1ff5e21` geocoded them from each trail's `city`
field via Nominatim, and about 17 of 58 are city-center approximations. Four of
the `city` values ("North Dallas Region", "Far North Region", "South Dallas
Region", "East Dallas Region", "Mid-Cities Region") aren't real places, so those
fell back to a metro centroid: `katie-jackson-park-dorba`'s `lat`/`lng` is 0.05 km
from downtown Dallas, 25.7 km from its parking pin — and there the *parking* is
the correct one. 23 of 58 pairs are >2 km apart, so the comparison flags 40% of
the dataset without indicating which side is wrong.

This replaced an earlier arrangement where the list was copy-pasted across four files. `public/_worker.js` no longer exists — local dev and production both run `worker.js` now.

## Frontend features

All in `public/script.js` + `public/index.html`, no framework:

- **List / Map toggle** (`[data-view]`). Map view is Leaflet over OpenStreetMap, vendored in `public/vendor/leaflet/` — not a CDN. Markers are `L.divIcon`s coloured by status, built in `renderMap()`; `ensureMap()` lazily initialises the map on first switch to the map view.
- **Parking** — markers are placed at the trailhead's parking lot when known. `parkingLots(trail)` is the one accessor: it normalises both data shapes into an array of `{ name, lat, lng }`, so nothing downstream has to branch. `markerLatLng()` pins the lot flagged `primary` (else the first) and falls back to `lat`/`lng`; `parkingDirectionsUrl(lot)` takes a lot (not a trail) and builds the Google Maps link — from `lot.plusCode` when it has one, else the coordinates. Google sometimes snaps a raw coordinate to the nearest road instead of the lot (Northshore's MADD Shelter misrouted that way), so a lot may carry a full Open Location Code that Google resolves exactly. **It must stay percent-encoded**: an unencoded `+` reads as a space in the query string and the destination silently fails to resolve. On a single-lot trailhead the field is `parkingPlusCode` at the trail level; `parkingLots()` folds it into the lot so both shapes behave alike. A plus code changes the directions link only — the marker always uses `lat`/`lng`, so move the coordinates too if the pin itself is wrong. All 58 trailheads currently have parking coordinates — 48 whose values a sweep can reproduce, and 10 flagged `parkingSource: "manual"` that it cannot; see the splice guard below for why each is flagged.
- **Trailheads with more than one lot** use `parking: [{ name, lat, lng }, …]` in `trails.js` instead of `parkingLat`/`parkingLng` — never both. One entry currently does: `northshore` has 3. List view renders one numbered button per lot (`🅿️1 🅿️2 🅿️3`, name on the `title`/`aria-label`); the map popup spells the names out. **Array order is the button numbering, so never reorder it to move the marker** — set `primary: true` on the one lot the marker belongs at instead. Northshore needs this: its lots are listed in the order a rider would consider them, but lot 1 is 3.4 km from the trail and only lot 2 is on it (0.06 km), so the marker is pinned to lot 2 while the buttons keep the given order. **The number is deliberate** — lot names vary in length and the last grid track is a fixed 280px shared with the Trailforks link, so a name-labelled button would overflow it. A single-lot trailhead still renders the original `🅿️ Directions` button, unchanged.
- **Staging marker** — `script.js` appends "STAGING" to the `h1` and page title when the hostname contains `staging`, so the two environments are distinguishable at a glance.
- **Favorites** — starred trails persist in `localStorage` under `ntxmtb-favorites` and render in a "Favorites" section above the city groups.
- **Collapsible sections** — clicking a section heading collapses it; state lives in `collapsedSections` (favorites uses the sentinel key `__favorites__`).
- **Filters** — region (`[data-filter]`), status (`[data-status-filter]`: All / Open+Caution / Closed), Avg Difficulty (`[data-difficulty]`: All / Beginner / Intermediate / Expert), and a free-text search over trail and city names. `getVisibleTrails()` applies all four, and both views render from it.
- **Persistence** — the four filters *and the view* round-trip through `localStorage` under `ntxmtb-filters`, restored by `restoreFilters()` before the first render. Restored values are validated against the controls that still exist, so a renamed region or retired band can't strand someone on an empty list; a corrupt entry falls back to defaults rather than throwing during module init. Saving happens in the click handlers, **not** in `setView()`, so a visit with no interaction writes nothing.
- **Default view** — `DEFAULT_VIEW` is `"map"`, but it is the **first-visit** default only; a saved view wins. `index.html`'s initial markup (active button, `hidden` classes) must match `DEFAULT_VIEW` or first-time visitors get a flash of the wrong view.
- **Info and Donate modals**, closed by backdrop click or Escape.

### The list-view grid has a footgun

Columns are `Trail Name | Status | Updated | City | Avg Difficulty | Trail Org | Trail Info and Directions`. The heading row and the data rows are **two separate CSS grids** that only line up if every track resolves identically — so the template must contain **no content-sized (`auto` / `max-content`) track**. The last track once was `auto`, sizing to the word "DIRECTIONS" in the heading but to two buttons in a row; the difference was redistributed across the `fr` tracks and every column drifted. It is a fixed `280px` now.

For the same reason, heading nudges are addressed as explicit `nth-child(n)` positions rather than `:last-child` / `:nth-last-child(2)`, which silently re-target themselves whenever a column is added.

## Trail stats (difficulty rating, mileage, climb)

`public/trail-stats.js` exports `TRAIL_STATS`, keyed by trail `key`, with four aggregates per trailhead derived from its sub-trails. **It is generated — do not edit by hand** (see maintenance tooling below).

| field | meaning |
| --- | --- |
| `avgDifficulty` | mean difficulty over *rated* sub-trails: white .5, green 1, blue 2, black 3, dbl black 3.5, pro 3.5 |
| `totalMiles` | summed sub-trail distance, 1dp |
| `totalClimbFt` | summed climb, feet |
| `ftPerMile` | `totalClimbFt / totalMiles`, nearest foot |
| `trailCount` / `ratedCount` | sub-trails found / of those, ones with a difficulty |

### Displayed difficulty: bands, and hand-set overrides

**`avgDifficulty` is never shown.** It stays in the data for re-banding and
debugging, but the UI shows only a band name — "Intermediate", not "Intermediate 1.8".

`difficultyLabel(trail)` resolves it, and this is the important part:

1. if the `trails.js` entry has a **`difficulty`** field, that wins outright;
2. otherwise the band comes from `DIFFICULTY_BANDS` — Beginner ≤1.4, Intermediate ≤2.2, Expert above;
3. otherwise `null` (no stats and no override).

**Trailforks rates a number of these parks wrongly, so 12 of 58 currently carry a
manual `difficulty` override.** Expect the displayed band to disagree with
`avgDifficulty` — that is the system working, not a bug. Overrides live in
`trails.js`, which the sweep never regenerates, so they survive a re-scrape;
`trail-stats.js` is regenerated and must never hold them.

Current spread: **21 Beginner / 28 Intermediate / 9 Expert**.

**The bands and the Avg Difficulty filter's options must stay in step** — a band
with no matching option is unreachable, and an option with no band is permanently
empty. (An earlier four-band scheme had exactly this problem: "Expert" matched
nothing and two "Advanced" parks were unreachable.) The filter reads
`difficultyLabel()` too, so an overridden trailhead filters where it reads.

Unrated sub-trails are excluded from `avgDifficulty` but still count toward distance
and climb. Trailheads whose Trailforks page lists no sub-trails are **omitted from
`TRAIL_STATS` entirely** rather than stored as zeroes — `statsRows()` returns `null`
for them, so any new consumer must handle a missing key. One trailhead is in this
state: `erwin-park-skill-park`, which has an override so it still shows a band, but
has no stats panel.

### Where stats appear

Four places: the **Avg Difficulty column** in list view (band name only), a **hover
tooltip** on the trail name (desktop), a **stats block in the map popup**, and the
**marker hover** (name + miles + climb, no status).

**Both hovers must feel instant.** Two traps, both already worked around:
- The list tooltip is anchored to `.trail-row`, *not* `.trail-name-cell`, because that cell sets `overflow: hidden` and would clip it. It uses `transition: opacity 0s`.
- Map markers use Leaflet's `bindTooltip`, *not* the native `title` attribute — browsers delay `title` tooltips about a second.

**Touch devices have no hover**, so at ≤760px each row grows an **ⓘ button**
(`.stats-btn`) that toggles the same panel in-flow; desktop is untouched. Three
things about it that are easy to break:
- The button is derived from `statsTipHtml()`'s return value, so a trailhead with no stats offers no toggle.
- Open state lives in the `openStats` Set, **not** in the DOM: a favourite toggle calls `render()` and rebuilds every row, which would otherwise wipe it.
- A favourited trail **renders twice** (Favorites block *and* its city section), so the handler updates every `.trail-row[data-key=…]`. This is also why there is no `aria-controls` — the id would be duplicated.

## Maintenance tooling (GitHub Actions only)

`scripts/extract-parking.js` and `scripts/extract-trail-stats.js` are manual `workflow_dispatch` jobs, not part of the cron. **They only work from a GitHub Actions runner** — Trailforks serves a Cloudflare captcha 403 to everything else, including local `curl` with the scraper's exact headers. Results come back through the run log and an uploaded artifact.

Because GitHub only registers `workflow_dispatch` from the **default branch**, such tooling has to land on `main` before it can be dispatched at all; a feature branch is not enough.

**`extract-parking.js` scrapes only the trailheads without `parkingSource: "manual"`** (48 of 58 today) and reports the rest under `skipped`. Anything that came back pin-less despite having stored coordinates is held in `blanked`. Splice the `results` array only — it is safe to paste wholesale — then run `npm run check:parking`. See "do not overwrite these" above.

**10 of 58 are flagged**, for two different reasons. Three were corrected by hand against a wrong Trailforks pin (`marion-sansom` 8.12 km out, `cedar-hill-state-park` 846 m out, plus `northshore`'s three lots). The other seven are entries Trailforks serves **no pin for at all** — verified in run `32409476860` — so a sweep would blank them: the three skill parks (`erwin-park-skill-park`, `creekside-park-skillpark`, `katie-jackson-park-skillpark`) inherit their parent region's lot and never had their own pin, and `trinity-track`, `western-heritage-park`, `the-pit` and `the-woods-at-dunlop-park` have lost theirs upstream.

`extract-trail-stats.js` modes:

```bash
--dump <key…>   # fetch one or more regions, save raw HTML to dump/ + print a recon summary
--all           # sweep every /region/ trailhead and emit dump/trail-stats.js
--local [key…]  # re-parse already-saved HTML with no network — use this to iterate on the parser
```

Three things about the Trailforks trail table that are easy to get wrong:

1. **Distance must come from the `data-v` attribute (metres), not the rendered text.** The table rounds to whole miles, so "3 miles" is really 2.906 mi; summing displayed values overstated one park by 12%.
2. **Difficulty must be keyed off `data-sort`, not the CSS class.** Black and double black are both `class="dicon_small dblack"` and differ only by `data-sort` 7 vs 8.
3. **The listing paginates at 100 trails** via `?page=N`. Cameron Park has 127 and silently truncated before pagination was followed.
4. **Column order is not fixed.** Most listings have 7 columns, but some (Willow Park) insert a "riding area" column. `parseTrailRows()` resolves columns from the **header row's labels**, and finds the status/difficulty icons by CSS class anywhere in the row. Reading by fixed position produced 0 miles and *negative* climb on the 8-column page.

Note `--local` only ever sees the **first page** of a paginated listing, since only page 1 is written to `dump/`. It under-reports Cameron Park (100 vs the true 127); trust `--all` for counts.

## Verifying frontend changes

There is no test framework, but `dump/` (gitignored) holds jsdom harnesses that boot `public/script.js` with Leaflet and `fetch` stubbed: `verify-column.mjs` (grid/cell alignment), `verify-grid.mjs` (CSS-as-text: identical templates, no content-sized tracks), `verify-filter.mjs` (filter counts vs expected bands), `verify-links.mjs`, `verify-default-view.mjs`, `verify-stats-toggle.mjs` (mobile ⓘ, including that open panels survive the `render()` a star tap forces), and `verify-filter-persist.mjs` (boots the page twice against one shared `localStorage` to simulate a reload).

**What they cannot do:** the harnesses construct `JSDOM` without `resources: "usable"`, so `styles.css` is never loaded — no computed styles, no media-query evaluation, no layout, no `:hover`. Anything visual still needs a real browser, and headless Chromium can't be installed here without sudo.

Climb has no `data-v` and is read from text; it is occasionally missing upstream (Big Cedar's Pitbull has an empty climb cell) and counts as 0.
