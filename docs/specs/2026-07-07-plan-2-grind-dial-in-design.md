# Plan 2 — Grind Dial-In Assistant — Design

**Date:** 2026-07-07
**Status:** Approved design (pending implementation plan)
**Parent spec:** `docs/specs/2026-07-07-coffee-app-mvp-design.md` (Grind Dial-In Assistant section, locked decisions 2 and 6) — this doc resolves the open design questions left there; it does not relitigate anything already locked.
**Prior execution report:** `docs/plans/2026-07-07-plan-1-foundation-coffee-log-REPORT.md` — `equipment` and `shots` schema already exist exactly as described below except where this doc adds columns.

## Problem

The parent spec calls for "deterministic interpolation over grind setting vs. time/yield/outcome," but `shots.grind_setting` is stored as free text because grinders vary. Chase's own grinder makes this concrete: a macro dial (0–14, with 3 intermediate clicks between each integer — effectively quarter-notch resolution) plus an independent secondary/micro dial (~6 steps) that nudges finer/coarser on top of the macro setting. A pure free-text field has no notion of distance or order between values, so it can't support interpolation as-is. This design adds a normalized numeric representation alongside the existing free-text field, without weakening it for grinders that don't work this way.

## Schema additions

Additive only — no migration risk to Plan 1's existing rows, per `CLAUDE.md`'s note that later plans add to these tables rather than re-migrate them.

