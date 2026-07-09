# Plan 3 — Taste Profile Build/UI — Design

**Date:** 2026-07-08
**Status:** Approved design (pending implementation plan)
**Parent spec:** `docs/specs/2026-07-07-coffee-app-mvp-design.md` ("Taste profile (first-class feature)", "Onboarding goal directive", and locked decision 1 — LLM is never the recommender) — this doc resolves the open design questions left there; it does not relitigate anything already locked.
**Prior execution reports:** `docs/plans/2026-07-07-plan-1-foundation-coffee-log-REPORT.md` (`taste_profile`, `directives`, `library_entries` schema already exist; rating/review capture already ships) and the Plan 2 branch (`shots`/grind subsystem, and the `src/lib/<domain>/{constants,core}.ts` → server actions → UI house structure this plan mirrors).

## Problem

The parent spec makes the taste profile a first-class, viewable feature: flavor-territory clusters the user gravitates to, preferred processes, with evidence cited from their own ratings — rebuilt as ratings accumulate, staleness tracked, and readable at `/profile`. The schema exists (`taste_profile`: versioned `profile` jsonb + `built_at` + `stale`; `directives`: `goals[]` + `free_text` + `exclude_added_flavor`), and rating/review capture shipped in Plan 1 (`library_entries.rating`/`review`). What's missing is (1) the logic that turns rated coffees into a profile, (2) the `/profile` screen that displays it and edits the directive, and (3) the rebuild/staleness lifecycle. No `/profile` route exists yet, and the `directives` table has no UI.

The tension this design resolves: the parent spec says "reviews are direct taste-profile signal, weighted above metadata inference," but reviews are free text and locked decision 1 forbids the LLM from *computing* the signal that feeds Discovery. This design keeps the computed profile deterministic and uses the LLM only to phrase a human-readable summary — the same discipline as Plan 2's grind numbers.

## No schema changes

`taste_profile` and `directives` both already exist from Plan 1 exactly as needed. Everything the profile computes is stored inside the `taste_profile.profile` jsonb column. This plan adds **no migration** — consistent with `CLAUDE.md`: "later plans add UI/logic on existing tables, not new migrations for these, unless a plan says otherwise."

## Constants

New module `src/lib/taste/constants.ts` — the single home for tunable values, never inlined elsewhere (same discipline as `src/lib/grind/constants.ts`):

