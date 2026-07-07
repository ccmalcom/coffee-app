# Coffee App — MVP Design

**Date:** 2026-07-07
**Status:** Approved design (pending implementation plan)
**Sibling project:** MyLibrary (`coding-projects/mylibrary`) — architectural reference for the recommender, taste profile, cold-start gating, and locked-decisions format.

## Vision

A personal, AI-powered espresso companion with three subsystems sharing one coffee library:

1. **Coffee Log** — log every specialty coffee bought, rate it, review it.
2. **Grind Dial-In Assistant** — log shots per grinder+machine+coffee; get grind suggestions calibrated exclusively from the user's own shot history.
3. **Discovery Engine** — automatically surface new non-flavored-but-flavor-forward coffees worth buying, scored against a personal taste profile.

Ratings feed the taste profile; the taste profile drives Discovery — the same rating → profile → recommend pipeline as MyLibrary.

**Calibration example (parsing, not taste):** Tinker's Colombia "Julio Madrid Caturra Nitro" (Nitro Washed; watermelon bubble gum, strawberry yogurt candy, mango creamsicle, pink lemonade — all from anaerobic fermentation, zero additives) is the worked example of what "non-flavored but flavor-forward" means: wild notes earned through processing, not additives. It's a permanent *parser* test fixture (must extract process=nitro-washed, flavor_origin=process). It is one data point of taste, not the taste profile — what Discovery ranks highly is learned from the full rating history and directive, and evolves as they do.

## Locked decisions (do not relitigate)

1. **The LLM is not the recommender.** Discovery is two-stage: deterministic retrieval/filtering of real catalog candidates, then Claude reranks and explains. Every surfaced candidate is a real catalog row with a live listing URL — no invented coffees survive.
2. **Grind suggestions are personally calibrated only.** Numbers come exclusively from the user's own logged shots on their own gear. Generic espresso heuristics ("ran fast → grind finer") are never used as suggestion rules. Domain knowledge informs *vocabulary and parsing*, never suggestion math.
3. **`coffees` and `roasters` are a shared catalog** (no user_id); everything personal lives in per-user tables. The catalog is a growing communal knowledge base.
4. **No bulk import.** The library is seeded one coffee at a time (paste, scan, or Discovery-accept) from day one.
5. **Fully TypeScript / Next.js stack.** No Python backend.
6. **Espresso-only MVP.** No drip/pourover flows; `shots.method` defaults to `espresso` so other methods are additive later.
7. **User goals are directive-driven, not hardcoded.** "Flavor-forward interestingness" is Chase's directive, not app behavior. Onboarding captures per-user goals that steer all scoring surfaces (mirrors MyLibrary's `UserDirective`).

## Subsystems

### Coffee Log