**`equipment`** — add:
- `microStepsPerMacroNotch` (`integer`, nullable). `NULL` = single-dial grinder (or a grinder not yet configured for numeric interpolation). Set = has a secondary dial, and this is the conversion constant used to fold micro-dial position into one scalar. Editable per grinder; UI defaults new entries to `6` (matches Chase's grinder) but any integer is valid.

**`shots`** — add:
- `grindMacro` (`real`, nullable) — the macro dial reading.
- `grindMicro` (`real`, nullable) — the micro dial reading (signed; positive/negative convention is the user's own, consistent within a grinder).
- `grindPosition` (`real`, nullable) — computed once at write time as `grindMacro + grindMicro / microStepsPerMacroNotch` (or just `grindMacro` when there's no micro dial). Stored rather than computed on read so the interpolation query stays a plain numeric scan. `NULL` whenever the shot's grind setting isn't numeric (e.g. "medium-fine" typed into a legacy/non-numeric grinder) — those shots remain visible in history but are excluded from interpolation.

`grindSetting` (`text`, existing, `NOT NULL`) is unchanged and stays required — it's the human-readable label. When the numeric fields are populated, it's auto-generated for display (e.g. `"12.3 / -2"`); for grinders without `microStepsPerMacroNotch` set, it remains a plain free-text or single-number entry exactly as Plan 1 built it.

## Equipment registration UI

Grinder form (kind = `grinder`) gains one optional control: a "has a secondary/micro adjustment?" toggle. Checking it reveals a "micro steps per macro notch" number input, defaulting to `6`. Machines are unaffected. This is the only change to equipment registration.

## Shot logging UI

The grind-setting input on the shot form branches on the selected grinder's `microStepsPerMacroNotch`:

- **Set (has micro dial):** two numeric inputs — "Grind (macro)" and "Micro adjust" — replace the single field. On submit, `grindPosition` is computed per the formula above and `grindSetting`'s display text is auto-generated.
- **Null (single dial or unconfigured):** one input, same as Plan 1 today. If it parses as a number (`Number.isFinite(parseFloat(value))`), `grindMacro = grindPosition = ` that number, `grindMicro = null`. If it doesn't parse (free text like "medium-fine"), all three numeric columns stay `null` and the shot logs normally — just without interpolation eligibility.

No existing shot-history views need to change shape; they keep reading `grindSetting` for display.

## Interpolation algorithm

Purely derived from the signed-in user's own shots for one exact combo (coffee + grinder + machine) — never a generic espresso heuristic, per the parent spec's locked decision 2.

**Eligibility (per combo):**
1. ≥ `MIN_SHOTS_FOR_SUGGESTION` (5, existing locked threshold) shots with non-null `grindPosition`.
2. ≥ 1 of those shots tagged `balanced` or `excellent` (`POSITIVE_OUTCOME_TAGS`). Without at least one positive reference point in the user's own data, there is no defensible direction to suggest — the UI shows "log a shot you rate balanced or excellent to activate suggestions" instead of guessing.
3. The eligible shots span ≥ 2 distinct `grindPosition` values (otherwise there's nothing to fit a line to) — if not met, show "try a shot at a different setting to unlock suggestions."

**Computation, when eligible:**
1. Ordinary least squares: `timeSeconds ~ grindPosition` across the combo's eligible shots.
2. `targetTime` = mean `timeSeconds` of the shots tagged `balanced`/`excellent`.
3. Invert the fitted line at `targetTime` to solve for the suggested `grindPosition`.
4. Convert back to display form: macro + micro (splitting via `microStepsPerMacroNotch`) if the grinder uses one, else a single number.
5. Show the suggestion with its evidence: the shots and outcomes the fit was drawn from (mirrors the parent spec's example format, e.g. "setting 12 → 22s, sour ×3; setting 10 → 28s, balanced").

The LLM is never involved in producing the number — consistent with the parent spec's decision 1 (LLM is not the recommender) extended to this subsystem. If an LLM-phrased explanation is added later, it explains the number, it doesn't compute it.

## New-bag starting point

Once the user has ≥ `MIN_SHOTS_FOR_NEW_BAG_BASELINE` (15, existing locked threshold) total shots on a grinder+machine pair (across any coffee), a new coffee with zero shots on that pair gets a starting-point suggestion: the median `grindPosition` among the user's own `balanced`/`excellent`-tagged shots on that grinder+machine, regardless of coffee. Clearly labeled as a rough starting estimate, not a combo-calibrated suggestion — it's superseded the moment the new combo hits its own 5-shot unlock.

## Named constants

All in one tunable-constants module, matching Plan 1's convention of not hardcoding thresholds inline:

- `MIN_SHOTS_FOR_SUGGESTION = 5`
- `MIN_SHOTS_FOR_NEW_BAG_BASELINE = 15`
- `POSITIVE_OUTCOME_TAGS = ['balanced', 'excellent']`
- `DEFAULT_MICRO_STEPS_PER_MACRO_NOTCH = 6`

## Error handling

- Regression on a combo with all-identical `grindPosition` values: caught by the "≥2 distinct values" eligibility check above, never silently divides by zero.
- Shot logged with non-numeric grind setting: succeeds normally (logging always works), just never contributes to interpolation — no error surfaced to the user, this is expected/normal.
- Deleting or editing a grinder's `microStepsPerMacroNotch` after shots exist: existing shots keep their already-computed `grindPosition` (not recalculated retroactively) — changing the constant only affects how *future* shots are computed. This avoids silently rewriting historical data based on a settings change.

## Testing strategy

Following Plan 1's Vitest + Testing Library conventions and the reference-equality mock pattern for `@/lib/db` (`table === shots`, not `table._.name`):

- **Unit — `grindPosition` computation:** macro+micro combination, single-dial passthrough, non-numeric fallback to `null`.
- **Unit — suggestion function:** enough data + variation + positive tag → returns a suggestion with evidence; <5 shots → "log-only" result; no positive-tagged shot → "needs a positive reference" result; <2 distinct positions → "needs setting variation" result; new-bag baseline path with ≥15 combo-agnostic shots.
- **Component — shot logging form:** renders single grind field vs. macro/micro pair based on the selected grinder's `microStepsPerMacroNotch`; submits the correct computed `grindPosition`.

## Out of scope (this plan)

- Taste-profile integration (Plan 3).
- Any UI/logic changes to Discovery (Plan 4).
- Retroactively recomputing `grindPosition` for shots logged before this plan ships with a non-numeric free-text value — no backfill; those rows simply stay interpolation-ineligible unless manually re-logged.