- `MIN_RATED_COFFEES_FOR_PROFILE = 5` — cold-start gate. Below this, no real profile is built (matches the parent spec's Discovery cold-start threshold of 5 rated coffees).
- `POSITIVE_RATING_THRESHOLD = 4` — a coffee rated ≥ 4★ is a "liked" reference for positive affinity.
- `PROFILE_VERSION = 1` — stamped into the stored `profile` jsonb so future shape changes are detectable.

## Cluster lookup

New module `src/lib/taste/clusters.ts` — a typed constant mapping tasting-note phrases to the flavor-territory clusters, mirroring `knowledge/tasting-note-vocabulary.md` (10 clusters: `fruit_candied`, `fruit_fresh`, `fruit_dried_wine`, `citrus`, `floral`, `tropical`, `nutty_cocoa`, `sweet_dessert`, `spice`, `funky_savory`). The markdown remains the human source of truth; a comment in the module ties the two together and instructs that new phrases are added to the markdown first, then mirrored here.

Phrase → cluster resolution:
1. Normalize the phrase with the existing `normalizeForMatch` from `src/lib/catalog/similarity.ts`.
2. Exact match against a cluster's phrase list → that cluster.
3. Otherwise, `diceCoefficient` (also from `similarity.ts`) fuzzy match against all known phrases; best match above a threshold → its cluster.
4. No match → the `uncategorized` bucket (tracked but never surfaced as an affinity).

Reusing `similarity.ts` keeps the fuzzy-matching logic in one place rather than duplicating it.

## Deterministic profile computation

New module `src/lib/taste/profile.ts` — a pure, I/O-free, LLM-free function:

```ts
computeProfile(ratedCoffees: RatedCoffee[]): TasteProfileData
```

where each `RatedCoffee` carries `{ rating, tastingNotes, process, flavorOrigin }` (the joined coffee facts for one rated `library_entries` row). The output shape stored in `taste_profile.profile`:

```ts
type TasteProfileData = {
  version: number          // PROFILE_VERSION
  ratedCount: number       // rated library entries this build drew from
  clusters: { cluster: string; affinity: number; evidence: string }[]   // sorted desc by affinity
  processes: { process: string; affinity: number; evidence: string }[]  // sorted desc by affinity
  summary: string          // the ONLY LLM-authored field; "" if prose failed
}
```

**Affinity weighting** (per cluster and per process):
- A coffee rated ≥ `POSITIVE_RATING_THRESHOLD` (4–5★) contributes **positive** weight to every cluster its tasting notes map to, and to its process.
- A coffee rated 1–2★ contributes **mild negative** weight (a disliked coffee pushes its clusters/process down).
- A coffee rated 3★ is **neutral** (counted in `ratedCount` and evidence tallies, but zero affinity contribution).
- Affinity is aggregated then normalized so the display bars are comparable; exact normalization is pinned in the implementation plan.

**Evidence** strings are computed deterministically from the tallies, never authored by the LLM, e.g. `"4 of 5 fruit-candied coffees rated 4★+"` and `"rated 3 of 3 anaerobic naturals 4★+"`. They are the human-legible justification shown on `/profile` and later handed to Discovery.

Ties and empties: clusters/processes with zero net positive affinity are omitted from the display arrays. A profile with `ratedCount ≥ 5` but no positive clusters (e.g. everything rated low) still builds and renders honestly ("no strong preferences yet").

## LLM prose step

New module `src/lib/taste/prose.ts` — wraps the existing Anthropic SDK client/config used by the listing parser (no new client wiring). Input: the fully-computed `TasteProfileData` (clusters, processes, evidence) plus a handful of the user's review snippets as quotable context. Output: one short human-readable paragraph for `summary`.

Hard constraints (enforced by the prompt and by the fact that `summary` is a display-only field):
- The model **phrases** the already-computed profile — it invents no flavors, clusters, or numbers, and cannot change any affinity or evidence value.
- Reviews are context the prose *may* quote; they do **not** enter `computeProfile` and never alter the numbers. (The "reviews weighted above metadata" signal lands in full in Plan 4's Stage-2 rerank, which reads review evidence directly.)
- If the prose call fails or times out, the deterministic profile is still saved with `summary = ""` and the UI shows a retry affordance — the numbers never depend on the LLM being available.

## Server actions

New module `src/lib/actions/taste.ts` — all queries scoped by `requireUserId()` (app-code authorization, locked decision):

- `getProfileView()` → `{ profile: TasteProfileData | null; builtAt: string | null; ratedCount: number; newRatingsSince: number; state: ProfileState }`. Loads the latest `taste_profile` row and derives staleness (see below) in one call for the page.
- `rebuildProfile()` → runs `computeProfile` over the user's rated entries, calls `prose.ts` for the summary, writes a fresh `taste_profile` row (`stale = false`, `built_at = now()`). Returns the new view. Surfaces errors to the caller.
- `getDirective()` / `saveDirective(input)` → read and upsert the single per-user `directives` row (unique on `user_id`); `saveDirective` sets `edited_at = now()`. Surfaces errors to the caller.

**Staleness is derived on read**, not trusted from the column: compare the latest row's `built_at` to the max `updated_at` among the user's rated `library_entries`. If newer ratings exist, the profile is stale and `newRatingsSince` counts the rated entries changed after `built_at`. The `stale` column is set to `false` at build time (kept consistent, but the derivation is the source of truth so a missed flag can't produce a false "fresh").

## `/profile` screen

New route `src/app/profile/page.tsx` (server component loading `getProfileView` + `getDirective`) plus `src/components/profile/*`, and a NavBar link to `/profile`.

States:
- **Cold start** (`ratedCount < MIN_RATED_COFFEES_FOR_PROFILE`): no build, no LLM call. "Not personalized yet — rate a few more coffees (N of 5)." Shows the current directive framed as "Based on your stated goals: …". Never a fabricated profile.
- **Never built** (≥ 5 rated, no row yet): "Build your profile" CTA that calls `rebuildProfile`.
- **Fresh**: cluster affinity bars, process preferences, evidence citations, and the LLM `summary` paragraph. "Last built <date>."
- **Stale**: fresh layout plus a banner "N new ratings since last build" and a **Rebuild profile** button.
- **Directive editor** (visible in every state): multi-select goals (the spec's three seed options — "discover wild process-driven flavors," "find reliable daily drinkers," "explore specific origins" — plus free text) and the "exclude added-flavor coffees" toggle, saved via `saveDirective`.

## Error handling

Tightens the one gap the Plan 2 review flagged (forms silently clearing on a failed server action): the **Rebuild profile** button and the directive **Save** show explicit pending/error states rather than failing silently, because both can fail (LLM outage for rebuild; DB error for either). A failed prose call degrades gracefully to a saved profile with an empty summary and a retry, as described above.

## Testing

- **Unit:** cluster mapping (exact, fuzzy, uncategorized); `computeProfile` over fixture rated coffees → expected clusters/processes/evidence, including the negative/neutral weighting and the "≥5 rated, no positive clusters" case; staleness derivation; constants presence and exact values. The prose call is mocked.
- **Component:** `/profile` in each state (cold-start, never-built, fresh, stale) and a directive-editor round-trip. DB mocked by reference equality (`table === libraryEntries` / `table === tasteProfile` / `table === directives`), LLM mocked.
- **Browser verification pass** at the end (mirroring Plan 2's Tasks 5/7/8/9), run by the controller via Claude-in-Chrome, not implementer subagents: register ratings, build a profile, see clusters + evidence + summary, edit the directive, confirm staleness after a new rating.

## Out of scope (deferred, explicit)

- **Wrapped-style profile reveal** — the parent spec already marks it post-MVP.
- **First-run onboarding wizard** — the directive editor on `/profile` doubles as initial capture; a dedicated onboarding flow is its own concern.
- **Discovery scoring/consumption of the profile** — that's Plan 4. This plan produces and persists the profile row; Plan 4 reads it.
- **Deterministic keyword extraction from review text** — reviews inform prose only in the MVP; the "reviews > metadata" weighting is realized in Plan 4's Stage-2 rerank.

## Locked decisions honored

1. **LLM is never the recommender / never computes the signal** — `computeProfile` is pure deterministic TS; the LLM only phrases `summary`.
2. **Grind/Discovery/profile all deterministic-first** — same house pattern as Plan 2.
3. **Per-user data scoped in app code** — every `taste.ts` query uses `requireUserId()`; no RLS.
4. **Additive only** — no migration; `taste_profile`/`directives` used as-is.
5. **Named tunable constants in one module** — `src/lib/taste/constants.ts`.
6. **Permanent parser fixture untouched** — this plan does not touch `src/lib/parsing/`.
