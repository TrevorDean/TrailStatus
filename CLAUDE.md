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

This replaced an earlier arrangement where the list was copy-pasted across four files. `public/_worker.js` no longer exists — local dev and production both run `worker.js` now.

## Frontend features

All in `public/script.js` + `public/index.html`, no framework:

- **List / Map toggle** (`[data-view]`). Map view is Leaflet over OpenStreetMap, vendored in `public/vendor/leaflet/` — not a CDN. Markers are `L.divIcon`s coloured by status, built in `renderMap()`; `ensureMap()` lazily initialises the map on first switch to the map view. A trailhead only appears on the map if its `trails.js` entry has `lat`/`lng`.
- **Favorites** — starred trails persist in `localStorage` under `ntxmtb-favorites` and render in a "Favorites" section above the city groups.
- **Collapsible sections** — clicking a section heading collapses it; state lives in `collapsedSections` (favorites uses the sentinel key `__favorites__`).
- **Filters** — region (`[data-filter]`), status (`[data-status-filter]`: All / Open+Caution / Closed), and a free-text search over trail and city names. `getVisibleTrails()` applies all three, and both views render from it.
- **Info and Donate modals**, closed by backdrop click or Escape.

## Trail stats (difficulty rating, mileage, climb)

`public/trail-stats.js` exports `TRAIL_STATS`, keyed by trail `key`, with four aggregates per trailhead derived from its sub-trails. **It is generated — do not edit by hand** (see maintenance tooling below).

| field | meaning |
| --- | --- |
| `avgDifficulty` | mean difficulty over *rated* sub-trails: white .5, green 1, blue 2, black 3, dbl black 3.5, pro 3.5 |
| `totalMiles` | summed sub-trail distance, 1dp |
| `totalClimbFt` | summed climb, feet |
| `ftPerMile` | `totalClimbFt / totalMiles`, nearest foot |
| `trailCount` / `ratedCount` | sub-trails found / of those, ones with a difficulty |

Unrated sub-trails are excluded from `avgDifficulty` but still count toward distance and climb. Trailheads whose Trailforks page lists no sub-trails are **omitted from `TRAIL_STATS` entirely** rather than stored as zeroes — `statsRows()` returns `null` for them and no tooltip is rendered, so any new consumer must handle a missing key.

Shown in three places: a hover tooltip on the trail name in list view, a stats block in the map popup, and (name only) an instant marker tooltip.

**Both hovers must feel instant.** Two traps here, both already worked around — keep them in mind if you touch this:
- The list tooltip is anchored to `.trail-row`, *not* `.trail-name-cell`, because that cell sets `overflow: hidden` and would clip it. It uses `transition: opacity 0s`.
- Map markers use Leaflet's `bindTooltip`, *not* the native `title` attribute — browsers delay `title` tooltips about a second.

## Maintenance tooling (GitHub Actions only)

`scripts/extract-parking.js` and `scripts/extract-trail-stats.js` are manual `workflow_dispatch` jobs, not part of the cron. **They only work from a GitHub Actions runner** — Trailforks serves a Cloudflare captcha 403 to everything else, including local `curl` with the scraper's exact headers. Results come back through the run log and an uploaded artifact.

Because GitHub only registers `workflow_dispatch` from the **default branch**, such tooling has to land on `main` before it can be dispatched at all; a feature branch is not enough.

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

Climb has no `data-v` and is read from text; it is occasionally missing upstream (Big Cedar's Pitbull has an empty climb cell) and counts as 0.
