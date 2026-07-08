# Plan 3 — Taste Profile Build/UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the signed-in user's own coffee ratings into a viewable, human-readable taste profile — flavor-cluster and process affinities with cited evidence — computed deterministically, phrased by an LLM, and editable-directive-aware, at `/profile`.

**Architecture:** Pure functions in `src/lib/taste/` do all the computation (constants, phrase→cluster mapping, affinity aggregation) with zero DB and zero LLM. A single isolated module (`prose.ts`) makes the one LLM call, and it only *phrases* the already-computed profile — it never produces a number or a cluster. Server actions in `src/lib/actions/taste.ts` scope every query to the user via `requireUserId()`, delegate math to the pure functions, persist a versioned `taste_profile` row, and derive staleness on read. Client components render the `/profile` screen (profile display + rebuild) and the directive editor.

**Tech Stack:** Next.js 16 (App Router, `--webpack`), Drizzle ORM (postgres-js), Supabase Postgres/Auth, Anthropic TypeScript SDK, Vitest + Testing Library, TypeScript, Tailwind.

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the Plan 3 design spec (`docs/specs/2026-07-08-plan-3-taste-profile-design.md`) and the parent spec's locked decisions.

- **Named constants (exact values):** `MIN_RATED_COFFEES_FOR_PROFILE = 5`, `POSITIVE_RATING_THRESHOLD = 4`, `PROFILE_VERSION = 1`. All live in one module (`src/lib/taste/constants.ts`), never hardcoded inline elsewhere.
- **The LLM never computes the profile.** `computeProfile` is pure deterministic TypeScript over the user's own rated coffees. The LLM (`prose.ts`) only writes the `summary` string; it cannot change any affinity, evidence, or cluster. (Parent spec locked decision 1.)
- **Reviews never enter `computeProfile`.** Review free-text is passed to the prose step as quotable context only, and shown as evidence — it never alters the computed numbers. (The "reviews > metadata" weighting is realized later, in Plan 4's Stage-2 rerank.)
- **Staleness is derived on read**, not trusted from the `stale` column: compare the latest `taste_profile.built_at` to the max `updated_at` among the user's rated `library_entries`. The `stale` column is written `false` at build time but the derivation is the source of truth.
- **No migration.** `taste_profile` (versioned `profile` jsonb + `built_at` + `stale`) and `directives` already exist from Plan 1 exactly as needed. Everything computed is stored inside `taste_profile.profile`. Do not add columns or generate a migration.
- **Authorization in app code:** every DB query in `taste.ts` is scoped by `requireUserId()`. No Postgres RLS. `taste_profile`, `directives`, `library_entries` are per-user tables (`user_id` column); `coffees`/`roasters` stay shared catalog.
- **Test DB mocks use reference equality:** route mocked table queries by `table === libraryEntries` / `table === tasteProfile` / `table === directives`, never `table._.name` (that property doesn't exist on real drizzle-orm 0.45.2 `pgTable` objects).
- **Hoisting-safe mocks:** any value a hoisted `vi.mock` factory references must be created with `vi.hoisted(...)`; import schema tables *inside* an `async` mock factory (`const { ... } = await import('@/lib/db/schema')`) to avoid the TDZ error Plan 2 hit (Tasks 4/5) — never reference statically-imported schema bindings from the factory body.
- **Prose model:** the LLM prose call uses a small model, declared as a named constant `PROSE_MODEL = 'claude-haiku-4-5-20251001'` in `prose.ts`. The SDK client is constructed the same way the parser does (`new Anthropic()`, key from `ANTHROPIC_API_KEY`), no new client wiring.
- **Do not touch** `src/lib/parsing/fixtures/julioMadridCaturraNitro.ts` or its test — permanent calibration fixture. This plan touches nothing under `src/lib/parsing/`.
- **Browser UI verification is required for every task that adds or changes a UI component** (Tasks 5, 6) and once more at the end (Task 7). Vitest + Testing Library is not sufficient sign-off for UI work. This gate runs *before* the task's commit; if it surfaces a defect, fix it and re-run before committing. See "Browser UI Verification" below.

---

## File Structure

**New — pure computation (no DB, no React, no LLM):**
- `src/lib/taste/constants.ts` — the three named constants.
- `src/lib/taste/clusters.ts` — `CLUSTER_PHRASES`, `UNCATEGORIZED`, `clusterForPhrase`.
- `src/lib/taste/profile.ts` — `computeProfile`, types `RatedCoffee` / `TasteProfileData`.
- Tests: `src/lib/taste/clusters.test.ts`, `src/lib/taste/profile.test.ts`.

**New — LLM prose (isolated, mockable):**
- `src/lib/taste/prose.ts` — `generateProfileSummary`, `ProseGenerationError`, `PROSE_MODEL`.
- Test: `src/lib/taste/prose.test.ts`.

**New — server actions:**
- `src/lib/actions/taste.ts` (+ `.test.ts`) — `getProfileView`, `rebuildProfile`, `getDirective`, `saveDirective`, types `ProfileView` / `ProfileState` / `DirectiveView`.

**New — UI:**
- `src/components/profile/ProfileView.tsx` (+ `.test.tsx`), `src/components/profile/DirectiveEditor.tsx` (+ `.test.tsx`), `src/app/profile/page.tsx`.
- Modified: `src/components/layout/NavBar.tsx` (Profile link).

**Reused as-is (do not modify):** `src/lib/catalog/similarity.ts` (`normalizeForMatch`, `diceCoefficient`), `src/lib/db/schema` (barrel already exports `tasteProfile`, `directives`, `libraryEntries`, `coffees`), `src/lib/auth/requireUserId`, `knowledge/tasting-note-vocabulary.md` (human source of truth mirrored by `clusters.ts`).

---

## Browser UI Verification (shared procedure)

Tasks 5 and 6 each end with a browser pass, and Task 7 runs the full flow. Use **Claude-in-Chrome** (the MCP browser tools already wired into this environment) as the primary driver.

**Preconditions (do once per session):**
1. Start the dev server in the background: `npm run dev` (already runs `next dev --webpack` per `package.json` — do not change this). It serves on `http://localhost:3000`.
2. **Auth:** every page here is behind `requireUserId()`, which redirects unauthenticated requests to `/login`. Claude-in-Chrome drives the human's existing Chrome session, so the human must be logged in to the app in that Chrome profile first. If a navigation lands on `/login`, that is the signal to log in — not a component bug.
3. At the start of the browser pass call `tabs_context_mcp` once, then `tabs_create_mcp` for a fresh tab (never reuse a prior session's tab id).

**Per-pass procedure (fill in the route and checks from the task):**
1. `navigate` to the route under test.
2. `read_page` (or `computer` screenshot) to confirm the expected elements rendered.
3. Exercise the specific interactions the task calls out.
4. `read_console_messages` — confirm no React hydration errors, no uncaught exceptions, no failed server-action requests.
5. Record a one-line pass/fail with what was observed. On failure, fix the component and re-run before committing the task.

**Do not** trigger `alert`/`confirm`/`prompt` dialogs — they freeze the extension. None of these components use them; keep it that way.

**Who runs this:** the browser pass is a **controller/human** activity, not an implementer-subagent one — implementer subagents don't hold the Claude-in-Chrome tools and the browser drives the human's real Chrome session. Under subagent-driven-development, run the browser pass yourself (the controller) after the implementer reports DONE and its task review is clean, before marking the task complete.

**Seeding rated coffees:** the profile needs ≥5 rated coffees to leave cold-start. If the account has fewer, add and rate coffees via the existing `/coffee/add` + rating UI first (or reuse the test coffees seeded during Plan 2's browser passes). Rate a spread of processes/flavors so clusters are non-trivial.

---

## Task 1: Taste constants + cluster lookup

**Files:**
- Create: `src/lib/taste/constants.ts`
- Create: `src/lib/taste/clusters.ts`
- Test: `src/lib/taste/clusters.test.ts`

**Interfaces:**
- Consumes: `normalizeForMatch`, `diceCoefficient` from `src/lib/catalog/similarity.ts`.
- Produces:
  - `MIN_RATED_COFFEES_FOR_PROFILE: number`, `POSITIVE_RATING_THRESHOLD: number`, `PROFILE_VERSION: number` (from `constants.ts`).
  - `CLUSTER_PHRASES: Record<string, string[]>`, `UNCATEGORIZED: 'uncategorized'`, `clusterForPhrase(phrase: string): string` (from `clusters.ts`).

- [ ] **Step 1: Write the failing test**

`src/lib/taste/clusters.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { clusterForPhrase, UNCATEGORIZED } from './clusters'
import {
  MIN_RATED_COFFEES_FOR_PROFILE,
  POSITIVE_RATING_THRESHOLD,
  PROFILE_VERSION,
} from './constants'

describe('constants', () => {
  it('holds the locked values', () => {
    expect(MIN_RATED_COFFEES_FOR_PROFILE).toBe(5)
    expect(POSITIVE_RATING_THRESHOLD).toBe(4)
    expect(PROFILE_VERSION).toBe(1)
  })
})

describe('clusterForPhrase', () => {
  it('maps an exact vocabulary phrase to its cluster', () => {
    expect(clusterForPhrase('watermelon bubble gum')).toBe('fruit_candied')
    expect(clusterForPhrase('jasmine')).toBe('floral')
  })

  it('is case- and whitespace-insensitive', () => {
    expect(clusterForPhrase('  Watermelon Bubble Gum ')).toBe('fruit_candied')
  })

  it('fuzzy-matches a close near-miss to the right cluster', () => {
    expect(clusterForPhrase('blueberries')).toBe('fruit_fresh')
  })

  it('returns uncategorized for an unknown phrase or empty string', () => {
    expect(clusterForPhrase('motor oil')).toBe(UNCATEGORIZED)
    expect(clusterForPhrase('')).toBe(UNCATEGORIZED)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/taste/clusters.test.ts`
Expected: FAIL — cannot resolve `./clusters` / `./constants`.

- [ ] **Step 3: Write the constants**

`src/lib/taste/constants.ts`:

```ts
// Named tunable constants for the taste profile. Single home — never inline.

// Cold-start gate: below this many rated coffees, no real profile is built and
// /profile shows a directive-based "not personalized yet" state. Matches the
// parent spec's Discovery cold-start threshold of 5 rated coffees.
export const MIN_RATED_COFFEES_FOR_PROFILE = 5

// A coffee rated at or above this (out of 5) is a "liked" reference driving
// positive affinity. 1–2★ contribute mild negative affinity; 3★ is neutral.
export const POSITIVE_RATING_THRESHOLD = 4

// Stamped into the stored profile jsonb so future shape changes are detectable.
export const PROFILE_VERSION = 1
```

- [ ] **Step 4: Write the cluster lookup**

`src/lib/taste/clusters.ts`:

```ts
import { normalizeForMatch, diceCoefficient } from '@/lib/catalog/similarity'

// Mirrors knowledge/tasting-note-vocabulary.md (v1). The markdown is the human
// source of truth: add new phrases THERE first, then mirror them here.
export const CLUSTER_PHRASES: Record<string, string[]> = {
  fruit_candied: [
    'watermelon bubble gum', 'strawberry yogurt candy', 'mango creamsicle',
    'pink lemonade', 'tropical candy', 'fruit punch', 'bubblegum',
    'cotton candy', 'jolly rancher', 'skittles',
  ],
  fruit_fresh: [
    'strawberry', 'blueberry', 'raspberry', 'cherry', 'red apple',
    'green apple', 'pear', 'peach', 'apricot', 'plum', 'grape',
  ],
  fruit_dried_wine: [
    'raisin', 'fig', 'date', 'dried cherry', 'port wine', 'red wine',
    'tannic', 'boozy', 'fermented fruit',
  ],
  citrus: ['lemon', 'lime', 'orange', 'grapefruit', 'bergamot', 'mandarin', 'tangerine'],
  floral: ['jasmine', 'rose', 'hibiscus', 'lavender', 'orange blossom', 'chamomile', 'bergamot floral'],
  tropical: ['pineapple', 'papaya', 'passionfruit', 'guava', 'lychee', 'mango'],
  nutty_cocoa: ['almond', 'hazelnut', 'walnut', 'peanut', 'cocoa', 'dark chocolate', 'milk chocolate', 'cocoa nib'],
  sweet_dessert: ['caramel', 'brown sugar', 'molasses', 'maple syrup', 'honey', 'vanilla', 'toffee', 'marshmallow'],
  spice: ['cinnamon', 'clove', 'nutmeg', 'black pepper', 'ginger', 'allspice'],
  funky_savory: ['funky', 'barnyard', 'umami', 'olive', 'soy', 'fermented', 'cheesy', 'gamey'],
}

export const UNCATEGORIZED = 'uncategorized'

// Best-match dice score below this leaves a phrase uncategorized rather than
// forcing it into a loosely-related cluster.
const FUZZY_THRESHOLD = 0.7

// Precompute normalized phrase → cluster for exact lookup.
const exactIndex = new Map<string, string>()
for (const [cluster, phrases] of Object.entries(CLUSTER_PHRASES)) {
  for (const phrase of phrases) exactIndex.set(normalizeForMatch(phrase), cluster)
}

export function clusterForPhrase(phrase: string): string {
  const norm = normalizeForMatch(phrase)
  if (norm.length === 0) return UNCATEGORIZED

  const exact = exactIndex.get(norm)
  if (exact) return exact

  let bestCluster = UNCATEGORIZED
  let bestScore = 0
  for (const [candidate, cluster] of exactIndex) {
    const score = diceCoefficient(norm, candidate)
    if (score > bestScore) {
      bestScore = score
      bestCluster = cluster
    }
  }
  return bestScore >= FUZZY_THRESHOLD ? bestCluster : UNCATEGORIZED
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:run -- src/lib/taste/clusters.test.ts`
Expected: PASS (all cases).

- [ ] **Step 6: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/taste/constants.ts src/lib/taste/clusters.ts src/lib/taste/clusters.test.ts
git commit -m "feat(taste): flavor-cluster lookup + tunable constants"
```

---

## Task 2: Deterministic profile computation

**Files:**
- Create: `src/lib/taste/profile.ts`
- Test: `src/lib/taste/profile.test.ts`

**Interfaces:**
- Consumes: `PROFILE_VERSION`, `POSITIVE_RATING_THRESHOLD` from `./constants`; `clusterForPhrase`, `UNCATEGORIZED` from `./clusters`.
- Produces:
  - `type RatedCoffee = { rating: number; tastingNotes: string[]; process: string | null; flavorOrigin: string | null }`
  - `type TasteProfileData = { version: number; ratedCount: number; clusters: { cluster: string; affinity: number; evidence: string }[]; processes: { process: string; affinity: number; evidence: string }[]; summary: string }`
  - `computeProfile(ratedCoffees: RatedCoffee[]): TasteProfileData`

- [ ] **Step 1: Write the failing test**

`src/lib/taste/profile.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { computeProfile, type RatedCoffee } from './profile'

const coffees: RatedCoffee[] = [
  { rating: 5, tastingNotes: ['watermelon bubble gum'], process: 'anaerobic', flavorOrigin: 'process' },
  { rating: 4, tastingNotes: ['strawberry yogurt candy'], process: 'natural', flavorOrigin: 'process' },
  { rating: 5, tastingNotes: ['jasmine'], process: 'washed', flavorOrigin: 'process' },
  { rating: 2, tastingNotes: ['dark chocolate'], process: 'washed', flavorOrigin: 'process' },
  { rating: 3, tastingNotes: ['lemon'], process: 'washed', flavorOrigin: 'process' },
]

describe('computeProfile', () => {
  it('ranks liked clusters, normalizes the top to 1, and drops non-positive ones', () => {
    const p = computeProfile(coffees)
    expect(p.version).toBe(1)
    expect(p.ratedCount).toBe(5)
    expect(p.summary).toBe('')

    expect(p.clusters[0]).toEqual({
      cluster: 'fruit_candied',
      affinity: 1,
      evidence: '2 of 2 fruit-candied coffees rated 4★+',
    })
    expect(p.clusters[1]).toMatchObject({ cluster: 'floral', affinity: 0.67 })
    // nutty_cocoa only appears on a 2★ coffee → net negative → omitted.
    expect(p.clusters.find((c) => c.cluster === 'nutty_cocoa')).toBeUndefined()
    // citrus only appears on a 3★ (neutral) coffee → zero affinity → omitted.
    expect(p.clusters.find((c) => c.cluster === 'citrus')).toBeUndefined()
  })

  it('ranks processes with evidence and normalization', () => {
    const p = computeProfile(coffees)
    expect(p.processes.map((x) => x.process)).toEqual(['anaerobic', 'natural', 'washed'])
    expect(p.processes[0]).toMatchObject({ process: 'anaerobic', affinity: 1 })
    expect(p.processes.find((x) => x.process === 'washed')?.evidence).toBe(
      'rated 1 of 3 washed coffees 4★+',
    )
  })

  it('skips uncategorized notes', () => {
    const p = computeProfile([
      { rating: 5, tastingNotes: ['motor oil'], process: null, flavorOrigin: null },
    ])
    expect(p.clusters).toEqual([])
  })

  it('builds honestly when nothing is liked (all low ratings)', () => {
    const p = computeProfile([
      { rating: 2, tastingNotes: ['jasmine'], process: 'washed', flavorOrigin: 'process' },
      { rating: 1, tastingNotes: ['lemon'], process: 'washed', flavorOrigin: 'process' },
    ])
    expect(p.ratedCount).toBe(2)
    expect(p.clusters).toEqual([])
    expect(p.processes).toEqual([])
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/taste/profile.test.ts`
Expected: FAIL — cannot resolve `./profile`.

- [ ] **Step 3: Write the implementation**

`src/lib/taste/profile.ts`:

```ts
import { PROFILE_VERSION, POSITIVE_RATING_THRESHOLD } from './constants'
import { clusterForPhrase, UNCATEGORIZED } from './clusters'

export type RatedCoffee = {
  rating: number // 1..5, guaranteed non-null by the caller
  tastingNotes: string[]
  process: string | null
  flavorOrigin: string | null
}

export type TasteProfileData = {
  version: number
  ratedCount: number
  clusters: { cluster: string; affinity: number; evidence: string }[]
  processes: { process: string; affinity: number; evidence: string }[]
  summary: string // the ONLY LLM-authored field; '' until prose runs (or if it fails)
}

// Rating-centered weight: 5→+2, 4→+1, 3→0, 2→-1, 1→-2. A liked coffee lifts its
// clusters/process, a disliked one pushes them down, a neutral one abstains.
function weightFor(rating: number): number {
  return rating - 3
}

export function computeProfile(ratedCoffees: RatedCoffee[]): TasteProfileData {
  const clusterAffinity = new Map<string, number>()
  const clusterLiked = new Map<string, number>()
  const clusterTotal = new Map<string, number>()
  const processAffinity = new Map<string, number>()
  const processLiked = new Map<string, number>()
  const processTotal = new Map<string, number>()

  for (const c of ratedCoffees) {
    const weight = weightFor(c.rating)
    const liked = c.rating >= POSITIVE_RATING_THRESHOLD ? 1 : 0

    // A coffee contributes once per DISTINCT cluster its notes map to, so a
    // verbose listing can't dominate. Uncategorized notes are ignored.
    const clusters = new Set<string>()
    for (const note of c.tastingNotes) {
      const cluster = clusterForPhrase(note)
      if (cluster !== UNCATEGORIZED) clusters.add(cluster)
    }
    for (const cluster of clusters) {
      clusterAffinity.set(cluster, (clusterAffinity.get(cluster) ?? 0) + weight)
      clusterTotal.set(cluster, (clusterTotal.get(cluster) ?? 0) + 1)
      clusterLiked.set(cluster, (clusterLiked.get(cluster) ?? 0) + liked)
    }

    if (c.process) {
      processAffinity.set(c.process, (processAffinity.get(c.process) ?? 0) + weight)
      processTotal.set(c.process, (processTotal.get(c.process) ?? 0) + 1)
      processLiked.set(c.process, (processLiked.get(c.process) ?? 0) + liked)
    }
  }

  const clusterPositives = [...clusterAffinity.entries()]
    .filter(([, aff]) => aff > 0)
    .sort((a, b) => b[1] - a[1])
  const maxCluster = clusterPositives[0]?.[1] ?? 1
  const clusters = clusterPositives.map(([cluster, aff]) => ({
    cluster,
    affinity: Math.round((aff / maxCluster) * 100) / 100,
    evidence: `${clusterLiked.get(cluster) ?? 0} of ${clusterTotal.get(cluster) ?? 0} ${cluster.replace(/_/g, '-')} coffees rated ${POSITIVE_RATING_THRESHOLD}★+`,
  }))

  const processPositives = [...processAffinity.entries()]
    .filter(([, aff]) => aff > 0)
    .sort((a, b) => b[1] - a[1])
  const maxProcess = processPositives[0]?.[1] ?? 1
  const processes = processPositives.map(([process, aff]) => ({
    process,
    affinity: Math.round((aff / maxProcess) * 100) / 100,
    evidence: `rated ${processLiked.get(process) ?? 0} of ${processTotal.get(process) ?? 0} ${process} coffees ${POSITIVE_RATING_THRESHOLD}★+`,
  }))

  return {
    version: PROFILE_VERSION,
    ratedCount: ratedCoffees.length,
    clusters,
    processes,
    summary: '',
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/taste/profile.test.ts`
Expected: PASS (all four cases).

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/taste/profile.ts src/lib/taste/profile.test.ts
git commit -m "feat(taste): deterministic profile computation from rated coffees"
```

---

## Task 3: LLM prose step

**Files:**
- Create: `src/lib/taste/prose.ts`
- Test: `src/lib/taste/prose.test.ts`

**Interfaces:**
- Consumes: `type TasteProfileData` from `./profile`; `@anthropic-ai/sdk` default export.
- Produces:
  - `class ProseGenerationError extends Error`
  - `const PROSE_MODEL: string`
  - `generateProfileSummary(profile: TasteProfileData, reviewSnippets: string[]): Promise<string>`

- [ ] **Step 1: Write the failing test**

`src/lib/taste/prose.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TasteProfileData } from './profile'

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }))
vi.mock('@anthropic-ai/sdk', () => ({
  default: class {
    messages = { create: createMock }
  },
}))

import { generateProfileSummary, ProseGenerationError } from './prose'

const profile: TasteProfileData = {
  version: 1,
  ratedCount: 6,
  clusters: [{ cluster: 'funky_savory', affinity: 1, evidence: '3 of 3 funky-savory coffees rated 4★+' }],
  processes: [{ process: 'natural', affinity: 1, evidence: 'rated 3 of 3 natural coffees 4★+' }],
  summary: '',
}

describe('generateProfileSummary', () => {
  beforeEach(() => createMock.mockReset())

  it('returns the model text for the computed profile', async () => {
    createMock.mockResolvedValue({
      content: [{ type: 'text', text: 'You gravitate to funky naturals.' }],
    })
    const out = await generateProfileSummary(profile, ['insane strawberry'])
    expect(out).toBe('You gravitate to funky naturals.')
    expect(createMock).toHaveBeenCalledOnce()
  })

  it('throws ProseGenerationError when the API call fails', async () => {
    createMock.mockRejectedValue(new Error('network'))
    await expect(generateProfileSummary(profile, [])).rejects.toBeInstanceOf(ProseGenerationError)
  })

  it('throws ProseGenerationError when the model returns no text', async () => {
    createMock.mockResolvedValue({ content: [{ type: 'tool_use' }] })
    await expect(generateProfileSummary(profile, [])).rejects.toBeInstanceOf(ProseGenerationError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/taste/prose.test.ts`
Expected: FAIL — cannot resolve `./prose`.

- [ ] **Step 3: Write the implementation**

`src/lib/taste/prose.ts`:

```ts
import Anthropic from '@anthropic-ai/sdk'
import type { TasteProfileData } from './profile'

export class ProseGenerationError extends Error {}

// Phrasing already-computed facts is a small task — a cheap, fast model suffices.
export const PROSE_MODEL = 'claude-haiku-4-5-20251001'

const SYSTEM_PROMPT = `You write a short, friendly 2-3 sentence summary of a coffee drinker's taste profile.
You are given already-computed flavor-cluster and process preferences with evidence, plus optional review snippets.
Rules:
- Phrase ONLY what you're given. Do not invent flavors, clusters, numbers, or preferences that are not in the data.
- Do not restate the raw numbers; describe the preferences in plain language.
- You may lightly reference the review snippets as color. Keep it to 2-3 sentences.`

type Textish = { type: string; text?: string }

export async function generateProfileSummary(
  profile: TasteProfileData,
  reviewSnippets: string[],
): Promise<string> {
  const topClusters = profile.clusters
    .slice(0, 5)
    .map((c) => `${c.cluster.replace(/_/g, '-')} (${c.evidence})`)
  const topProcesses = profile.processes
    .slice(0, 5)
    .map((p) => `${p.process} (${p.evidence})`)

  const userContent = [
    `Flavor clusters they gravitate to: ${topClusters.length ? topClusters.join('; ') : 'none yet'}`,
    `Preferred processes: ${topProcesses.length ? topProcesses.join('; ') : 'none yet'}`,
    reviewSnippets.length
      ? `Review snippets: ${reviewSnippets.map((r) => `"${r}"`).join(' ')}`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  try {
    const client = new Anthropic()
    const message = await client.messages.create({
      model: PROSE_MODEL,
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userContent }],
    })
    const text = (message.content as Textish[])
      .map((b) => (b.type === 'text' ? (b.text ?? '') : ''))
      .join('')
      .trim()
    if (!text) throw new ProseGenerationError('model returned no text')
    return text
  } catch (err) {
    if (err instanceof ProseGenerationError) throw err
    throw new ProseGenerationError(
      err instanceof Error ? err.message : 'unknown prose error',
    )
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/taste/prose.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/taste/prose.ts src/lib/taste/prose.test.ts
git commit -m "feat(taste): LLM prose summary step (phrases, never computes)"
```

---

## Task 4: Taste server actions

**Files:**
- Create: `src/lib/actions/taste.ts`
- Test: `src/lib/actions/taste.test.ts`

**Interfaces:**
- Consumes: `db` from `@/lib/db`; `libraryEntries`, `coffees`, `tasteProfile`, `directives` from `@/lib/db/schema`; `requireUserId`; `computeProfile`, `type RatedCoffee`, `type TasteProfileData` from `@/lib/taste/profile`; `generateProfileSummary`, `ProseGenerationError` from `@/lib/taste/prose`; `MIN_RATED_COFFEES_FOR_PROFILE` from `@/lib/taste/constants`.
- Produces:
  - `type ProfileState = 'cold_start' | 'never_built' | 'fresh' | 'stale'`
  - `type ProfileView = { state: ProfileState; profile: TasteProfileData | null; builtAt: string | null; ratedCount: number; newRatingsSince: number }`
  - `type DirectiveView = { goals: string[]; freeText: string | null; excludeAddedFlavor: boolean }`
  - `getProfileView(): Promise<ProfileView>`
  - `rebuildProfile(): Promise<ProfileView>`
  - `getDirective(): Promise<DirectiveView>`
  - `saveDirective(input: { goals: string[]; freeText?: string | null; excludeAddedFlavor: boolean }): Promise<void>`

- [ ] **Step 1: Write the failing test**

`src/lib/actions/taste.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/requireUserId', () => ({
  requireUserId: vi.fn().mockResolvedValue('user-1'),
}))

const { generateProfileSummaryMock } = vi.hoisted(() => ({
  generateProfileSummaryMock: vi.fn(),
}))
vi.mock('@/lib/taste/prose', () => ({
  generateProfileSummary: generateProfileSummaryMock,
  ProseGenerationError: class ProseGenerationError extends Error {},
}))

const { dbState } = vi.hoisted(() => ({
  dbState: {
    rated: [] as Record<string, unknown>[],
    profiles: [] as Record<string, unknown>[],
    directives: [] as Record<string, unknown>[],
    lastInsert: null as { table: string; values: Record<string, unknown> } | null,
    lastUpdate: null as { table: string; values: Record<string, unknown> } | null,
  },
}))

// Import schema INSIDE the async factory (never reference statically-imported
// bindings from a hoisted factory — that is the TDZ trap Plan 2 hit).
vi.mock('@/lib/db', async () => {
  const { libraryEntries, tasteProfile, directives } = await import('@/lib/db/schema')
  const route = (table: unknown) =>
    table === libraryEntries
      ? dbState.rated
      : table === tasteProfile
        ? dbState.profiles
        : table === directives
          ? dbState.directives
          : []
  // A thenable that also exposes the chain methods, so BOTH
  // `await select().from(t).where(...)` and
  // `select().from(t).innerJoin(...).where(...).orderBy(...)` resolve to rows.
  const chain = (rows: unknown[]) => {
    const p = Promise.resolve(rows) as Promise<unknown[]> & Record<string, unknown>
    p.innerJoin = () => chain(rows)
    p.where = () => chain(rows)
    p.orderBy = () => chain(rows)
    return p
  }
  const label = (table: unknown) =>
    table === tasteProfile ? 'tasteProfile' : table === directives ? 'directives' : 'other'
  return {
    db: {
      select: () => ({ from: (table: unknown) => chain(route(table)) }),
      insert: (table: unknown) => ({
        values: (values: Record<string, unknown>) => ({
          returning: () => {
            dbState.lastInsert = { table: label(table), values }
            const row = { id: 'row-1', ...values }
            if (table === tasteProfile) dbState.profiles.unshift(row)
            if (table === directives) dbState.directives.push(row)
            return Promise.resolve([row])
          },
        }),
      }),
      update: (table: unknown) => ({
        set: (values: Record<string, unknown>) => ({
          where: () => {
            dbState.lastUpdate = { table: label(table), values }
            if (table === directives && dbState.directives[0]) {
              Object.assign(dbState.directives[0], values)
            }
            return Promise.resolve(undefined)
          },
        }),
      }),
    },
  }
})

function ratedRow(over: Partial<Record<string, unknown>> = {}) {
  return {
    rating: 5,
    review: null,
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    tastingNotes: ['jasmine'],
    process: 'washed',
    flavorOrigin: 'process',
    ...over,
  }
}

beforeEach(() => {
  dbState.rated = []
  dbState.profiles = []
  dbState.directives = []
  dbState.lastInsert = null
  dbState.lastUpdate = null
  generateProfileSummaryMock.mockReset()
})

describe('getProfileView', () => {
  it('reports cold_start below the rated-coffee threshold', async () => {
    dbState.rated = [ratedRow(), ratedRow(), ratedRow()] // 3 < 5
    const { getProfileView } = await import('./taste')
    const view = await getProfileView()
    expect(view.state).toBe('cold_start')
    expect(view.ratedCount).toBe(3)
    expect(view.profile).toBeNull()
  })

  it('reports never_built with enough ratings but no stored row', async () => {
    dbState.rated = Array.from({ length: 5 }, () => ratedRow())
    const { getProfileView } = await import('./taste')
    const view = await getProfileView()
    expect(view.state).toBe('never_built')
  })

  it('reports fresh when the stored row is newer than every rating', async () => {
    dbState.rated = Array.from({ length: 5 }, () => ratedRow({ updatedAt: new Date('2026-01-01T00:00:00Z') }))
    dbState.profiles = [{ builtAt: new Date('2026-02-01T00:00:00Z'), profile: { version: 1, ratedCount: 5, clusters: [], processes: [], summary: 'hi' } }]
    const { getProfileView } = await import('./taste')
    const view = await getProfileView()
    expect(view.state).toBe('fresh')
    expect(view.newRatingsSince).toBe(0)
    expect(view.profile?.summary).toBe('hi')
  })

  it('reports stale and counts ratings changed since the build', async () => {
    dbState.rated = [
      ratedRow({ updatedAt: new Date('2026-01-01T00:00:00Z') }),
      ratedRow({ updatedAt: new Date('2026-01-01T00:00:00Z') }),
      ratedRow({ updatedAt: new Date('2026-01-01T00:00:00Z') }),
      ratedRow({ updatedAt: new Date('2026-01-01T00:00:00Z') }),
      ratedRow({ updatedAt: new Date('2026-03-01T00:00:00Z') }), // newer than build
    ]
    dbState.profiles = [{ builtAt: new Date('2026-02-01T00:00:00Z'), profile: { version: 1, ratedCount: 4, clusters: [], processes: [], summary: '' } }]
    const { getProfileView } = await import('./taste')
    const view = await getProfileView()
    expect(view.state).toBe('stale')
    expect(view.newRatingsSince).toBe(1)
  })
})

describe('rebuildProfile', () => {
  it('computes the profile, attaches the LLM summary, and inserts a fresh row', async () => {
    dbState.rated = [
      ratedRow({ rating: 5, tastingNotes: ['watermelon bubble gum'], process: 'anaerobic', review: 'insane strawberry' }),
      ratedRow({ rating: 4, tastingNotes: ['strawberry yogurt candy'], process: 'natural' }),
      ratedRow({ rating: 5, tastingNotes: ['jasmine'], process: 'washed' }),
      ratedRow({ rating: 4, tastingNotes: ['pineapple'], process: 'natural' }),
      ratedRow({ rating: 5, tastingNotes: ['lychee'], process: 'natural' }),
    ]
    generateProfileSummaryMock.mockResolvedValue('You love funky naturals.')
    const { rebuildProfile } = await import('./taste')
    const view = await rebuildProfile()

    expect(dbState.lastInsert?.table).toBe('tasteProfile')
    const stored = dbState.lastInsert?.values.profile as { ratedCount: number; summary: string }
    expect(stored.ratedCount).toBe(5)
    expect(stored.summary).toBe('You love funky naturals.')
    expect(dbState.lastInsert?.values.stale).toBe(false)
    expect(view.state).toBe('fresh')
    // reviews reach the prose step, not the compute step
    expect(generateProfileSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({ ratedCount: 5 }),
      expect.arrayContaining(['insane strawberry']),
    )
  })

  it('still saves the profile with an empty summary when prose fails', async () => {
    dbState.rated = Array.from({ length: 5 }, () => ratedRow({ tastingNotes: ['jasmine'], process: 'washed' }))
    const { ProseGenerationError } = await import('@/lib/taste/prose')
    generateProfileSummaryMock.mockRejectedValue(new ProseGenerationError('down'))
    const { rebuildProfile } = await import('./taste')
    await rebuildProfile()
    const stored = dbState.lastInsert?.values.profile as { summary: string }
    expect(stored.summary).toBe('')
  })
})

describe('directives', () => {
  it('returns sensible defaults when no directive exists', async () => {
    const { getDirective } = await import('./taste')
    const d = await getDirective()
    expect(d).toEqual({ goals: [], freeText: null, excludeAddedFlavor: true })
  })

  it('inserts a new directive when none exists', async () => {
    const { saveDirective } = await import('./taste')
    await saveDirective({ goals: ['wild_process'], freeText: 'lots of fruit', excludeAddedFlavor: false })
    expect(dbState.lastInsert?.table).toBe('directives')
    expect(dbState.lastInsert?.values).toMatchObject({
      userId: 'user-1',
      goals: ['wild_process'],
      freeText: 'lots of fruit',
      excludeAddedFlavor: false,
    })
  })

  it('updates the existing directive in place', async () => {
    dbState.directives = [{ userId: 'user-1', goals: [], freeText: null, excludeAddedFlavor: true }]
    const { saveDirective } = await import('./taste')
    await saveDirective({ goals: ['daily_drinkers'], excludeAddedFlavor: true })
    expect(dbState.lastUpdate?.table).toBe('directives')
    expect(dbState.directives[0]).toMatchObject({ goals: ['daily_drinkers'] })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/actions/taste.test.ts`
Expected: FAIL — cannot resolve `./taste`.

- [ ] **Step 3: Write the implementation**

`src/lib/actions/taste.ts`:

```ts
'use server'

import { eq, and, desc, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { libraryEntries, coffees, tasteProfile, directives } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/requireUserId'
import {
  computeProfile,
  type RatedCoffee,
  type TasteProfileData,
} from '@/lib/taste/profile'
import { generateProfileSummary, ProseGenerationError } from '@/lib/taste/prose'
import { MIN_RATED_COFFEES_FOR_PROFILE } from '@/lib/taste/constants'

export type ProfileState = 'cold_start' | 'never_built' | 'fresh' | 'stale'

export type ProfileView = {
  state: ProfileState
  profile: TasteProfileData | null
  builtAt: string | null
  ratedCount: number
  newRatingsSince: number
}

export type DirectiveView = {
  goals: string[]
  freeText: string | null
  excludeAddedFlavor: boolean
}

type RatedRow = {
  rating: number | null
  review: string | null
  updatedAt: Date
  tastingNotes: string[] | null
  process: string | null
  flavorOrigin: string | null
}

// The user's rated coffees joined to the catalog facts the profile is built from.
async function ratedEntries(userId: string): Promise<RatedRow[]> {
  return db
    .select({
      rating: libraryEntries.rating,
      review: libraryEntries.review,
      updatedAt: libraryEntries.updatedAt,
      tastingNotes: coffees.tastingNotes,
      process: coffees.process,
      flavorOrigin: coffees.flavorOrigin,
    })
    .from(libraryEntries)
    .innerJoin(coffees, eq(libraryEntries.coffeeId, coffees.id))
    .where(and(eq(libraryEntries.userId, userId), isNotNull(libraryEntries.rating)))
    .orderBy(desc(libraryEntries.updatedAt)) as unknown as Promise<RatedRow[]>
}

export async function getProfileView(): Promise<ProfileView> {
  const userId = await requireUserId()
  const rated = await ratedEntries(userId)
  const ratedCount = rated.length

  const rows = await db
    .select()
    .from(tasteProfile)
    .where(eq(tasteProfile.userId, userId))
    .orderBy(desc(tasteProfile.builtAt))
  const latest = rows[0] ?? null

  if (ratedCount < MIN_RATED_COFFEES_FOR_PROFILE) {
    return { state: 'cold_start', profile: null, builtAt: null, ratedCount, newRatingsSince: 0 }
  }
  if (!latest) {
    return { state: 'never_built', profile: null, builtAt: null, ratedCount, newRatingsSince: 0 }
  }

  const builtAt = latest.builtAt as Date
  // Staleness is DERIVED here, never trusted from the `stale` column.
  const newRatingsSince = rated.filter((r) => r.updatedAt > builtAt).length

  return {
    state: newRatingsSince > 0 ? 'stale' : 'fresh',
    profile: latest.profile as TasteProfileData,
    builtAt: builtAt.toISOString(),
    ratedCount,
    newRatingsSince,
  }
}

export async function rebuildProfile(): Promise<ProfileView> {
  const userId = await requireUserId()
  const rated = await ratedEntries(userId)

  const ratedCoffees: RatedCoffee[] = rated.map((r) => ({
    rating: r.rating as number,
    tastingNotes: r.tastingNotes ?? [],
    process: r.process,
    flavorOrigin: r.flavorOrigin,
  }))

  const profile = computeProfile(ratedCoffees)

  const reviewSnippets = rated
    .map((r) => r.review)
    .filter((r): r is string => !!r && r.trim().length > 0)
    .slice(0, 5)

  try {
    profile.summary = await generateProfileSummary(profile, reviewSnippets)
  } catch (err) {
    // The deterministic profile is still saved; the UI offers a retry. Only a
    // prose failure degrades to an empty summary — anything else is a real bug.
    if (!(err instanceof ProseGenerationError)) throw err
    profile.summary = ''
  }

  await db
    .insert(tasteProfile)
    .values({ userId, profile, stale: false, builtAt: new Date() })
    .returning()

  return getProfileView()
}

export async function getDirective(): Promise<DirectiveView> {
  const userId = await requireUserId()
  const rows = await db.select().from(directives).where(eq(directives.userId, userId))
  const d = rows[0]
  return {
    goals: (d?.goals as string[] | undefined) ?? [],
    freeText: (d?.freeText as string | null | undefined) ?? null,
    excludeAddedFlavor: (d?.excludeAddedFlavor as boolean | undefined) ?? true,
  }
}

export async function saveDirective(input: {
  goals: string[]
  freeText?: string | null
  excludeAddedFlavor: boolean
}): Promise<void> {
  const userId = await requireUserId()
  const existing = await db.select().from(directives).where(eq(directives.userId, userId))

  if (existing.length > 0) {
    await db
      .update(directives)
      .set({
        goals: input.goals,
        freeText: input.freeText ?? null,
        excludeAddedFlavor: input.excludeAddedFlavor,
        editedAt: new Date(),
      })
      .where(eq(directives.userId, userId))
    return
  }

  await db
    .insert(directives)
    .values({
      userId,
      goals: input.goals,
      freeText: input.freeText ?? null,
      excludeAddedFlavor: input.excludeAddedFlavor,
    })
    .returning()
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/actions/taste.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Typecheck and commit**

```bash
npx tsc --noEmit
git add src/lib/actions/taste.ts src/lib/actions/taste.test.ts
git commit -m "feat(taste): profile view/rebuild + directive server actions"
```

---

## Task 5: Profile display UI (ProfileView + /profile page + NavBar link) [BROWSER PASS]

**Files:**
- Create: `src/components/profile/ProfileView.tsx`
- Create: `src/components/profile/ProfileView.test.tsx`
- Create: `src/app/profile/page.tsx`
- Modify: `src/components/layout/NavBar.tsx`

**Interfaces:**
- Consumes: `rebuildProfile`, `type ProfileView as ProfileViewData` from `@/lib/actions/taste`; `MIN_RATED_COFFEES_FOR_PROFILE` from `@/lib/taste/constants`; `getProfileView` (in the page).
- Produces: `<ProfileView view={...} />` client component; `/profile` route (renders `ProfileView` only for now — the directive editor is added in Task 6).

- [ ] **Step 1: Write the failing test**

`src/components/profile/ProfileView.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ProfileView as ProfileViewData } from '@/lib/actions/taste'

const { rebuildProfileMock } = vi.hoisted(() => ({ rebuildProfileMock: vi.fn() }))
vi.mock('@/lib/actions/taste', () => ({ rebuildProfile: rebuildProfileMock }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

import { ProfileView } from './ProfileView'

const fresh: ProfileViewData = {
  state: 'fresh',
  ratedCount: 6,
  builtAt: '2026-02-01T00:00:00Z',
  newRatingsSince: 0,
  profile: {
    version: 1,
    ratedCount: 6,
    clusters: [{ cluster: 'fruit_candied', affinity: 1, evidence: '2 of 2 fruit-candied coffees rated 4★+' }],
    processes: [{ process: 'anaerobic', affinity: 1, evidence: 'rated 2 of 2 anaerobic coffees 4★+' }],
    summary: 'You gravitate to wild fruit-candied naturals.',
  },
}

describe('ProfileView', () => {
  beforeEach(() => rebuildProfileMock.mockReset())

  it('prompts to rate more coffees in cold start', () => {
    render(<ProfileView view={{ state: 'cold_start', ratedCount: 2, builtAt: null, newRatingsSince: 0, profile: null }} />)
    expect(screen.getByText(/2 of 5/)).toBeInTheDocument()
  })

  it('offers a build CTA when never built', async () => {
    rebuildProfileMock.mockResolvedValue({})
    render(<ProfileView view={{ state: 'never_built', ratedCount: 6, builtAt: null, newRatingsSince: 0, profile: null }} />)
    await userEvent.click(screen.getByRole('button', { name: /build your profile/i }))
    expect(rebuildProfileMock).toHaveBeenCalledOnce()
  })

  it('renders clusters, processes, evidence, and the summary when fresh', () => {
    render(<ProfileView view={fresh} />)
    expect(screen.getByText('You gravitate to wild fruit-candied naturals.')).toBeInTheDocument()
    expect(screen.getByText('fruit-candied')).toBeInTheDocument()
    expect(screen.getByText('2 of 2 fruit-candied coffees rated 4★+')).toBeInTheDocument()
    expect(screen.getByText('anaerobic')).toBeInTheDocument()
  })

  it('shows a stale banner with a rebuild button', async () => {
    rebuildProfileMock.mockResolvedValue({})
    render(<ProfileView view={{ ...fresh, state: 'stale', newRatingsSince: 3 }} />)
    expect(screen.getByText(/3 new ratings since last build/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /rebuild profile/i }))
    expect(rebuildProfileMock).toHaveBeenCalledOnce()
  })

  it('surfaces an error when rebuild fails', async () => {
    rebuildProfileMock.mockRejectedValue(new Error('boom'))
    render(<ProfileView view={{ ...fresh, state: 'stale', newRatingsSince: 1 }} />)
    await userEvent.click(screen.getByRole('button', { name: /rebuild profile/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/profile/ProfileView.test.tsx`
Expected: FAIL — cannot resolve `./ProfileView`.

- [ ] **Step 3: Write the component**

`src/components/profile/ProfileView.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { rebuildProfile, type ProfileView as ProfileViewData } from '@/lib/actions/taste'
import { MIN_RATED_COFFEES_FOR_PROFILE } from '@/lib/taste/constants'

export function ProfileView({ view }: { view: ProfileViewData }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function rebuild() {
    setError(null)
    startTransition(async () => {
      try {
        await rebuildProfile()
        router.refresh()
      } catch {
        setError('Could not rebuild your profile right now — try again.')
      }
    })
  }

  if (view.state === 'cold_start') {
    return (
      <section className="flex flex-col gap-2">
        <p className="text-sm text-gray-600">
          Not personalized yet — rate a few more coffees ({view.ratedCount} of{' '}
          {MIN_RATED_COFFEES_FOR_PROFILE}). Your stated goals below still guide discovery
          in the meantime.
        </p>
      </section>
    )
  }

  if (view.state === 'never_built') {
    return (
      <section className="flex flex-col gap-2">
        <p className="text-sm">You have enough ratings to build your taste profile.</p>
        <button
          type="button"
          onClick={rebuild}
          disabled={isPending}
          className="bg-black text-white rounded p-2 disabled:opacity-50 self-start"
        >
          {isPending ? 'Building…' : 'Build your profile'}
        </button>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      </section>
    )
  }

  const profile = view.profile!
  return (
    <section className="flex flex-col gap-4">
      {view.state === 'stale' && (
        <div role="status" className="flex items-center justify-between gap-3 rounded border border-amber-300 bg-amber-50 p-2 text-sm">
          <span>
            {view.newRatingsSince} new rating{view.newRatingsSince === 1 ? '' : 's'} since last build.
          </span>
          <button
            type="button"
            onClick={rebuild}
            disabled={isPending}
            className="bg-black text-white rounded px-3 py-1 disabled:opacity-50"
          >
            {isPending ? 'Rebuilding…' : 'Rebuild profile'}
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {profile.summary && <p className="text-sm">{profile.summary}</p>}

      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Flavor clusters</h3>
        {profile.clusters.length === 0 ? (
          <p className="text-sm text-gray-600">No strong flavor preferences yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {profile.clusters.map((c) => (
              <li key={c.cluster} className="flex flex-col gap-1">
                <span className="text-sm">{c.cluster.replace(/_/g, '-')}</span>
                <div aria-hidden className="h-2 rounded bg-gray-200">
                  <div className="h-2 rounded bg-black" style={{ width: `${Math.round(c.affinity * 100)}%` }} />
                </div>
                <small className="text-gray-500">{c.evidence}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="font-medium">Preferred processes</h3>
        {profile.processes.length === 0 ? (
          <p className="text-sm text-gray-600">No strong process preferences yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {profile.processes.map((p) => (
              <li key={p.process} className="text-sm">
                <span>{p.process}</span> <small className="text-gray-500">{p.evidence}</small>
              </li>
            ))}
          </ul>
        )}
      </div>

      {view.builtAt && (
        <p className="text-xs text-gray-500">Last built {new Date(view.builtAt).toLocaleDateString()}</p>
      )}
    </section>
  )
}
```

- [ ] **Step 4: Write the page and NavBar link**

`src/app/profile/page.tsx`:

```tsx
import { getProfileView } from '@/lib/actions/taste'
import { ProfileView } from '@/components/profile/ProfileView'

export default async function ProfilePage() {
  const view = await getProfileView()
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-4 pb-20">
      <h1 className="text-xl font-semibold">Your taste profile</h1>
      <ProfileView view={view} />
    </main>
  )
}
```

Modify `src/components/layout/NavBar.tsx` — add a Profile link after Equipment:

```tsx
      <Link href="/equipment" className="text-sm">
        Equipment
      </Link>
      <Link href="/profile" className="text-sm">
        Profile
      </Link>
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:run -- src/components/profile/ProfileView.test.tsx`
Expected: PASS (all cases).

- [ ] **Step 6: Typecheck, lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors.

- [ ] **Step 7: Browser pass** (controller runs this — see "Browser UI Verification")

Route: `/profile`. With the signed-in account holding ≥5 rated coffees: confirm the page renders, click **Build your profile** (never-built) → after refresh the summary + cluster bars + evidence appear. Rate one more coffee, return to `/profile`, confirm the **stale** banner ("N new ratings since last build") and that **Rebuild profile** refreshes it. If the account has <5 rated coffees, confirm the cold-start copy ("N of 5") instead, then seed more and repeat. Check `read_console_messages` for zero errors. Record pass/fail; fix and re-run before committing.

- [ ] **Step 8: Commit**

```bash
git add src/components/profile/ProfileView.tsx src/components/profile/ProfileView.test.tsx src/app/profile/page.tsx src/components/layout/NavBar.tsx
git commit -m "feat(taste): /profile screen with profile display + rebuild + nav link"
```

---

## Task 6: Directive editor [BROWSER PASS]

**Files:**
- Create: `src/components/profile/DirectiveEditor.tsx`
- Create: `src/components/profile/DirectiveEditor.test.tsx`
- Modify: `src/app/profile/page.tsx` (load + render the editor alongside `ProfileView`)

**Interfaces:**
- Consumes: `saveDirective`, `type DirectiveView` from `@/lib/actions/taste`; `getDirective` (in the page).
- Produces: `<DirectiveEditor directive={...} />` client component; `/profile` now renders both `ProfileView` and `DirectiveEditor`.

- [ ] **Step 1: Write the failing test**

`src/components/profile/DirectiveEditor.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DirectiveView } from '@/lib/actions/taste'

const { saveDirectiveMock } = vi.hoisted(() => ({ saveDirectiveMock: vi.fn() }))
vi.mock('@/lib/actions/taste', () => ({ saveDirective: saveDirectiveMock }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }))

import { DirectiveEditor } from './DirectiveEditor'

const empty: DirectiveView = { goals: [], freeText: null, excludeAddedFlavor: true }

describe('DirectiveEditor', () => {
  beforeEach(() => saveDirectiveMock.mockReset())

  it('reflects the current directive (exclude toggle pre-checked)', () => {
    render(<DirectiveEditor directive={{ goals: ['daily_drinkers'], freeText: 'more fruit', excludeAddedFlavor: true }} />)
    expect(screen.getByLabelText(/find reliable daily drinkers/i)).toBeChecked()
    expect(screen.getByLabelText(/exclude added-flavor/i)).toBeChecked()
    expect(screen.getByDisplayValue('more fruit')).toBeInTheDocument()
  })

  it('saves the selected goals, free text, and toggle', async () => {
    saveDirectiveMock.mockResolvedValue(undefined)
    render(<DirectiveEditor directive={empty} />)
    await userEvent.click(screen.getByLabelText(/discover wild process-driven flavors/i))
    await userEvent.type(screen.getByLabelText(/anything else/i), 'lychee please')
    await userEvent.click(screen.getByLabelText(/exclude added-flavor/i)) // true -> false
    await userEvent.click(screen.getByRole('button', { name: /save goals/i }))
    expect(saveDirectiveMock).toHaveBeenCalledWith({
      goals: ['wild_process'],
      freeText: 'lychee please',
      excludeAddedFlavor: false,
    })
  })

  it('surfaces an error when saving fails', async () => {
    saveDirectiveMock.mockRejectedValue(new Error('boom'))
    render(<DirectiveEditor directive={empty} />)
    await userEvent.click(screen.getByRole('button', { name: /save goals/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/try again/i)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/components/profile/DirectiveEditor.test.tsx`
Expected: FAIL — cannot resolve `./DirectiveEditor`.

- [ ] **Step 3: Write the component**

`src/components/profile/DirectiveEditor.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { saveDirective, type DirectiveView } from '@/lib/actions/taste'

const GOAL_OPTIONS = [
  { value: 'wild_process', label: 'Discover wild process-driven flavors' },
  { value: 'daily_drinkers', label: 'Find reliable daily drinkers' },
  { value: 'explore_origins', label: 'Explore specific origins' },
] as const

export function DirectiveEditor({ directive }: { directive: DirectiveView }) {
  const router = useRouter()
  const [goals, setGoals] = useState<string[]>(directive.goals)
  const [freeText, setFreeText] = useState(directive.freeText ?? '')
  const [excludeAddedFlavor, setExclude] = useState(directive.excludeAddedFlavor)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  function toggleGoal(value: string) {
    setSaved(false)
    setGoals((prev) => (prev.includes(value) ? prev.filter((g) => g !== value) : [...prev, value]))
  }

  function save() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await saveDirective({ goals, freeText: freeText || null, excludeAddedFlavor })
        setSaved(true)
        router.refresh()
      } catch {
        setError('Could not save your goals right now — try again.')
      }
    })
  }

  return (
    <section className="flex flex-col gap-3 border-t pt-4">
      <h2 className="font-medium">Your goals</h2>

      <fieldset className="flex flex-col gap-2">
        {GOAL_OPTIONS.map((o) => (
          <label key={o.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={goals.includes(o.value)}
              onChange={() => toggleGoal(o.value)}
            />
            {o.label}
          </label>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Anything else?
        <textarea
          value={freeText}
          onChange={(e) => {
            setSaved(false)
            setFreeText(e.target.value)
          }}
          rows={2}
          className="border rounded p-2"
        />
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={excludeAddedFlavor}
          onChange={(e) => {
            setSaved(false)
            setExclude(e.target.checked)
          }}
        />
        Exclude added-flavor coffees
      </label>

      <button
        type="button"
        onClick={save}
        disabled={isPending}
        className="bg-black text-white rounded p-2 disabled:opacity-50 self-start"
      >
        {isPending ? 'Saving…' : 'Save goals'}
      </button>
      {saved && <p role="status" className="text-sm text-green-700">Saved.</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
    </section>
  )
}
```

- [ ] **Step 4: Wire the editor into the page**

Replace `src/app/profile/page.tsx` with:

```tsx
import { getProfileView, getDirective } from '@/lib/actions/taste'
import { ProfileView } from '@/components/profile/ProfileView'
import { DirectiveEditor } from '@/components/profile/DirectiveEditor'

export default async function ProfilePage() {
  const [view, directive] = await Promise.all([getProfileView(), getDirective()])
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-6 p-4 pb-20">
      <h1 className="text-xl font-semibold">Your taste profile</h1>
      <ProfileView view={view} />
      <DirectiveEditor directive={directive} />
    </main>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npm run test:run -- src/components/profile/DirectiveEditor.test.tsx`
Expected: PASS (all cases).

- [ ] **Step 6: Typecheck, lint**

```bash
npx tsc --noEmit
npm run lint
```

Expected: no errors.

- [ ] **Step 7: Browser pass** (controller runs this — see "Browser UI Verification")

Route: `/profile`. Confirm the goals editor renders below the profile: check a goal, type free text, toggle "Exclude added-flavor coffees", click **Save goals** → "Saved." appears. Reload the page and confirm the selections persisted (directive round-trips through `getDirective`). Check `read_console_messages` for zero errors. Record pass/fail; fix and re-run before committing.

- [ ] **Step 8: Commit**

```bash
git add src/components/profile/DirectiveEditor.tsx src/components/profile/DirectiveEditor.test.tsx src/app/profile/page.tsx
git commit -m "feat(taste): directive editor on /profile"
```

---

## Task 7: Full-flow browser walkthrough (verification only)

No production code unless this pass surfaces a defect. End-to-end confirmation that the taste-profile feature works in a real browser, mirroring Plan 2's final walkthrough.

**Files:** none (unless a defect requires a fix — then fix, add/adjust a test, and commit under the relevant module).

- [ ] **Step 1: Preconditions**

Start `npm run dev` (background) and ensure the human is logged in (see "Browser UI Verification"). Fresh tab via `tabs_context_mcp` → `tabs_create_mcp`.

- [ ] **Step 2: Cold-start state**

If the account has <5 rated coffees, navigate to `/profile` and confirm the cold-start copy ("N of 5") and that the directive editor is still present. Then seed/rate coffees (via `/coffee/add` and the rating UI) across a spread of processes and flavor notes until ≥5 are rated.

- [ ] **Step 3: First build**

Navigate to `/profile`, click **Build your profile**. Confirm: a summary paragraph renders, flavor-cluster bars appear with evidence strings matching the deterministic format ("N of M <cluster> coffees rated 4★+"), and preferred processes list with evidence. Sanity-check the top cluster/process against what you rated highly — the numbers must reflect your own ratings, not generic espresso lore.

- [ ] **Step 4: Staleness + rebuild**

Rate one more coffee (or change a rating), return to `/profile`. Confirm the **stale** banner shows the correct new-ratings count and that **Rebuild profile** produces an updated profile.

- [ ] **Step 5: Directive round-trip**

Edit goals + free text + the exclude toggle, **Save goals**, reload, confirm persistence.

- [ ] **Step 6: Console + regression sweep**

`read_console_messages` — zero React/hydration/server-action errors across the flow. Then run the full suite and typecheck to confirm nothing regressed:

```bash
npm run test:run
npx tsc --noEmit
npm run lint
```

Expected: all green.

- [ ] **Step 7: Record the walkthrough result**

Note pass/fail per step in the progress ledger. Any defect found here is fixed (with a covering test) before the branch is considered done.

---

## Self-Review (completed during planning)

- **Spec coverage:** cluster computation (Tasks 1–2), LLM prose that only phrases (Task 3), persistence + staleness derivation + directive CRUD (Task 4), `/profile` display with all four states + rebuild (Task 5), directive editor (Task 6), browser verification (Tasks 5–7). Cold-start gate, no-migration, `requireUserId` scoping, reviews-as-context-only, and named constants are all enforced across tasks and pinned in Global Constraints. ✔
- **Deferred (spec "Out of scope"):** Wrapped-style reveal, onboarding wizard, Discovery consumption, deterministic review keyword extraction — intentionally not tasked. ✔
- **Type consistency:** `TasteProfileData` / `RatedCoffee` (Task 2) are consumed unchanged by Tasks 3–5; `ProfileView` / `ProfileState` / `DirectiveView` (Task 4) are consumed unchanged by Tasks 5–6; `clusterForPhrase` / `UNCATEGORIZED` (Task 1) by Task 2; `generateProfileSummary` / `ProseGenerationError` (Task 3) by Task 4. ✔
- **No placeholders:** every code and test step contains complete, runnable content. ✔
```
