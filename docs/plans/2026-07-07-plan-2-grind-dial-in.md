# Plan 2 — Grind Dial-In Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user register grinders/machines, log espresso shots, and receive deterministic grind suggestions calibrated exclusively from their own logged shots for one exact coffee+grinder+machine combo.

**Architecture:** A numeric grind representation (`grindMacro` + `grindMicro` folded into a single `grindPosition` scalar via a per-grinder `microStepsPerMacroNotch` constant) is stored alongside the existing free-text `grindSetting`. Pure functions in `src/lib/grind/` do all the math (position derivation, OLS interpolation, new-bag baseline) with zero DB or LLM involvement. Server actions in `src/lib/actions/` scope every query to the signed-in user and delegate all math to those pure functions. Client components render equipment registration, shot logging (branching grind input), and a dial-in suggestion card.

**Tech Stack:** Next.js 16 (App Router, `--webpack`), Drizzle ORM (postgres-js), Supabase Postgres/Auth, Vitest + Testing Library, TypeScript, Tailwind.

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the Plan 2 design spec (`docs/specs/2026-07-07-plan-2-grind-dial-in-design.md`) and the parent spec's locked decisions.

- **Named constants (exact values):** `MIN_SHOTS_FOR_SUGGESTION = 5`, `MIN_SHOTS_FOR_NEW_BAG_BASELINE = 15`, `POSITIVE_OUTCOME_TAGS = ['balanced', 'excellent']`, `DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH = 6`. All live in one module, never hardcoded inline.
- **The LLM never computes the number.** Grind suggestions are deterministic math over the user's own shots only — never generic espresso heuristics, never an LLM call. (Parent spec locked decisions 1 and 2.)
- **`grindPosition` formula:** `grindMacro + grindMicro / microStepsPerMacroNotch`, or just `grindMacro` when there is no micro dial. Computed once at write time and stored; `NULL` whenever the grind setting isn't numeric.
- **Additive migration only.** Add columns to existing `equipment`/`shots` tables — never re-migrate or drop Plan 1's tables/rows.
- **drizzle-kit command form:** drizzle-kit 0.31.10 does NOT accept `--env-file`. Always run: `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs <generate|push>`.
- **Strip `auth.users` from generated migrations:** if `drizzle-kit generate` emits any `CREATE TABLE "auth"."users"` (or `CREATE SCHEMA "auth"`), delete those statements from the migration file before `push` — Supabase owns that table.
- **Authorization in app code:** every DB query is scoped by `requireUserId()`. No Postgres RLS. `equipment` and `shots` are per-user tables (`user_id` column); `coffees`/`roasters` stay shared catalog.
- **Test DB mocks use reference equality:** route mocked table queries by `table === shots` / `table === equipment`, never `table._.name` (that property doesn't exist on real drizzle-orm 0.45.2 `pgTable` objects).
- **Do not touch** `src/lib/parsing/fixtures/julioMadridCaturraNitro.ts` or its test — permanent calibration fixture.
- **Existing shot-history views keep reading `grindSetting` for display** — the numeric columns are additive, not a replacement.
- **Browser UI verification is required for every task that adds or changes a UI component** (Tasks 5, 7, 8) and once more at the end. Vitest + Testing Library is not sufficient sign-off for UI work — a component that passes jsdom tests can still be broken in a real browser (layout, hydration, server/client boundary, redirect-to-login). Drive the running app and observe the actual rendered result. See "Browser UI Verification" below for the exact procedure. This gate runs *before* the task's commit; if it surfaces a defect, fix it and re-run before committing.

---

## File Structure

**New — pure math (no DB, no React):**
- `src/lib/grind/constants.ts` — the four named constants.
- `src/lib/grind/position.ts` — `computeGrindPosition`, `formatGrindSetting`, `splitGrindPosition`, `deriveGrindFields`.
- `src/lib/grind/suggestion.ts` — `suggestGrind`, `newBagBaseline`, `decideDialInState` + their result types.
- Tests: `src/lib/grind/position.test.ts`, `src/lib/grind/suggestion.test.ts`.

**Modified — schema:**
- `src/lib/db/schema/user.ts` — add `microStepsPerMacroNotch` to `equipment`; add `grindMacro`/`grindMicro`/`grindPosition` to `shots`.
- `drizzle/0002_*.sql` (+ `drizzle/meta/*`) — generated migration.

**New — server actions:**
- `src/lib/actions/equipment.ts` (+ `.test.ts`) — `createEquipment`, `listEquipment`.
- `src/lib/actions/shots.ts` (+ `.test.ts`) — `logShot`, `listShotsForCoffee`, `getLastShot`, `getDialInState`, `listCoffeeDialIns`.

**New — UI:**
- `src/components/equipment/EquipmentForm.tsx` (+ `.test.tsx`), `src/app/equipment/page.tsx`.
- `src/components/shots/ShotForm.tsx` (+ `.test.tsx`), `src/components/shots/DialInCard.tsx`, `src/app/coffee/[id]/log/page.tsx`.
- Modified: `src/components/layout/NavBar.tsx` (Equipment link), `src/app/coffee/[id]/page.tsx` (shot history + dial-in + Log-shot CTA).

---

## Browser UI Verification (shared procedure)

Tasks 5, 7, and 8 each end with a browser pass, and Task 9 runs the full flow. Use **Claude-in-Chrome** (the MCP browser tools already wired into this environment) as the primary driver; **Playwright** is the automated alternative if the executor prefers a codified, re-runnable script (it is not installed — `npm i -D @playwright/test && npx playwright install chromium` first, and only if the human wants persistent E2E specs rather than a one-off pass).

**Preconditions (do once per session):**
1. Start the dev server in the background: `npm run dev` (already runs `next dev --webpack` per `package.json` — do not change this). It serves on `http://localhost:3000`.
2. **Auth:** every page here is behind `requireUserId()`, which redirects unauthenticated requests to `/login`. Claude-in-Chrome drives the human's existing Chrome session, so Chase must be logged in to the app in that Chrome profile first. If a navigation lands on `/login`, that is the signal to log in — not a component bug.
3. At the start of the browser pass call `tabs_context_mcp` once, then `tabs_create_mcp` for a fresh tab (never reuse a prior session's tab id).

**Per-pass procedure (fill in the route and checks from the task):**
1. `navigate` to the route under test.
2. `read_page` (or `computer` screenshot) to confirm the expected elements rendered.
3. Exercise the specific interactions the task calls out (select a grinder, toggle a control, submit the form).
4. `read_console_messages` — confirm no React hydration errors, no uncaught exceptions, no failed server-action requests.
5. Record a one-line pass/fail with what was observed. On failure, fix the component and re-run before committing the task.

**Do not** trigger `alert`/`confirm`/`prompt` dialogs — they freeze the extension. None of these components use them; keep it that way.

**Who runs this:** the browser pass is a **controller/human** activity, not an implementer-subagent one — implementer subagents don't hold the Claude-in-Chrome tools and the browser drives the human's real Chrome session. Under subagent-driven-development, run the browser pass yourself (the controller) after the implementer reports DONE and its task review is clean, before marking the task complete. If you're executing inline, run it at the task's browser step directly.

---

## Task 1: Grind math core (constants + position derivation)

**Files:**
- Create: `src/lib/grind/constants.ts`
- Create: `src/lib/grind/position.ts`
- Test: `src/lib/grind/position.test.ts`

**Interfaces:**
- Consumes: nothing (leaf module).
- Produces:
  - `MIN_SHOTS_FOR_SUGGESTION: number`, `MIN_SHOTS_FOR_NEW_BAG_BASELINE: number`, `POSITIVE_OUTCOME_TAGS: readonly ['balanced', 'excellent']`, `DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH: number` (from `constants.ts`).
  - `computeGrindPosition(macro: number | null, micro: number | null, microStepsPerMacroNotch: number | null): number | null`
  - `formatGrindSetting(macro: number, micro: number | null, microStepsPerMacroNotch: number | null): string`
  - `splitGrindPosition(position: number, microStepsPerMacroNotch: number | null): { macro: number; micro: number | null }`
  - `type GrindFields = { grindMacro: number | null; grindMicro: number | null; grindPosition: number | null; grindSetting: string }`
  - `deriveGrindFields(input: { microStepsPerMacroNotch: number | null; macroInput?: number | null; microInput?: number | null; textInput?: string }): GrindFields`

- [ ] **Step 1: Write the failing test**

Create `src/lib/grind/position.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  computeGrindPosition,
  formatGrindSetting,
  splitGrindPosition,
  deriveGrindFields,
} from './position'

describe('computeGrindPosition', () => {
  it('folds micro into macro via steps-per-notch', () => {
    expect(computeGrindPosition(12, -2, 6)).toBeCloseTo(12 - 2 / 6, 10)
  })
  it('passes macro through when there is no micro dial', () => {
    expect(computeGrindPosition(12, null, null)).toBe(12)
  })
  it('passes macro through when micro is null even if steps are set', () => {
    expect(computeGrindPosition(12, null, 6)).toBe(12)
  })
  it('returns null for a non-numeric (null macro) setting', () => {
    expect(computeGrindPosition(null, null, 6)).toBeNull()
  })
})

describe('formatGrindSetting', () => {
  it('renders "macro / micro" when the grinder has a micro dial', () => {
    expect(formatGrindSetting(12.3, -2, 6)).toBe('12.3 / -2')
  })
  it('renders a plain number for single-dial grinders', () => {
    expect(formatGrindSetting(12, null, null)).toBe('12')
  })
})

describe('splitGrindPosition', () => {
  it('splits a scalar into nearest macro notch and signed micro', () => {
    expect(splitGrindPosition(11.7, 6)).toEqual({ macro: 12, micro: -2 })
  })
  it('returns the raw position as macro for single-dial grinders', () => {
    expect(splitGrindPosition(11.73, null)).toEqual({ macro: 11.73, micro: null })
  })
})

describe('deriveGrindFields', () => {
  it('two-dial numeric path computes position and display', () => {
    expect(
      deriveGrindFields({ microStepsPerMacroNotch: 6, macroInput: 12, microInput: -2 }),
    ).toEqual({
      grindMacro: 12,
      grindMicro: -2,
      grindPosition: 12 - 2 / 6,
      grindSetting: '12 / -2',
    })
  })
  it('single-dial numeric text path sets macro = position, micro null', () => {
    expect(
      deriveGrindFields({ microStepsPerMacroNotch: null, textInput: '12.5' }),
    ).toEqual({
      grindMacro: 12.5,
      grindMicro: null,
      grindPosition: 12.5,
      grindSetting: '12.5',
    })
  })
  it('non-numeric text path leaves all numeric columns null but keeps the label', () => {
    expect(
      deriveGrindFields({ microStepsPerMacroNotch: null, textInput: 'medium-fine' }),
    ).toEqual({
      grindMacro: null,
      grindMicro: null,
      grindPosition: null,
      grindSetting: 'medium-fine',
    })
  })
  it('defaults a missing micro input to 0 on the two-dial path', () => {
    expect(
      deriveGrindFields({ microStepsPerMacroNotch: 6, macroInput: 10 }),
    ).toEqual({
      grindMacro: 10,
      grindMicro: 0,
      grindPosition: 10,
      grindSetting: '10 / 0',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/grind/position.test.ts`
Expected: FAIL — `Failed to resolve import "./position"`.

- [ ] **Step 3: Write the constants module**

Create `src/lib/grind/constants.ts`:

```ts
export const MIN_SHOTS_FOR_SUGGESTION = 5
export const MIN_SHOTS_FOR_NEW_BAG_BASELINE = 15
export const POSITIVE_OUTCOME_TAGS = ['balanced', 'excellent'] as const
export const DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH = 6
```

- [ ] **Step 4: Write the position module**

Create `src/lib/grind/position.ts`:

```ts
export function computeGrindPosition(
  macro: number | null,
  micro: number | null,
  microStepsPerMacroNotch: number | null,
): number | null {
  if (macro === null) return null
  if (microStepsPerMacroNotch === null || micro === null) return macro
  return macro + micro / microStepsPerMacroNotch
}

export function formatGrindSetting(
  macro: number,
  micro: number | null,
  microStepsPerMacroNotch: number | null,
): string {
  if (microStepsPerMacroNotch === null || micro === null) return String(macro)
  return `${macro} / ${micro}`
}

export function splitGrindPosition(
  position: number,
  microStepsPerMacroNotch: number | null,
): { macro: number; micro: number | null } {
  if (microStepsPerMacroNotch === null) return { macro: position, micro: null }
  const macro = Math.round(position)
  const micro = Math.round((position - macro) * microStepsPerMacroNotch)
  return { macro, micro }
}

export type GrindFields = {
  grindMacro: number | null
  grindMicro: number | null
  grindPosition: number | null
  grindSetting: string
}

export function deriveGrindFields(input: {
  microStepsPerMacroNotch: number | null
  macroInput?: number | null
  microInput?: number | null
  textInput?: string
}): GrindFields {
  const { microStepsPerMacroNotch, macroInput, microInput, textInput } = input

  // Two-dial numeric path: a micro-configured grinder with a macro reading.
  if (microStepsPerMacroNotch !== null && macroInput != null) {
    const micro = microInput ?? 0
    return {
      grindMacro: macroInput,
      grindMicro: micro,
      grindPosition: computeGrindPosition(macroInput, micro, microStepsPerMacroNotch),
      grindSetting: formatGrindSetting(macroInput, micro, microStepsPerMacroNotch),
    }
  }

  // Single-input path: single-dial/unconfigured grinder. Numeric if it parses,
  // otherwise a free-text label that stays interpolation-ineligible.
  const text = (textInput ?? '').trim()
  const n = Number.parseFloat(text)
  if (Number.isFinite(n)) {
    return { grindMacro: n, grindMicro: null, grindPosition: n, grindSetting: text }
  }
  return { grindMacro: null, grindMicro: null, grindPosition: null, grindSetting: text }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/lib/grind/position.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/grind/constants.ts src/lib/grind/position.ts src/lib/grind/position.test.ts
git commit -m "feat(grind): grind position derivation + tunable constants"
```

---

## Task 2: Interpolation engine (suggestion + new-bag baseline)

**Files:**
- Create: `src/lib/grind/suggestion.ts`
- Test: `src/lib/grind/suggestion.test.ts`

**Interfaces:**
- Consumes: `MIN_SHOTS_FOR_SUGGESTION`, `MIN_SHOTS_FOR_NEW_BAG_BASELINE`, `POSITIVE_OUTCOME_TAGS` (from `./constants`); `splitGrindPosition` (from `./position`).
- Produces:
  - `type ShotForSuggestion = { grindPosition: number; timeSeconds: number; outcomeTags: readonly string[] }`
  - `type GrindSuggestion = { status: 'ok'; suggestedPosition: number; display: string; targetTime: number; evidence: ShotForSuggestion[] } | { status: 'need_more_shots'; shotsLogged: number; shotsNeeded: number } | { status: 'need_positive_reference' } | { status: 'need_variation' }`
  - `type NewBagBaseline = { status: 'ok'; position: number; display: string } | { status: 'insufficient_history'; shotsLogged: number; shotsNeeded: number }`
  - `type DialInState = { kind: 'combo'; suggestion: GrindSuggestion } | { kind: 'new_bag'; baseline: NewBagBaseline }`
  - `suggestGrind(shots: ShotForSuggestion[], microStepsPerMacroNotch: number | null): GrindSuggestion` — caller passes only shots whose `grindPosition` is non-null.
  - `newBagBaseline(shots: ShotForSuggestion[], microStepsPerMacroNotch: number | null): NewBagBaseline`
  - `decideDialInState(comboShots: ShotForSuggestion[], pairShots: ShotForSuggestion[], microStepsPerMacroNotch: number | null): DialInState`

- [ ] **Step 1: Write the failing test**

Create `src/lib/grind/suggestion.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import {
  suggestGrind,
  newBagBaseline,
  decideDialInState,
  type ShotForSuggestion,
} from './suggestion'

function shot(
  grindPosition: number,
  timeSeconds: number,
  outcomeTags: string[] = [],
): ShotForSuggestion {
  return { grindPosition, timeSeconds, outcomeTags }
}

describe('suggestGrind', () => {
  it('returns need_more_shots below the 5-shot threshold', () => {
    const result = suggestGrind([shot(10, 25, ['balanced']), shot(11, 27)], null)
    expect(result).toEqual({ status: 'need_more_shots', shotsLogged: 2, shotsNeeded: 5 })
  })

  it('returns need_positive_reference when no shot is balanced/excellent', () => {
    const shots = [
      shot(10, 22, ['sour']),
      shot(11, 24, ['sour']),
      shot(12, 26, ['bitter']),
      shot(13, 28, ['weak']),
      shot(14, 30, ['harsh']),
    ]
    expect(suggestGrind(shots, null)).toEqual({ status: 'need_positive_reference' })
  })

  it('returns need_variation when all eligible shots share one position', () => {
    const shots = [
      shot(10, 22, ['balanced']),
      shot(10, 23),
      shot(10, 24),
      shot(10, 25),
      shot(10, 26),
    ]
    expect(suggestGrind(shots, null)).toEqual({ status: 'need_variation' })
  })

  it('returns need_variation when the fit is flat (would divide by zero)', () => {
    const shots = [
      shot(10, 25, ['balanced']),
      shot(11, 25),
      shot(12, 25),
      shot(13, 25),
      shot(14, 25),
    ]
    expect(suggestGrind(shots, null)).toEqual({ status: 'need_variation' })
  })

  it('fits OLS and inverts at target time from positive shots', () => {
    // time = 2*position + 2. Positives at position 10 (t=22) and 12 (t=26) -> targetTime 24.
    // Invert: position = (24 - 2) / 2 = 11.
    const shots = [
      shot(10, 22, ['balanced']),
      shot(11, 24),
      shot(12, 26, ['excellent']),
      shot(13, 28),
      shot(14, 30),
    ]
    const result = suggestGrind(shots, null)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.suggestedPosition).toBeCloseTo(11, 6)
    expect(result.targetTime).toBeCloseTo(24, 6)
    expect(result.display).toBe('11.0')
    expect(result.evidence).toHaveLength(5)
  })

  it('formats the suggestion as macro / micro for a micro-dial grinder', () => {
    const shots = [
      shot(10, 22, ['balanced']),
      shot(11, 24),
      shot(12, 26, ['excellent']),
      shot(13, 28),
      shot(14, 30),
    ]
    const result = suggestGrind(shots, 6)
    if (result.status !== 'ok') throw new Error('unreachable')
    expect(result.display).toBe('11 / 0')
  })
})

describe('newBagBaseline', () => {
  it('returns insufficient_history below the 15-shot threshold', () => {
    const shots = Array.from({ length: 14 }, (_, i) => shot(10 + i * 0.1, 25, ['balanced']))
    expect(newBagBaseline(shots, null)).toEqual({
      status: 'insufficient_history',
      shotsLogged: 14,
      shotsNeeded: 15,
    })
  })

  it('returns insufficient_history when there are no positive shots', () => {
    const shots = Array.from({ length: 20 }, () => shot(10, 25, ['sour']))
    expect(newBagBaseline(shots, null)).toEqual({
      status: 'insufficient_history',
      shotsLogged: 20,
      shotsNeeded: 15,
    })
  })

  it('returns the median position of positive shots when eligible', () => {
    const positives = [
      shot(10, 25, ['balanced']),
      shot(12, 25, ['excellent']),
      shot(14, 25, ['balanced']),
    ]
    const filler = Array.from({ length: 12 }, () => shot(9, 30, ['sour']))
    const result = newBagBaseline([...positives, ...filler], null)
    expect(result).toEqual({ status: 'ok', position: 12, display: '12.0' })
  })
})

describe('decideDialInState', () => {
  it('uses the combo suggestion when the combo has any shots', () => {
    const combo = [shot(10, 25, ['balanced'])]
    const result = decideDialInState(combo, [], null)
    expect(result.kind).toBe('combo')
  })

  it('falls back to the new-bag baseline when the combo is empty', () => {
    const pair = Array.from({ length: 15 }, () => shot(11, 25, ['balanced']))
    const result = decideDialInState([], pair, null)
    expect(result).toEqual({
      kind: 'new_bag',
      baseline: { status: 'ok', position: 11, display: '11.0' },
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/grind/suggestion.test.ts`
Expected: FAIL — `Failed to resolve import "./suggestion"`.

- [ ] **Step 3: Write the suggestion module**

Create `src/lib/grind/suggestion.ts`:

```ts
import {
  MIN_SHOTS_FOR_SUGGESTION,
  MIN_SHOTS_FOR_NEW_BAG_BASELINE,
  POSITIVE_OUTCOME_TAGS,
} from './constants'
import { splitGrindPosition } from './position'

export type ShotForSuggestion = {
  grindPosition: number
  timeSeconds: number
  outcomeTags: readonly string[]
}

export type GrindSuggestion =
  | {
      status: 'ok'
      suggestedPosition: number
      display: string
      targetTime: number
      evidence: ShotForSuggestion[]
    }
  | { status: 'need_more_shots'; shotsLogged: number; shotsNeeded: number }
  | { status: 'need_positive_reference' }
  | { status: 'need_variation' }

export type NewBagBaseline =
  | { status: 'ok'; position: number; display: string }
  | { status: 'insufficient_history'; shotsLogged: number; shotsNeeded: number }

export type DialInState =
  | { kind: 'combo'; suggestion: GrindSuggestion }
  | { kind: 'new_bag'; baseline: NewBagBaseline }

const POSITIVE: readonly string[] = POSITIVE_OUTCOME_TAGS

function isPositive(tags: readonly string[]): boolean {
  return tags.some((t) => POSITIVE.includes(t))
}

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]
}

function displayFor(position: number, microStepsPerMacroNotch: number | null): string {
  const { macro, micro } = splitGrindPosition(position, microStepsPerMacroNotch)
  return micro === null ? macro.toFixed(1) : `${macro} / ${micro}`
}

export function suggestGrind(
  shots: ShotForSuggestion[],
  microStepsPerMacroNotch: number | null,
): GrindSuggestion {
  if (shots.length < MIN_SHOTS_FOR_SUGGESTION) {
    return {
      status: 'need_more_shots',
      shotsLogged: shots.length,
      shotsNeeded: MIN_SHOTS_FOR_SUGGESTION,
    }
  }

  const positives = shots.filter((s) => isPositive(s.outcomeTags))
  if (positives.length === 0) return { status: 'need_positive_reference' }

  const distinct = new Set(shots.map((s) => s.grindPosition))
  if (distinct.size < 2) return { status: 'need_variation' }

  // Ordinary least squares: timeSeconds ~ grindPosition.
  const xs = shots.map((s) => s.grindPosition)
  const ys = shots.map((s) => s.timeSeconds)
  const xBar = mean(xs)
  const yBar = mean(ys)
  let num = 0
  let den = 0
  for (let i = 0; i < shots.length; i++) {
    num += (xs[i] - xBar) * (ys[i] - yBar)
    den += (xs[i] - xBar) ** 2
  }
  const slope = num / den
  const intercept = yBar - slope * xBar

  const targetTime = mean(positives.map((s) => s.timeSeconds))
  const suggestedPosition = (targetTime - intercept) / slope

  // A flat fit (slope 0) makes the inversion non-finite even with ≥2 distinct
  // positions — treat it as "need more varied data" rather than leaking NaN.
  if (!Number.isFinite(suggestedPosition)) return { status: 'need_variation' }

  return {
    status: 'ok',
    suggestedPosition,
    display: displayFor(suggestedPosition, microStepsPerMacroNotch),
    targetTime,
    evidence: shots,
  }
}

export function newBagBaseline(
  shots: ShotForSuggestion[],
  microStepsPerMacroNotch: number | null,
): NewBagBaseline {
  if (shots.length < MIN_SHOTS_FOR_NEW_BAG_BASELINE) {
    return {
      status: 'insufficient_history',
      shotsLogged: shots.length,
      shotsNeeded: MIN_SHOTS_FOR_NEW_BAG_BASELINE,
    }
  }
  const positives = shots.filter((s) => isPositive(s.outcomeTags))
  if (positives.length === 0) {
    return {
      status: 'insufficient_history',
      shotsLogged: shots.length,
      shotsNeeded: MIN_SHOTS_FOR_NEW_BAG_BASELINE,
    }
  }
  const position = median(positives.map((s) => s.grindPosition))
  return { status: 'ok', position, display: displayFor(position, microStepsPerMacroNotch) }
}

export function decideDialInState(
  comboShots: ShotForSuggestion[],
  pairShots: ShotForSuggestion[],
  microStepsPerMacroNotch: number | null,
): DialInState {
  if (comboShots.length > 0) {
    return { kind: 'combo', suggestion: suggestGrind(comboShots, microStepsPerMacroNotch) }
  }
  return { kind: 'new_bag', baseline: newBagBaseline(pairShots, microStepsPerMacroNotch) }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/grind/suggestion.test.ts`
Expected: PASS (all cases green).

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/grind/suggestion.ts src/lib/grind/suggestion.test.ts
git commit -m "feat(grind): OLS interpolation + new-bag baseline engine"
```

---

## Task 3: Schema additions + migration

**Files:**
- Modify: `src/lib/db/schema/user.ts` (add columns to `equipment` and `shots`)
- Create: `drizzle/0002_*.sql` + `drizzle/meta/*` (generated)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces (Drizzle column accessors used by Tasks 4 and 6):
  - `equipment.microStepsPerMacroNotch` (`micro_steps_per_macro_notch integer`, nullable)
  - `shots.grindMacro` (`grind_macro real`, nullable), `shots.grindMicro` (`grind_micro real`, nullable), `shots.grindPosition` (`grind_position real`, nullable)

- [ ] **Step 1: Add the `equipment` column**

In `src/lib/db/schema/user.ts`, inside the `equipment` table definition, add the column immediately after the `notes` line:

```ts
export const equipment = pgTable('equipment', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id),
  kind: equipmentKindEnum('kind').notNull(),
  brand: text('brand'),
  model: text('model'),
  nickname: text('nickname').notNull(),
  notes: text('notes'),
  // Plan 2: NULL = single-dial grinder (or not configured for numeric
  // interpolation). Set = secondary/micro dial exists; this many micro steps
  // equal one macro notch. Machines leave this NULL.
  microStepsPerMacroNotch: integer('micro_steps_per_macro_notch'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
})
```

- [ ] **Step 2: Add the three `shots` columns**

In the same file, inside the `shots` table definition, add the columns immediately after the `grindSetting` line:

```ts
  grindSetting: text('grind_setting').notNull(),
  // Plan 2: numeric grind representation. NULL whenever the grind setting
  // isn't numeric — those shots stay interpolation-ineligible.
  grindMacro: real('grind_macro'),
  grindMicro: real('grind_micro'),
  grindPosition: real('grind_position'),
```

(`integer` and `real` are already imported at the top of `user.ts`.)

- [ ] **Step 3: Generate the migration**

Run: `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs generate`
Expected: a new `drizzle/0002_*.sql` is written containing only `ALTER TABLE "equipment" ADD COLUMN ...` and `ALTER TABLE "shots" ADD COLUMN ...` statements.

- [ ] **Step 4: Inspect the generated SQL and strip any `auth.users` statements**

Open the new `drizzle/0002_*.sql`. Confirm it contains ONLY the four `ADD COLUMN` statements below (nullable, no defaults):

```sql
ALTER TABLE "equipment" ADD COLUMN "micro_steps_per_macro_notch" integer;
ALTER TABLE "shots" ADD COLUMN "grind_macro" real;
ALTER TABLE "shots" ADD COLUMN "grind_micro" real;
ALTER TABLE "shots" ADD COLUMN "grind_position" real;
```

If any `CREATE SCHEMA "auth"` or `CREATE TABLE "auth"."users"` statement is present, delete those lines (and their trailing `--> statement-breakpoint`) before proceeding — Supabase owns that table.

- [ ] **Step 5: Push the migration to Supabase**

Run: `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs push`
Expected: drizzle-kit reports the four columns added; no prompts about destructive changes. (If it prompts, abort — additive column adds should never be flagged destructive.)

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/db/schema/user.ts drizzle/
git commit -m "feat(db): add numeric grind columns to equipment and shots"
```

---

## Task 4: Equipment server actions

**Files:**
- Create: `src/lib/actions/equipment.ts`
- Test: `src/lib/actions/equipment.test.ts`

**Interfaces:**
- Consumes: `db` (`@/lib/db`), `equipment` table (`@/lib/db/schema`), `requireUserId` (`@/lib/auth/requireUserId`).
- Produces:
  - `type EquipmentKind = 'grinder' | 'machine'`
  - `type EquipmentInput = { kind: EquipmentKind; nickname: string; brand?: string; model?: string; notes?: string; microStepsPerMacroNotch?: number | null }`
  - `createEquipment(input: EquipmentInput): Promise<{ id: string }>`
  - `type EquipmentItem = { id: string; kind: EquipmentKind; nickname: string; brand: string | null; model: string | null; microStepsPerMacroNotch: number | null }`
  - `listEquipment(kind?: EquipmentKind): Promise<EquipmentItem[]>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/actions/equipment.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { equipment } from '@/lib/db/schema'

vi.mock('@/lib/auth/requireUserId', () => ({
  requireUserId: vi.fn().mockResolvedValue('user-1'),
}))

type Row = Record<string, unknown>
const dbState = { equipment: [] as Row[] }
let lastInsertValues: Row | null = null

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () =>
          Promise.resolve(table === equipment ? dbState.equipment : []),
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Row) => ({
        returning: () => {
          if (table !== equipment) throw new Error('unexpected insert target')
          lastInsertValues = vals
          const row = { id: 'eq-1', ...vals }
          dbState.equipment.push(row)
          return Promise.resolve([row])
        },
      }),
    }),
  },
}))

describe('createEquipment', () => {
  beforeEach(() => {
    dbState.equipment = []
    lastInsertValues = null
  })

  it('persists a grinder with its micro-steps constant and the user id', async () => {
    const { createEquipment } = await import('./equipment')
    const result = await createEquipment({
      kind: 'grinder',
      nickname: 'Daily driver',
      microStepsPerMacroNotch: 6,
    })
    expect(result.id).toBe('eq-1')
    expect(lastInsertValues).toMatchObject({
      userId: 'user-1',
      kind: 'grinder',
      nickname: 'Daily driver',
      microStepsPerMacroNotch: 6,
    })
  })

  it('stores a machine with a null micro-steps constant', async () => {
    const { createEquipment } = await import('./equipment')
    await createEquipment({ kind: 'machine', nickname: 'Silvia' })
    expect(lastInsertValues).toMatchObject({
      kind: 'machine',
      microStepsPerMacroNotch: null,
    })
  })
})

describe('listEquipment', () => {
  beforeEach(() => {
    dbState.equipment = [
      {
        id: 'eq-1',
        kind: 'grinder',
        nickname: 'Daily driver',
        brand: null,
        model: null,
        microStepsPerMacroNotch: 6,
      },
    ]
  })

  it('returns the user’s equipment rows', async () => {
    const { listEquipment } = await import('./equipment')
    const rows = await listEquipment()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ nickname: 'Daily driver', microStepsPerMacroNotch: 6 })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/actions/equipment.test.ts`
Expected: FAIL — `Failed to resolve import "./equipment"`.

- [ ] **Step 3: Write the equipment actions**

Create `src/lib/actions/equipment.ts`:

```ts
'use server'

import { eq, and, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { equipment, type equipmentKindEnum } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/requireUserId'

export type EquipmentKind = (typeof equipmentKindEnum.enumValues)[number]

export type EquipmentInput = {
  kind: EquipmentKind
  nickname: string
  brand?: string
  model?: string
  notes?: string
  microStepsPerMacroNotch?: number | null
}

export async function createEquipment(input: EquipmentInput): Promise<{ id: string }> {
  const userId = await requireUserId()

  // Only grinders carry a micro-steps constant; force machines to NULL.
  const microSteps =
    input.kind === 'grinder' ? (input.microStepsPerMacroNotch ?? null) : null

  const [created] = await db
    .insert(equipment)
    .values({
      userId,
      kind: input.kind,
      nickname: input.nickname,
      brand: input.brand ?? null,
      model: input.model ?? null,
      notes: input.notes ?? null,
      microStepsPerMacroNotch: microSteps,
    })
    .returning()

  return { id: created.id }
}

export type EquipmentItem = {
  id: string
  kind: EquipmentKind
  nickname: string
  brand: string | null
  model: string | null
  microStepsPerMacroNotch: number | null
}

export async function listEquipment(kind?: EquipmentKind): Promise<EquipmentItem[]> {
  const userId = await requireUserId()
  const whereClause = kind
    ? and(eq(equipment.userId, userId), eq(equipment.kind, kind))
    : eq(equipment.userId, userId)

  const rows = await db
    .select({
      id: equipment.id,
      kind: equipment.kind,
      nickname: equipment.nickname,
      brand: equipment.brand,
      model: equipment.model,
      microStepsPerMacroNotch: equipment.microStepsPerMacroNotch,
    })
    .from(equipment)
    .where(whereClause)
    .orderBy(asc(equipment.nickname))

  return rows
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/actions/equipment.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/actions/equipment.ts src/lib/actions/equipment.test.ts
git commit -m "feat(equipment): create/list equipment server actions"
```

---

## Task 5: Equipment registration UI

**Files:**
- Create: `src/components/equipment/EquipmentForm.tsx`
- Create: `src/app/equipment/page.tsx`
- Modify: `src/components/layout/NavBar.tsx`
- Test: `src/components/equipment/EquipmentForm.test.tsx`

**Interfaces:**
- Consumes: `createEquipment`, `listEquipment`, `type EquipmentItem` (from `@/lib/actions/equipment`); `DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH` (from `@/lib/grind/constants`).
- Produces: `EquipmentForm` React component (no props); `/equipment` route.

- [ ] **Step 1: Write the failing component test**

Create `src/components/equipment/EquipmentForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const createEquipmentMock = vi.fn().mockResolvedValue({ id: 'eq-1' })
vi.mock('@/lib/actions/equipment', () => ({
  createEquipment: createEquipmentMock,
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}))

import { EquipmentForm } from './EquipmentForm'

describe('EquipmentForm', () => {
  beforeEach(() => createEquipmentMock.mockClear())

  it('hides the micro-steps input until the micro-dial toggle is checked', async () => {
    render(<EquipmentForm />)
    expect(screen.queryByLabelText(/micro steps per macro notch/i)).toBeNull()
    await userEvent.click(screen.getByLabelText(/secondary\/micro adjustment/i))
    const input = screen.getByLabelText(/micro steps per macro notch/i)
    expect(input).toHaveValue(6) // DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH
  })

  it('does not offer the micro-dial toggle when kind is machine', async () => {
    render(<EquipmentForm />)
    await userEvent.selectOptions(screen.getByLabelText(/type/i), 'machine')
    expect(screen.queryByLabelText(/secondary\/micro adjustment/i)).toBeNull()
  })

  it('submits a grinder with the configured micro-steps constant', async () => {
    render(<EquipmentForm />)
    await userEvent.type(screen.getByLabelText(/nickname/i), 'Daily driver')
    await userEvent.click(screen.getByLabelText(/secondary\/micro adjustment/i))
    await userEvent.click(screen.getByRole('button', { name: /add equipment/i }))
    expect(createEquipmentMock).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'grinder',
        nickname: 'Daily driver',
        microStepsPerMacroNotch: 6,
      }),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/equipment/EquipmentForm.test.tsx`
Expected: FAIL — cannot resolve `./EquipmentForm`.

- [ ] **Step 3: Write the EquipmentForm component**

Create `src/components/equipment/EquipmentForm.tsx`:

```tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createEquipment, type EquipmentKind } from '@/lib/actions/equipment'
import { DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH } from '@/lib/grind/constants'

export function EquipmentForm() {
  const router = useRouter()
  const [kind, setKind] = useState<EquipmentKind>('grinder')
  const [nickname, setNickname] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [hasMicroDial, setHasMicroDial] = useState(false)
  const [microSteps, setMicroSteps] = useState(DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH)
  const [isPending, startTransition] = useTransition()

  function submit() {
    startTransition(async () => {
      await createEquipment({
        kind,
        nickname,
        brand: brand || undefined,
        model: model || undefined,
        microStepsPerMacroNotch:
          kind === 'grinder' && hasMicroDial ? microSteps : null,
      })
      setNickname('')
      setBrand('')
      setModel('')
      setHasMicroDial(false)
      setMicroSteps(DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH)
      router.refresh()
    })
  }

  return (
    <div className="flex flex-col gap-3 border rounded p-4">
      <label className="flex flex-col gap-1 text-sm">
        Type
        <select
          value={kind}
          onChange={(e) => setKind(e.target.value as EquipmentKind)}
          className="border rounded p-2"
        >
          <option value="grinder">Grinder</option>
          <option value="machine">Machine</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Nickname
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="border rounded p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Brand (optional)
        <input
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          className="border rounded p-2"
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Model (optional)
        <input
          value={model}
          onChange={(e) => setModel(e.target.value)}
          className="border rounded p-2"
        />
      </label>

      {kind === 'grinder' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={hasMicroDial}
            onChange={(e) => setHasMicroDial(e.target.checked)}
          />
          Has a secondary/micro adjustment?
        </label>
      )}

      {kind === 'grinder' && hasMicroDial && (
        <label className="flex flex-col gap-1 text-sm">
          Micro steps per macro notch
          <input
            type="number"
            value={microSteps}
            onChange={(e) => setMicroSteps(Number(e.target.value))}
            className="border rounded p-2"
          />
        </label>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={isPending || nickname.trim().length === 0}
        className="bg-black text-white rounded p-2 disabled:opacity-50"
      >
        {isPending ? 'Adding…' : 'Add equipment'}
      </button>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/equipment/EquipmentForm.test.tsx`
Expected: PASS.

- [ ] **Step 5: Write the /equipment page**

Create `src/app/equipment/page.tsx`:

```tsx
import { listEquipment } from '@/lib/actions/equipment'
import { EquipmentForm } from '@/components/equipment/EquipmentForm'

export default async function EquipmentPage() {
  const items = await listEquipment()
  const grinders = items.filter((i) => i.kind === 'grinder')
  const machines = items.filter((i) => i.kind === 'machine')

  return (
    <main className="max-w-lg mx-auto p-4 flex flex-col gap-6">
      <h1 className="text-xl font-semibold">Equipment</h1>

      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-2">Grinders</h2>
        {grinders.length === 0 ? (
          <p className="text-sm text-gray-400">No grinders yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {grinders.map((g) => (
              <li key={g.id} className="text-sm border rounded p-2">
                {g.nickname}
                {g.microStepsPerMacroNotch !== null && (
                  <span className="text-gray-400">
                    {' '}
                    · micro ÷{g.microStepsPerMacroNotch}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="text-sm font-medium text-gray-500 mb-2">Machines</h2>
        {machines.length === 0 ? (
          <p className="text-sm text-gray-400">No machines yet.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {machines.map((m) => (
              <li key={m.id} className="text-sm border rounded p-2">
                {m.nickname}
              </li>
            ))}
          </ul>
        )}
      </section>

      <EquipmentForm />
    </main>
  )
}
```

- [ ] **Step 6: Add the Equipment nav link**

In `src/components/layout/NavBar.tsx`, add a link after the "Add" link (keep existing links unchanged):

```tsx
      <Link href="/coffee/add" className="text-sm">
        Add
      </Link>
      <Link href="/equipment" className="text-sm">
        Equipment
      </Link>
```

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 8: Browser UI verification pass**

Follow the shared "Browser UI Verification" procedure. Route: `/equipment`.
Checks:
- The form renders with a Type selector, Nickname, Brand, Model.
- With Type = Grinder, the "Has a secondary/micro adjustment?" checkbox is present; checking it reveals the "Micro steps per macro notch" input pre-filled with `6`.
- Switching Type to Machine removes the micro-dial checkbox.
- Adding a grinder (with micro dial on) and a machine makes both appear in their lists, and the grinder shows `· micro ÷6`.
- The Equipment link is present in the nav and routes here.
- Console is clean (no hydration errors / failed actions).

If any check fails, fix the component and re-run this step before committing.

- [ ] **Step 9: Commit**

```bash
git add src/components/equipment/ src/app/equipment/ src/components/layout/NavBar.tsx
git commit -m "feat(equipment): registration UI with micro-dial toggle + /equipment route"
```

---

## Task 6: Shot server actions

**Files:**
- Create: `src/lib/actions/shots.ts`
- Test: `src/lib/actions/shots.test.ts`

**Interfaces:**
- Consumes: `db`, `shots`, `equipment` (`@/lib/db/schema`); `requireUserId`; `deriveGrindFields` (`@/lib/grind/position`); `decideDialInState`, `type DialInState`, `type ShotForSuggestion` (`@/lib/grind/suggestion`).
- Produces:
  - `type LogShotInput = { coffeeId: string; grinderId: string; machineId: string; doseGrams: number; yieldGrams: number; timeSeconds: number; macroInput?: number | null; microInput?: number | null; textInput?: string; outcomeTags: string[]; note?: string; rating?: number | null }`
  - `logShot(input: LogShotInput): Promise<{ id: string }>`
  - `type ShotHistoryItem = { id: string; grinderNickname: string; machineNickname: string; doseGrams: number; yieldGrams: number; timeSeconds: number; grindSetting: string; outcomeTags: string[]; rating: number | null; note: string | null; brewedAt: string }`
  - `listShotsForCoffee(coffeeId: string): Promise<ShotHistoryItem[]>`
  - `type ShotPrefill = { grinderId: string; machineId: string; doseGrams: number; yieldGrams: number } | null`
  - `getLastShot(coffeeId: string): Promise<ShotPrefill>`
  - `getDialInState(input: { coffeeId: string; grinderId: string; machineId: string }): Promise<DialInState>`
  - `type CoffeeDialIn = { grinderNickname: string; machineNickname: string; state: DialInState }`
  - `listCoffeeDialIns(coffeeId: string): Promise<CoffeeDialIn[]>`

- [ ] **Step 1: Write the failing test**

Create `src/lib/actions/shots.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { shots, equipment } from '@/lib/db/schema'

vi.mock('@/lib/auth/requireUserId', () => ({
  requireUserId: vi.fn().mockResolvedValue('user-1'),
}))

type Row = Record<string, unknown>
const dbState = {
  equipment: [] as Row[],
  shots: [] as Row[],
}
let lastShotInsert: Row | null = null

// Reference-equality routing: the mock cannot parse Drizzle where-clauses, so
// tests preload dbState with exactly the rows a query would have matched.
vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: () => ({
          orderBy: () =>
            Promise.resolve(table === equipment ? dbState.equipment : dbState.shots),
          then: (resolve: (rows: Row[]) => unknown) =>
            resolve(table === equipment ? dbState.equipment : dbState.shots),
        }),
        innerJoin: () => ({
          innerJoin: () => ({
            where: () => ({
              orderBy: () => Promise.resolve(dbState.shots),
            }),
          }),
          where: () => ({
            orderBy: () => Promise.resolve(dbState.shots),
          }),
        }),
      }),
    }),
    insert: (table: unknown) => ({
      values: (vals: Row) => ({
        returning: () => {
          if (table !== shots) throw new Error('unexpected insert target')
          lastShotInsert = vals
          return Promise.resolve([{ id: 'shot-1', ...vals }])
        },
      }),
    }),
  },
}))

describe('logShot', () => {
  beforeEach(() => {
    dbState.equipment = [{ id: 'grinder-1', microStepsPerMacroNotch: 6 }]
    dbState.shots = []
    lastShotInsert = null
  })

  it('computes grind fields for a micro-dial grinder', async () => {
    const { logShot } = await import('./shots')
    await logShot({
      coffeeId: 'coffee-1',
      grinderId: 'grinder-1',
      machineId: 'machine-1',
      doseGrams: 18,
      yieldGrams: 36,
      timeSeconds: 28,
      macroInput: 12,
      microInput: -2,
      outcomeTags: ['balanced'],
    })
    expect(lastShotInsert).toMatchObject({
      userId: 'user-1',
      grindMacro: 12,
      grindMicro: -2,
      grindSetting: '12 / -2',
    })
    expect(lastShotInsert?.grindPosition).toBeCloseTo(12 - 2 / 6, 10)
  })

  it('stores a non-numeric free-text setting with null numeric columns', async () => {
    dbState.equipment = [{ id: 'grinder-1', microStepsPerMacroNotch: null }]
    const { logShot } = await import('./shots')
    await logShot({
      coffeeId: 'coffee-1',
      grinderId: 'grinder-1',
      machineId: 'machine-1',
      doseGrams: 18,
      yieldGrams: 36,
      timeSeconds: 28,
      textInput: 'medium-fine',
      outcomeTags: [],
    })
    expect(lastShotInsert).toMatchObject({
      grindMacro: null,
      grindMicro: null,
      grindPosition: null,
      grindSetting: 'medium-fine',
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/actions/shots.test.ts`
Expected: FAIL — cannot resolve `./shots`.

- [ ] **Step 3: Write the shots actions**

Create `src/lib/actions/shots.ts`:

```ts
'use server'

import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { shots, equipment } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/requireUserId'
import { deriveGrindFields } from '@/lib/grind/position'
import {
  decideDialInState,
  type DialInState,
  type ShotForSuggestion,
} from '@/lib/grind/suggestion'

export type LogShotInput = {
  coffeeId: string
  grinderId: string
  machineId: string
  doseGrams: number
  yieldGrams: number
  timeSeconds: number
  macroInput?: number | null
  microInput?: number | null
  textInput?: string
  outcomeTags: string[]
  note?: string
  rating?: number | null
}

async function grinderMicroSteps(
  userId: string,
  grinderId: string,
): Promise<number | null> {
  const rows = await db
    .select({ microStepsPerMacroNotch: equipment.microStepsPerMacroNotch })
    .from(equipment)
    .where(and(eq(equipment.userId, userId), eq(equipment.id, grinderId)))
  return rows[0]?.microStepsPerMacroNotch ?? null
}

export async function logShot(input: LogShotInput): Promise<{ id: string }> {
  const userId = await requireUserId()
  const microSteps = await grinderMicroSteps(userId, input.grinderId)

  const grind = deriveGrindFields({
    microStepsPerMacroNotch: microSteps,
    macroInput: input.macroInput,
    microInput: input.microInput,
    textInput: input.textInput,
  })

  const [created] = await db
    .insert(shots)
    .values({
      userId,
      coffeeId: input.coffeeId,
      grinderId: input.grinderId,
      machineId: input.machineId,
      doseGrams: input.doseGrams,
      yieldGrams: input.yieldGrams,
      timeSeconds: input.timeSeconds,
      grindSetting: grind.grindSetting,
      grindMacro: grind.grindMacro,
      grindMicro: grind.grindMicro,
      grindPosition: grind.grindPosition,
      outcomeTags: input.outcomeTags as (typeof shots.$inferInsert)['outcomeTags'],
      note: input.note ?? null,
      rating: input.rating ?? null,
    })
    .returning()

  return { id: created.id }
}

export type ShotHistoryItem = {
  id: string
  grinderNickname: string
  machineNickname: string
  doseGrams: number
  yieldGrams: number
  timeSeconds: number
  grindSetting: string
  outcomeTags: string[]
  rating: number | null
  note: string | null
  brewedAt: string
}

export async function listShotsForCoffee(coffeeId: string): Promise<ShotHistoryItem[]> {
  const userId = await requireUserId()

  const rows = await db
    .select({
      id: shots.id,
      grinderId: shots.grinderId,
      machineId: shots.machineId,
      doseGrams: shots.doseGrams,
      yieldGrams: shots.yieldGrams,
      timeSeconds: shots.timeSeconds,
      grindSetting: shots.grindSetting,
      outcomeTags: shots.outcomeTags,
      rating: shots.rating,
      note: shots.note,
      brewedAt: shots.brewedAt,
    })
    .from(shots)
    .where(and(eq(shots.userId, userId), eq(shots.coffeeId, coffeeId)))
    .orderBy(desc(shots.brewedAt))

  const equip = await db
    .select({
      id: equipment.id,
      nickname: equipment.nickname,
    })
    .from(equipment)
    .where(eq(equipment.userId, userId))
  const nameOf = new Map(equip.map((e) => [e.id, e.nickname]))

  return rows.map((r) => ({
    id: r.id,
    grinderNickname: nameOf.get(r.grinderId) ?? 'Unknown grinder',
    machineNickname: nameOf.get(r.machineId) ?? 'Unknown machine',
    doseGrams: r.doseGrams,
    yieldGrams: r.yieldGrams,
    timeSeconds: r.timeSeconds,
    grindSetting: r.grindSetting,
    outcomeTags: r.outcomeTags,
    rating: r.rating,
    note: r.note,
    brewedAt: r.brewedAt.toISOString(),
  }))
}

export type ShotPrefill = {
  grinderId: string
  machineId: string
  doseGrams: number
  yieldGrams: number
} | null

export async function getLastShot(coffeeId: string): Promise<ShotPrefill> {
  const userId = await requireUserId()
  const rows = await db
    .select({
      grinderId: shots.grinderId,
      machineId: shots.machineId,
      doseGrams: shots.doseGrams,
      yieldGrams: shots.yieldGrams,
    })
    .from(shots)
    .where(and(eq(shots.userId, userId), eq(shots.coffeeId, coffeeId)))
    .orderBy(desc(shots.brewedAt))
  return rows[0] ?? null
}

function toSuggestionShots(
  rows: { grindPosition: number | null; timeSeconds: number; outcomeTags: string[] }[],
): ShotForSuggestion[] {
  return rows
    .filter((r) => r.grindPosition !== null)
    .map((r) => ({
      grindPosition: r.grindPosition as number,
      timeSeconds: r.timeSeconds,
      outcomeTags: r.outcomeTags,
    }))
}

async function computeDialIn(
  userId: string,
  coffeeId: string,
  grinderId: string,
  machineId: string,
): Promise<DialInState> {
  const microSteps = await grinderMicroSteps(userId, grinderId)

  const comboRows = await db
    .select({
      grindPosition: shots.grindPosition,
      timeSeconds: shots.timeSeconds,
      outcomeTags: shots.outcomeTags,
    })
    .from(shots)
    .where(
      and(
        eq(shots.userId, userId),
        eq(shots.coffeeId, coffeeId),
        eq(shots.grinderId, grinderId),
        eq(shots.machineId, machineId),
      ),
    )

  const pairRows = await db
    .select({
      grindPosition: shots.grindPosition,
      timeSeconds: shots.timeSeconds,
      outcomeTags: shots.outcomeTags,
    })
    .from(shots)
    .where(
      and(
        eq(shots.userId, userId),
        eq(shots.grinderId, grinderId),
        eq(shots.machineId, machineId),
      ),
    )

  return decideDialInState(
    toSuggestionShots(comboRows),
    toSuggestionShots(pairRows),
    microSteps,
  )
}

export async function getDialInState(input: {
  coffeeId: string
  grinderId: string
  machineId: string
}): Promise<DialInState> {
  const userId = await requireUserId()
  return computeDialIn(userId, input.coffeeId, input.grinderId, input.machineId)
}

export type CoffeeDialIn = {
  grinderNickname: string
  machineNickname: string
  state: DialInState
}

export async function listCoffeeDialIns(coffeeId: string): Promise<CoffeeDialIn[]> {
  const userId = await requireUserId()

  const comboRows = await db
    .select({ grinderId: shots.grinderId, machineId: shots.machineId })
    .from(shots)
    .where(and(eq(shots.userId, userId), eq(shots.coffeeId, coffeeId)))

  const seen = new Set<string>()
  const combos: { grinderId: string; machineId: string }[] = []
  for (const r of comboRows) {
    const key = `${r.grinderId}|${r.machineId}`
    if (!seen.has(key)) {
      seen.add(key)
      combos.push({ grinderId: r.grinderId, machineId: r.machineId })
    }
  }

  const equip = await db
    .select({ id: equipment.id, nickname: equipment.nickname })
    .from(equipment)
    .where(eq(equipment.userId, userId))
  const nameOf = new Map(equip.map((e) => [e.id, e.nickname]))

  const results: CoffeeDialIn[] = []
  for (const c of combos) {
    results.push({
      grinderNickname: nameOf.get(c.grinderId) ?? 'Unknown grinder',
      machineNickname: nameOf.get(c.machineId) ?? 'Unknown machine',
      state: await computeDialIn(userId, coffeeId, c.grinderId, c.machineId),
    })
  }
  return results
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/actions/shots.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck and commit**

Run: `npm run typecheck`
Expected: no errors.

```bash
git add src/lib/actions/shots.ts src/lib/actions/shots.test.ts
git commit -m "feat(shots): log/list shots + dial-in state server actions"
```

---

## Task 7: Shot logging UI (branching grind input + dial-in card)

**Files:**
- Create: `src/components/shots/DialInCard.tsx`
- Create: `src/components/shots/ShotForm.tsx`
- Create: `src/app/coffee/[id]/log/page.tsx`
- Test: `src/components/shots/ShotForm.test.tsx`

**Interfaces:**
- Consumes: `logShot`, `getDialInState`, `type LogShotInput`, `type ShotPrefill`, `type CoffeeDialIn` (`@/lib/actions/shots`); `listEquipment`, `type EquipmentItem` (`@/lib/actions/equipment`); `type DialInState`, `type GrindSuggestion`, `type NewBagBaseline` (`@/lib/grind/suggestion`).
- Produces:
  - `DialInCard` component: props `{ state: DialInState }`.
  - `ShotForm` component: props `{ coffeeId: string; grinders: EquipmentItem[]; machines: EquipmentItem[]; prefill: ShotPrefill }`.
  - `/coffee/[id]/log` route.

- [ ] **Step 1: Write the DialInCard component**

Create `src/components/shots/DialInCard.tsx`:

```tsx
import type { DialInState } from '@/lib/grind/suggestion'

export function DialInCard({ state }: { state: DialInState }) {
  if (state.kind === 'new_bag') {
    const b = state.baseline
    if (b.status === 'insufficient_history') {
      return (
        <div className="border rounded p-3 text-sm text-gray-500">
          New coffee on this grinder — log shots to build a suggestion (or reach{' '}
          {b.shotsNeeded} total on this grinder + machine for a rough starting point).
        </div>
      )
    }
    return (
      <div className="border rounded p-3 text-sm bg-amber-50">
        <p className="font-medium">Rough starting point: {b.display}</p>
        <p className="text-gray-500">
          Estimated from your balanced/excellent shots on this grinder + machine
          (any coffee). Not yet calibrated to this coffee.
        </p>
      </div>
    )
  }

  const s = state.suggestion
  if (s.status === 'need_more_shots') {
    return (
      <div className="border rounded p-3 text-sm text-gray-500">
        Log {s.shotsNeeded - s.shotsLogged} more shot
        {s.shotsNeeded - s.shotsLogged === 1 ? '' : 's'} on this combo to unlock a
        suggestion ({s.shotsLogged}/{s.shotsNeeded}).
      </div>
    )
  }
  if (s.status === 'need_positive_reference') {
    return (
      <div className="border rounded p-3 text-sm text-gray-500">
        Log a shot you rate balanced or excellent to activate suggestions.
      </div>
    )
  }
  if (s.status === 'need_variation') {
    return (
      <div className="border rounded p-3 text-sm text-gray-500">
        Try a shot at a different setting to unlock suggestions.
      </div>
    )
  }

  return (
    <div className="border rounded p-3 text-sm bg-green-50">
      <p className="font-medium">
        Suggested grind: {s.display} → ~{Math.round(s.targetTime)}s
      </p>
      <ul className="mt-2 text-gray-600">
        {s.evidence.map((e, i) => (
          <li key={i}>
            setting {e.grindPosition} → {e.timeSeconds}s
            {e.outcomeTags.length > 0 && ` (${e.outcomeTags.join(', ')})`}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

- [ ] **Step 2: Write the failing ShotForm test**

Create `src/components/shots/ShotForm.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { EquipmentItem } from '@/lib/actions/equipment'

const logShotMock = vi.fn().mockResolvedValue({ id: 'shot-1' })
const getDialInStateMock = vi
  .fn()
  .mockResolvedValue({ kind: 'new_bag', baseline: { status: 'insufficient_history', shotsLogged: 0, shotsNeeded: 15 } })
vi.mock('@/lib/actions/shots', () => ({
  logShot: logShotMock,
  getDialInState: getDialInStateMock,
}))
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))

import { ShotForm } from './ShotForm'

const machine: EquipmentItem = {
  id: 'machine-1',
  kind: 'machine',
  nickname: 'Silvia',
  brand: null,
  model: null,
  microStepsPerMacroNotch: null,
}
const microGrinder: EquipmentItem = {
  id: 'grinder-micro',
  kind: 'grinder',
  nickname: 'Micro dialed',
  brand: null,
  model: null,
  microStepsPerMacroNotch: 6,
}
const singleGrinder: EquipmentItem = {
  id: 'grinder-single',
  kind: 'grinder',
  nickname: 'Single dial',
  brand: null,
  model: null,
  microStepsPerMacroNotch: null,
}

describe('ShotForm', () => {
  beforeEach(() => {
    logShotMock.mockClear()
    getDialInStateMock.mockClear()
  })

  it('renders one grind field for a single-dial grinder', async () => {
    render(
      <ShotForm
        coffeeId="coffee-1"
        grinders={[singleGrinder]}
        machines={[machine]}
        prefill={null}
      />,
    )
    expect(screen.getByLabelText(/^grind setting$/i)).toBeInTheDocument()
    expect(screen.queryByLabelText(/micro adjust/i)).toBeNull()
  })

  it('renders macro + micro fields for a micro-dial grinder', async () => {
    render(
      <ShotForm
        coffeeId="coffee-1"
        grinders={[microGrinder]}
        machines={[machine]}
        prefill={null}
      />,
    )
    expect(screen.getByLabelText(/grind \(macro\)/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/micro adjust/i)).toBeInTheDocument()
  })

  it('submits macro/micro values for a micro-dial grinder', async () => {
    render(
      <ShotForm
        coffeeId="coffee-1"
        grinders={[microGrinder]}
        machines={[machine]}
        prefill={null}
      />,
    )
    await userEvent.type(screen.getByLabelText(/dose/i), '18')
    await userEvent.type(screen.getByLabelText(/yield/i), '36')
    await userEvent.type(screen.getByLabelText(/time/i), '28')
    await userEvent.type(screen.getByLabelText(/grind \(macro\)/i), '12')
    await userEvent.type(screen.getByLabelText(/micro adjust/i), '-2')
    await userEvent.click(screen.getByRole('button', { name: /save shot/i }))

    expect(logShotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        coffeeId: 'coffee-1',
        grinderId: 'grinder-micro',
        machineId: 'machine-1',
        doseGrams: 18,
        yieldGrams: 36,
        timeSeconds: 28,
        macroInput: 12,
        microInput: -2,
      }),
    )
  })

  it('submits a free-text grind setting for a single-dial grinder', async () => {
    render(
      <ShotForm
        coffeeId="coffee-1"
        grinders={[singleGrinder]}
        machines={[machine]}
        prefill={null}
      />,
    )
    await userEvent.type(screen.getByLabelText(/dose/i), '18')
    await userEvent.type(screen.getByLabelText(/yield/i), '36')
    await userEvent.type(screen.getByLabelText(/time/i), '28')
    await userEvent.type(screen.getByLabelText(/^grind setting$/i), 'medium-fine')
    await userEvent.click(screen.getByRole('button', { name: /save shot/i }))

    expect(logShotMock).toHaveBeenCalledWith(
      expect.objectContaining({
        grinderId: 'grinder-single',
        textInput: 'medium-fine',
      }),
    )
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/components/shots/ShotForm.test.tsx`
Expected: FAIL — cannot resolve `./ShotForm`.

- [ ] **Step 4: Write the ShotForm component**

Create `src/components/shots/ShotForm.tsx`:

```tsx
'use client'

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { logShot, getDialInState } from '@/lib/actions/shots'
import type { ShotPrefill } from '@/lib/actions/shots'
import type { EquipmentItem } from '@/lib/actions/equipment'
import type { DialInState } from '@/lib/grind/suggestion'
import { DialInCard } from './DialInCard'

const OUTCOME_TAGS = [
  'sour',
  'bitter',
  'weak',
  'harsh',
  'balanced',
  'excellent',
] as const

function toNumber(value: string): number {
  return Number.parseFloat(value)
}

export function ShotForm({
  coffeeId,
  grinders,
  machines,
  prefill,
}: {
  coffeeId: string
  grinders: EquipmentItem[]
  machines: EquipmentItem[]
  prefill: ShotPrefill
}) {
  const router = useRouter()
  const [grinderId, setGrinderId] = useState(prefill?.grinderId ?? grinders[0]?.id ?? '')
  const [machineId, setMachineId] = useState(prefill?.machineId ?? machines[0]?.id ?? '')
  const [dose, setDose] = useState(prefill ? String(prefill.doseGrams) : '')
  const [yieldG, setYieldG] = useState(prefill ? String(prefill.yieldGrams) : '')
  const [time, setTime] = useState('')
  const [macro, setMacro] = useState('')
  const [micro, setMicro] = useState('')
  const [grindText, setGrindText] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [note, setNote] = useState('')
  const [dialIn, setDialIn] = useState<DialInState | null>(null)
  const [isPending, startTransition] = useTransition()

  const grinder = grinders.find((g) => g.id === grinderId) ?? null
  const hasMicroDial = grinder?.microStepsPerMacroNotch != null

  // Refresh the dial-in card whenever the combo (coffee is fixed) changes.
  useEffect(() => {
    if (!grinderId || !machineId) return
    let cancelled = false
    getDialInState({ coffeeId, grinderId, machineId }).then((state) => {
      if (!cancelled) setDialIn(state)
    })
    return () => {
      cancelled = true
    }
  }, [coffeeId, grinderId, machineId])

  function toggleTag(tag: string) {
    setTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]))
  }

  function submit() {
    startTransition(async () => {
      await logShot({
        coffeeId,
        grinderId,
        machineId,
        doseGrams: toNumber(dose),
        yieldGrams: toNumber(yieldG),
        timeSeconds: toNumber(time),
        ...(hasMicroDial
          ? {
              macroInput: toNumber(macro),
              microInput: micro === '' ? 0 : toNumber(micro),
            }
          : { textInput: grindText }),
        outcomeTags: tags,
        note: note || undefined,
      })
      router.push(`/coffee/${coffeeId}`)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {dialIn && <DialInCard state={dialIn} />}

      <label className="flex flex-col gap-1 text-sm">
        Grinder
        <select
          value={grinderId}
          onChange={(e) => setGrinderId(e.target.value)}
          className="border rounded p-2"
        >
          {grinders.map((g) => (
            <option key={g.id} value={g.id}>
              {g.nickname}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Machine
        <select
          value={machineId}
          onChange={(e) => setMachineId(e.target.value)}
          className="border rounded p-2"
        >
          {machines.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nickname}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Dose (g)
        <input value={dose} onChange={(e) => setDose(e.target.value)} inputMode="decimal" className="border rounded p-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Yield (g)
        <input value={yieldG} onChange={(e) => setYieldG(e.target.value)} inputMode="decimal" className="border rounded p-2" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Time (s)
        <input value={time} onChange={(e) => setTime(e.target.value)} inputMode="decimal" className="border rounded p-2" />
      </label>

      {hasMicroDial ? (
        <div className="flex gap-3">
          <label className="flex flex-col gap-1 text-sm flex-1">
            Grind (macro)
            <input value={macro} onChange={(e) => setMacro(e.target.value)} inputMode="decimal" className="border rounded p-2" />
          </label>
          <label className="flex flex-col gap-1 text-sm flex-1">
            Micro adjust
            <input value={micro} onChange={(e) => setMicro(e.target.value)} inputMode="decimal" className="border rounded p-2" />
          </label>
        </div>
      ) : (
        <label className="flex flex-col gap-1 text-sm">
          Grind setting
          <input value={grindText} onChange={(e) => setGrindText(e.target.value)} className="border rounded p-2" />
        </label>
      )}

      <fieldset className="flex flex-wrap gap-2">
        {OUTCOME_TAGS.map((tag) => (
          <button
            type="button"
            key={tag}
            onClick={() => toggleTag(tag)}
            className={`text-xs rounded-full px-3 py-1 border ${
              tags.includes(tag) ? 'bg-black text-white' : 'bg-white'
            }`}
          >
            {tag}
          </button>
        ))}
      </fieldset>

      <label className="flex flex-col gap-1 text-sm">
        Note (optional)
        <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} className="border rounded p-2" />
      </label>

      <button
        type="button"
        onClick={submit}
        disabled={isPending || !grinderId || !machineId}
        className="bg-black text-white rounded p-2 disabled:opacity-50"
      >
        {isPending ? 'Saving…' : 'Save shot'}
      </button>
    </div>
  )
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/components/shots/ShotForm.test.tsx`
Expected: PASS. (The `getDialInState` mock resolves to an insufficient-history baseline; the card renders without affecting the submit assertions.)

- [ ] **Step 6: Write the /coffee/[id]/log page**

Create `src/app/coffee/[id]/log/page.tsx`:

```tsx
import Link from 'next/link'
import { listEquipment } from '@/lib/actions/equipment'
import { getLastShot } from '@/lib/actions/shots'
import { ShotForm } from '@/components/shots/ShotForm'

export default async function LogShotPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [grinders, machines, prefill] = await Promise.all([
    listEquipment('grinder'),
    listEquipment('machine'),
    getLastShot(id),
  ])

  if (grinders.length === 0 || machines.length === 0) {
    return (
      <main className="max-w-lg mx-auto p-4">
        <h1 className="text-xl font-semibold mb-2">Log shot</h1>
        <p className="text-sm text-gray-600">
          Add at least one grinder and one machine first.{' '}
          <Link href="/equipment" className="underline">
            Go to Equipment
          </Link>
        </p>
      </main>
    )
  }

  return (
    <main className="max-w-lg mx-auto p-4">
      <h1 className="text-xl font-semibold mb-3">Log shot</h1>
      <ShotForm coffeeId={id} grinders={grinders} machines={machines} prefill={prefill} />
    </main>
  )
}
```

- [ ] **Step 7: Typecheck and lint**

Run: `npm run typecheck && npm run lint`
Expected: no errors.

- [ ] **Step 8: Browser UI verification pass**

Follow the shared "Browser UI Verification" procedure. Route: `/coffee/<a real coffee id>/log` (grab an id from `/library` → a coffee, or the URL after adding one).
Checks:
- With no equipment yet, the page shows the "Add at least one grinder and one machine first" message linking to `/equipment`. (If equipment already exists, skip to the next check.)
- With a micro-dial grinder selected, two grind inputs render ("Grind (macro)" + "Micro adjust"); selecting a single-dial grinder swaps to one "Grind setting" input.
- The dial-in card renders above the form and reflects state (e.g. the "log N more shots" gating message for a fresh combo).
- Filling dose/yield/time + grind + an outcome tag and clicking "Save shot" redirects to `/coffee/<id>` and the shot appears in history.
- Console is clean.

If any check fails, fix the component and re-run this step before committing.

- [ ] **Step 9: Commit**

```bash
git add src/components/shots/ src/app/coffee/[id]/log/
git commit -m "feat(shots): shot logging UI with branching grind input + dial-in card"
```

---

## Task 8: Coffee detail integration (shot history + dial-in + Log-shot CTA)

**Files:**
- Modify: `src/app/coffee/[id]/page.tsx`
- Test: `src/app/coffee/[id]/page.test.tsx` (new — renders the server component's history/dial-in sections against mocked actions)

**Interfaces:**
- Consumes: `listShotsForCoffee`, `listCoffeeDialIns`, `type ShotHistoryItem`, `type CoffeeDialIn` (`@/lib/actions/shots`); `DialInCard` (`@/components/shots/DialInCard`); existing `getCoffeeDetail` (`@/lib/actions/coffee`).
- Produces: updated `/coffee/[id]` route rendering a "Log shot" link, per-combo dial-in cards, and a shot-history list.

- [ ] **Step 1: Write the failing test**

Create `src/app/coffee/[id]/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

const getCoffeeDetailMock = vi.fn()
const listShotsForCoffeeMock = vi.fn()
const listCoffeeDialInsMock = vi.fn()

vi.mock('@/lib/actions/coffee', () => ({ getCoffeeDetail: getCoffeeDetailMock }))
vi.mock('@/lib/actions/shots', () => ({
  listShotsForCoffee: listShotsForCoffeeMock,
  listCoffeeDialIns: listCoffeeDialInsMock,
}))
vi.mock('@/components/coffee/RateReviewForm', () => ({
  RateReviewForm: () => null,
}))

import CoffeeDetailPage from './page'

describe('CoffeeDetailPage shot sections', () => {
  beforeEach(() => {
    getCoffeeDetailMock.mockResolvedValue({
      id: 'coffee-1',
      name: 'Test Coffee',
      roasterName: 'Test Roaster',
      originCountry: null,
      originRegion: null,
      producer: null,
      variety: null,
      process: null,
      processDetail: null,
      tastingNotes: [],
      rating: null,
      review: null,
      status: 'owned',
    })
    listCoffeeDialInsMock.mockResolvedValue([])
  })

  it('renders logged shots and a Log-shot link', async () => {
    listShotsForCoffeeMock.mockResolvedValue([
      {
        id: 'shot-1',
        grinderNickname: 'Daily driver',
        machineNickname: 'Silvia',
        doseGrams: 18,
        yieldGrams: 36,
        timeSeconds: 28,
        grindSetting: '12 / -2',
        outcomeTags: ['balanced'],
        rating: null,
        note: null,
        brewedAt: '2026-07-07T00:00:00.000Z',
      },
    ])
    const ui = await CoffeeDetailPage({ params: Promise.resolve({ id: 'coffee-1' }) })
    render(ui)
    expect(screen.getByText('12 / -2')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /log shot/i })).toHaveAttribute(
      'href',
      '/coffee/coffee-1/log',
    )
  })

  it('shows an empty-state when there are no shots', async () => {
    listShotsForCoffeeMock.mockResolvedValue([])
    const ui = await CoffeeDetailPage({ params: Promise.resolve({ id: 'coffee-1' }) })
    render(ui)
    expect(screen.getByText(/no shots logged yet/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run "src/app/coffee/[id]/page.test.tsx"`
Expected: FAIL — the current page renders neither the shot list, the empty-state, nor the Log-shot link.

- [ ] **Step 3: Update the coffee detail page**

Replace `src/app/coffee/[id]/page.tsx` with:

```tsx
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCoffeeDetail } from '@/lib/actions/coffee'
import { listShotsForCoffee, listCoffeeDialIns } from '@/lib/actions/shots'
import { RateReviewForm } from '@/components/coffee/RateReviewForm'
import { DialInCard } from '@/components/shots/DialInCard'

export default async function CoffeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const coffee = await getCoffeeDetail(id)
  if (!coffee) notFound()

  const [shots, dialIns] = await Promise.all([
    listShotsForCoffee(id),
    listCoffeeDialIns(id),
  ])

  return (
    <main className="max-w-lg mx-auto p-4">
      <p className="text-sm text-gray-500">{coffee.roasterName}</p>
      <h1 className="text-xl font-semibold">{coffee.name}</h1>

      <dl className="mt-3 text-sm grid grid-cols-2 gap-1">
        {coffee.originCountry && (
          <>
            <dt className="text-gray-500">Origin</dt>
            <dd>
              {[coffee.originCountry, coffee.originRegion].filter(Boolean).join(', ')}
            </dd>
          </>
        )}
        {coffee.variety && (
          <>
            <dt className="text-gray-500">Variety</dt>
            <dd>{coffee.variety}</dd>
          </>
        )}
        {coffee.process && (
          <>
            <dt className="text-gray-500">Process</dt>
            <dd>{coffee.processDetail ?? coffee.process}</dd>
          </>
        )}
      </dl>

      {coffee.tastingNotes.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1">
          {coffee.tastingNotes.map((note) => (
            <span key={note} className="text-xs bg-gray-100 rounded-full px-2 py-1">
              {note}
            </span>
          ))}
        </div>
      )}

      <RateReviewForm
        coffeeId={coffee.id}
        initialRating={coffee.rating}
        initialReview={coffee.review}
      />

      <section className="mt-6 border-t pt-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-gray-500">Dial-in</h2>
          <Link
            href={`/coffee/${coffee.id}/log`}
            className="text-sm bg-black text-white rounded px-3 py-1"
          >
            Log shot
          </Link>
        </div>

        {dialIns.length > 0 && (
          <div className="mt-3 flex flex-col gap-3">
            {dialIns.map((d, i) => (
              <div key={i}>
                <p className="text-xs text-gray-400 mb-1">
                  {d.grinderNickname} · {d.machineNickname}
                </p>
                <DialInCard state={d.state} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-gray-500 mb-2">Shot history</h2>
        {shots.length === 0 ? (
          <p className="text-sm text-gray-400">No shots logged yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {shots.map((s) => (
              <li key={s.id} className="border rounded p-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium">{s.grindSetting}</span>
                  <span className="text-gray-500">
                    {s.doseGrams}g → {s.yieldGrams}g · {s.timeSeconds}s
                  </span>
                </div>
                <div className="text-xs text-gray-400">
                  {s.grinderNickname} · {s.machineNickname}
                  {s.outcomeTags.length > 0 && ` · ${s.outcomeTags.join(', ')}`}
                </div>
                {s.note && <p className="text-xs mt-1">{s.note}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run "src/app/coffee/[id]/page.test.tsx"`
Expected: PASS.

- [ ] **Step 5: Run the full suite, typecheck, lint**

Run: `npm run test:run && npm run typecheck && npm run lint`
Expected: all tests pass; no type or lint errors. (Confirms the permanent Julio Madrid fixture test in `src/lib/parsing/parseListing.test.ts` is still green and untouched.)

- [ ] **Step 6: Browser UI verification pass**

Follow the shared "Browser UI Verification" procedure. Route: `/coffee/<a coffee id with ≥1 logged shot>`.
Checks:
- The "Dial-in" section renders with a "Log shot" button linking to `/coffee/<id>/log`.
- For a coffee with logged shots, per-combo dial-in cards render (labeled `grinder · machine`); for a coffee with none, the "No shots logged yet" empty-state shows and no dial-in cards appear.
- The shot-history list shows each shot's `grindSetting`, dose→yield·time, and grinder·machine line.
- Console is clean.

If any check fails, fix the component and re-run this step before committing.

- [ ] **Step 7: Commit**

```bash
git add "src/app/coffee/[id]/page.tsx" "src/app/coffee/[id]/page.test.tsx"
git commit -m "feat(coffee): shot history + dial-in cards + log-shot CTA on detail"
```

---

## Task 9: Full-flow browser walkthrough (end-to-end UI pass)

**Files:** none (verification only — no commit unless a defect is found and fixed).

**Interfaces:** exercises the whole Plan 2 surface end-to-end in a real browser.

This is the final UI pass across the assembled feature, distinct from the per-task passes (which verified one component in isolation). Follow the shared "Browser UI Verification" procedure with the dev server running and an authenticated session.

- [x] **Step 1: Equipment round-trip**

At `/equipment`, add a grinder with the micro-dial toggle on (steps = `6`) and a machine. Confirm both persist and the grinder shows `· micro ÷6`.

- [x] **Step 2: Drive a combo from cold-start to a live suggestion**

Pick a coffee. At `/coffee/<id>/log`, log ≥5 shots on the *same* grinder+machine at ≥2 distinct grind positions, with ≥1 tagged `balanced` or `excellent`. Confirm the dial-in card walks through the gating states as data accrues:
- <5 shots → "log N more shots…"
- ≥5 but no positive tag → "log a shot you rate balanced or excellent…"
- ≥5, positive, but all one position → "try a shot at a different setting…"
- eligible → a `display → ~Ns` suggestion with the evidence list.

- [x] **Step 3: New-bag baseline**

Once the grinder+machine pair has ≥15 total shots (across any coffee) including a positive-tagged one, open a *different* coffee with zero shots on that pair at `/coffee/<newId>/log`. Confirm the card shows the "Rough starting point: <display>" baseline (clearly labeled as an estimate), and that it's replaced by a combo suggestion the moment that new combo gets its own shots.

- [x] **Step 4: Coffee detail integration**

On a coffee with logged shots, confirm the detail page shows per-combo dial-in cards and the shot-history list, and the "Log shot" CTA routes to the log form.

- [x] **Step 5: Console + regression sweep**

Across the above, confirm the console stays clean (no hydration errors, no failed server actions). Then run the full non-UI suite once more: `npm run test:run && npm run typecheck && npm run lint` — all green, permanent Julio Madrid fixture test still passing.

- [x] **Step 6: Record results**

Write a short pass/fail summary of each step. If any step required a code fix, commit it with a `fix(...)` message and note it; otherwise no commit for this task.

---

## Still owed to Chase (genuinely manual / device-only)

- Real-device PWA behavior for the new routes (offline shell, install affordance) if that matters for this milestone.
- Any check requiring hardware or a data volume that's impractical to seed by hand during the walkthrough above.

---

## Self-Review (completed by plan author)

**Spec coverage:**
- Schema additions (`microStepsPerMacroNotch`, `grindMacro`/`grindMicro`/`grindPosition`) → Task 3.
- `grindPosition` computed at write time, null for non-numeric → Task 1 (`deriveGrindFields`) + Task 6 (`logShot`).
- Equipment registration micro-dial toggle defaulting to 6 → Task 5.
- Shot form branching on `microStepsPerMacroNotch` → Task 7.
- Interpolation eligibility (≥5 shots, ≥1 positive, ≥2 distinct positions) + OLS + invert-at-target + evidence → Task 2.
- New-bag baseline (≥15 pair shots, median of positive positions) → Task 2 + Task 6 (`listCoffeeDialIns`/`getDialInState`).
- Named constants module → Task 1.
- Error handling: all-identical positions (need_variation), non-numeric logs succeed silently (deriveGrindFields), micro-steps edits don't retro-recompute (grindPosition stored, never recomputed on read) → Tasks 1/2/6.
- Testing strategy (grindPosition unit, suggestion unit, form component) → Tasks 1, 2, 5, 7.
- Equipment + shot logging UI (parent-spec Plan 2 scope beyond the design doc's deltas) → Tasks 4–8.
- Browser UI verification via Claude-in-Chrome (Playwright optional) after each UI component and a full end-to-end pass → per-task Steps in Tasks 5/7/8 + Task 9.

**Deviations flagged for the reviewer/human:**
- The design doc's "≥2 distinct values" guard prevents an OLS *denominator* of zero but not a zero *slope* (flat fit), which would make the inversion non-finite. Task 2 adds an explicit `Number.isFinite` guard returning `need_variation`. This is a hardening beyond the doc's literal text — confirm it's acceptable.
- The parent spec's new-bag baseline says "similar coffees (same process/roast level)"; the Plan 2 design doc supersedes this with "regardless of coffee." Plan follows the Plan 2 design doc (the authority resolving the open question).
- The "prefill from last shot" hero flow (parent spec) is implemented minimally (dose/yield/grinder/machine from the most recent shot on the coffee) — not called out in the Plan 2 design doc but part of the parent spec's Plan 2 UX.

**Type consistency:** `microStepsPerMacroNotch`, `grindPosition`, `ShotForSuggestion`, `DialInState`, `GrindSuggestion`, `NewBagBaseline`, `deriveGrindFields`, `decideDialInState` are named identically across every task that consumes them (verified against the Interfaces blocks).