- Add a coffee by: pasting listing text/URL, scanning the bag's barcode, or snapping a photo of the bag. An LLM extracts structured attributes (schema below) with a parse-confidence score.
- **Barcode flow:** cross-browser JS barcode library (iOS Safari has no native Barcode Detection API). Lookup order: (1) shared catalog — instant rebuy detection ("you've had this, 4★"); (2) open product databases (spotty for specialty roasters); (3) fallback to photo/paste + LLM extraction. Every logged coffee saves its barcode, so the catalog's coverage compounds.
- User rates (1–5) and reviews coffees. Reviews are direct taste-profile signal, weighted above metadata inference (MyLibrary decision #4 carried over).

### Taste profile (first-class feature)

- A viewable, human-readable profile in the MyLibrary reader-profile mold: flavor-territory clusters the user gravitates to (e.g. fruit-punch fermenty vs. floral washed vs. funky co-ferment), preferred processes, with evidence cited from ratings ("rated 3 of 3 anaerobic naturals 4★+").
- Rebuilt as ratings accumulate; staleness tracked vs. recent ratings.
- Drives Discovery scoring AND is readable on `/profile`. (Wrapped-style reveal: post-MVP.)

### Grind Dial-In Assistant

- Equipment registered once (`equipment`: grinders and machines). Shots reference coffee + grinder + machine.
- Shot fields: dose_g, yield_g, time_s, grind_setting (free text — grinders vary), structured outcome tags (sour / bitter / weak / harsh / balanced / excellent + optional note), shot rating, brewed_at.
- **Per-combo unlock:** suggestions fire only after **≥5 logged shots** on a grinder+coffee combo. Below that: log-only.
- **Mechanics:** deterministic interpolation over the user's own shots for that combo (grind setting vs. time/yield/outcome), proposing next setting + expected time, with evidence shown ("setting 12 → 22s, sour ×3; setting 10 → 28s, balanced"). The LLM only phrases explanations; it never invents numbers.
- **New-bag starting point:** once a grinder has **≥15 total shots**, a weaker starting-point estimate for a new coffee, derived from the user's history with similar coffees (same process/roast level) on that grinder. Labeled as an estimate.
- Both thresholds are named tunable constants.

### Discovery Engine

- **Sourcing (automated from day one):** Vercel Cron triggers chunked runs (one roaster per invocation).
  - `roaster_check`: fetch a watched roaster's offerings page (Bright Data JS SDK), LLM-parse new listings into the catalog schema, dedupe, assign parse_confidence.
  - `web_search`: queries derived from the taste profile's flavor clusters (e.g. "anaerobic nitro washed Colombia"); results parse identically; unknown roasters are created unwatched (`added_via: discovery`) and can be promoted to the watched list.
- **Stage 1 — deterministic retrieval:** catalog coffees not in the user's library, hard-filtered (`flavor_origin ≠ added` per Chase's directive; listing still live), scored cheaply on process-preference weights + tasting-note tag overlap with the profile.
- **Stage 2 — LLM rerank:** top ~20 candidates + taste profile + review evidence + directive → Claude reranks and writes per-coffee explanations.
- **Cold start:** below 5 rated coffees (named tunable constant, like the grind thresholds), Discovery still ingests to the catalog but scores against the user's stated onboarding directive instead of rating history — clearly labeled as directive-based. It never pretends to be personalized before it is.

### Onboarding goal directive

