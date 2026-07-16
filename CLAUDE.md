# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

North Texas MTB Trail Status — a single-page site showing open/closed status for ~55 mountain bike trails. The live site is https://ntx.trailstatus.workers.dev/ — there is no custom domain (despite what TODO.md's completed items suggest). Status data is scraped from Trailforks trail/region pages by regex-parsing their HTML (there is no Trailforks API in use). Everything runs on Cloudflare; there is no build step, no framework, no tests, and no linter — plain JS, HTML, and CSS.

## Commands

```bash
npm run dev        # wrangler pages dev public --port 8788 --remote  (local dev; site at localhost:8788, API at /api/status)
npm run deploy     # wrangler deploy — deploy the live site (Worker "ntx")
npx wrangler deploy --env staging   # deploy to ntx-staging.trailstatus.workers.dev
node scripts/update-trail-status.js # manually run the status scraper (needs CLOUDFLARE_API_TOKEN env var)
```

The Cloudflare API token lives in the GitHub Actions secret `CLOUDFLARE_API_TOKEN` (and locally in `.claude/settings.local.json` allow rules).

## Architecture

Two halves, connected by Cloudflare KV (namespace binding `TRAIL_CACHE`, id `84a3ba80...`):

1. **Scraper (write side):** `.github/workflows/trail-status-cron.yml` runs every 5 minutes and executes `scripts/update-trail-status.js` — a plain Node script that fetches each Trailforks page with browser-like headers, regex-parses status/city/LTA out of the tag-stripped HTML, and writes two KV values via the Cloudflare REST API: `trail_statuses_1` and `trail_statuses_2` (the source list is split in half to stay under time limits). Each value is `{ updatedAt, statuses: { [key]: { status, updated, detail, city?, lta? } } }`. City/LTA from the previous run are preserved when a fetch doesn't return them.

2. **Site (read side):** the worker serves static assets from `public/` and handles `GET /api/status`, which merges the two KV parts (falling back to scraping live on a cold/empty KV). `public/script.js` fetches `/api/status`, matches results to its own `trails` array by `key`, and renders cards grouped into city sections (`SECTION_ORDER`: Dallas, Far North Region, Fort Worth, Tyler, Waco, Weatherford). `LTA_LINKS` in `script.js` maps trail-association names to clickable URLs.

### Deployment (Worker, not Pages)

The live site is the Cloudflare **Worker** `ntx` (`wrangler.toml`: `main = worker.js`, `public/` as assets, plus an `ntx-staging` env), deployed with `npx wrangler deploy`. `public/.assetsignore` excludes `_worker.js` from that asset upload.

The project started on Cloudflare Pages, but the Pages project no longer exists (verified via API 2026-07-15). One Pages leftover remains: `npm run dev` still uses `wrangler pages dev` for local development — meaning **local dev runs `public/_worker.js` while production runs `worker.js`**.

### Legacy

Scraping originally ran as a scheduled Cloudflare Worker (`cron-worker/`) before the GitHub Actions migration; it was deleted from Cloudflare and removed from the repo on 2026-07-15. `research/` is a saved copy of dorba.org used when reverse-engineering trail sources.

## The duplication trap (most important thing to know)

The trail source list and the scraping/parsing functions are copy-pasted across **four files** that are not imported from a shared module and have already drifted from each other:

- `worker.js` and `public/_worker.js` — full list with `name` fields, single `sources` array
- `scripts/update-trail-status.js` — nameless entries split into `SOURCES_1` / `SOURCES_2`
- `public/script.js` — the frontend `trails` array with display names, cities, LTAs, and links

**Adding or changing a trail means editing `scripts/update-trail-status.js` (the live scraper), `worker.js` (the deployed site worker), `public/_worker.js` (its local-dev twin), and `public/script.js` (the frontend).** The `key` field is the join key everywhere — it must match exactly across files. A trail missing from the frontend `trails` array will be scraped but never displayed; a trail missing from the scraper shows as no status.

Parser regexes have also drifted: `scripts/update-trail-status.js` has extra fallback patterns in `parseRegionStatus` that the worker copies lack. When fixing a parsing bug, check whether the fix belongs in all copies.