- Setup asks the user's goals (selectable options — "discover wild process-driven flavors," "find reliable daily drinkers," "explore specific origins" — plus free text). Stored per-user; steers Stage-1 weights/filters, Stage-2 rerank prompt, and profile build. Editable from `/profile`.
- Whether `flavor_origin = added` is a hard exclude or just a signal is directive-driven (Chase's: exclude).

## Data model

Supabase Postgres. **Shared catalog** tables have no user_id; **per-user** tables all carry user_id so multi-user later is additive, not a migration.

### Shared catalog

- **`roasters`** — name, website, location, `watched` (bool), `added_via` (manual | discovery).
- **`coffees`** — roaster_id, name, origin country/region, producer, variety, `process` (washed / natural / honey / anaerobic / carbonic-maceration / nitro-washed / co-ferment / thermal-shock / …), process_detail, `flavor_origin` (process | added | unknown), `tasting_notes` (normalized tag array), raw_listing_text, listing_url, barcode, price/size, `parse_confidence` (HIGH / MEDIUM / LOW). Deduped on ingest: barcode → listing URL → fuzzy roaster+name.

### Per-user

- **`library_entries`** — user_id, coffee_id, `status` (candidate → wishlist → owned → finished), rating (1–5), review, Discovery score + explanation, discovered_in_run_id, acquired_at.
- **`equipment`** — kind (grinder | machine), brand, model, nickname, notes.
- **`shots`** — coffee_id, grinder_id, machine_id, method (default `espresso`), dose_g, yield_g, time_s, grind_setting, outcome tags, note, rating, brewed_at.
- **`taste_profile`** — versioned row: built_at, profile JSON (flavor clusters, process preferences, evidence citations), staleness flag.
- **`directives`** — the onboarding goal directive (selected goals + free text), edited_at.
- **`discovery_runs`** — type (roaster_check | web_search), source, counts, errors, started_at.

### Known gap (explicit)

**Catalog edit moderation:** catalog rows are shared, so a user edit to catalog facts (e.g. fixing a wrong process tag) applies globally. Acceptable single-user; becomes a moderation/versioning question when multi-user arrives. Flagged deliberately — not a schema change, a policy one.

## Domain knowledge foundation

A dedicated build-phase step: an agent researches and synthesizes espresso/coffee domain knowledge into a versioned, human-reviewable markdown corpus (`knowledge/` in the repo), then ingests it as ground truth:

- **Process taxonomy** — canonical definitions + typical flavor implications + how roasters phrase each process on listings. Seeds the `process` enum and teaches the parser to map messy listing language onto it.
- **Tasting-note vocabulary** — normalization map ("watermelon bubble gum" → fruit/candied cluster). Seeds the flavor-territory clusters the taste profile builds on.
- **Espresso fundamentals** — extraction vocabulary (ratios, channeling, what sour/bitter/harsh typically indicates), used for outcome-tag definitions and explanation phrasing only. Never suggestion rules (locked decision #2).

Re-runnable: re-research → diff → re-ingest, so coffee knowledge improves without code changes.

## UX (mobile-first; desktop is the same app, wider)

**Hero flow 1 — at the machine (shot logging):** open app → "Log shot" → form pre-filled from the last shot on that grinder+coffee combo → change what changed → save. Suggestion card above the form once unlocked. Target: under 15 seconds, one hand.

**Hero flow 2 — in the store (bag evaluation):** scan barcode → instant verdict ("you've had this — 4★, 'insane strawberry'" or "new — snap the bag / paste the listing") → LLM parse → scored against profile + directive on the spot, with explanation.

**Screens:** Library (owned/wishlist/finished) · Discovery feed (scored candidates + explanations; accept → wishlist; dismiss is inert in MVP) · Coffee detail (catalog facts + rating/review + shot history + dial-in state) · Profile (taste profile + evidence + directive editor) · Equipment. PWA-installable.

## Stack

- **Next.js (App Router) on Vercel** — route handlers + server actions as the API; Vercel Cron for Discovery runs (chunked to fit serverless execution limits).
- **Supabase** — Postgres + auth (single login now; invite machinery later).
- **Drizzle ORM + drizzle-kit** migrations.
- **Anthropic TypeScript SDK** — structured outputs for all parsing/scoring/rerank.
- **Bright Data JS SDK** — roaster page fetching + web search.
- **Cross-browser JS barcode library** (e.g. zxing-based) for scanning.

## Dependency security policy (non-negotiable)

Lesson from MyLibrary, which was scaffolded on a Next.js version with a major vulnerability:

- Scaffold on the **current latest stable** Next.js and dependencies — verify versions at build time, never assume from training data.
- **`npm audit` runs after every `npm install` / `npm update`, always** — in the implementation plan this is an explicit step after each dependency change, and it belongs in CI.
- Vulnerabilities with a non-breaking fix are fixed immediately and automatically (`npm audit fix`).
- **Never introduce a breaking change to resolve a vulnerability without a plan** — no `npm audit fix --force`; a breaking upgrade gets its own written mini-plan and explicit approval first.

## Error handling

- LLM extractions validate against a zod schema; one retry; failures land as LOW parse_confidence in a review queue — never silently dropped.
- Scrape failures are logged per `discovery_run` with errors visible.
- Dedupe conflicts prefer the higher-parse-confidence row.

## Testing (Vitest)

- Listing parser: fixture listings → expected schema. The Julio Madrid Caturra Nitro listing is a permanent calibration fixture (must parse as nitro-washed, flavor_origin=process, fruit/candied clusters).
- Catalog dedupe (barcode / URL / fuzzy match paths).
- Stage-1 scoring (process weights + tag overlap, directive-driven filters).
- Grind interpolation (suggestion math from synthetic shot corpora; cold-start gating at the thresholds).

## Out of scope (MVP)

Multi-user/invites/admin · Wrapped-style profile reveal · dismiss-signal training in Discovery · drip/pourover methods · price tracking/alerts · catalog moderation tooling · spend tracking.

## Open items for the implementation plan

- Choice of specific barcode library and open product database.
- Exact cron cadence + per-run chunking strategy vs. Vercel plan limits.
- Whether web_search sourcing uses Bright Data SERP or Discover API.
- Auth setup details (Supabase, single-user bootstrap).
