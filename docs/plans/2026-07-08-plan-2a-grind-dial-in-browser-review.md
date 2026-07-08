# Plan 2a — Grind Dial-In Browser Verification & Close-Out

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close out Plan 2 (Grind Dial-In Assistant) by running every browser-based UI check the original plan required but that no code-only session (local subagent or cloud routine) could perform, then merge `plan-2-grind-dial-in` into `main`.

**Architecture:** No new subsystems. This plan verifies work already implemented across Plan 2's Tasks 1-8 (grind math, DB migration, equipment actions/UI, shot actions/UI, coffee detail integration) by driving the real running app in a real Chrome session via Claude-in-Chrome, and folds in review of whatever Tasks 6-8 the scheduled cloud routine produced. Any defect found gets a normal code fix + re-verify, not a redesign.

**Tech Stack:** Next.js 16 (App Router, `--webpack`) dev server, Claude-in-Chrome MCP tools, Vitest + Testing Library (regression sweep only), Drizzle/Supabase (already migrated, no schema changes here).

## Global Constraints

Same locked constraints as Plan 2 (`docs/plans/2026-07-07-plan-2-grind-dial-in.md`) and the parent spec — carried forward verbatim, not relitigated:

- **The LLM never computes the grind number** — suggestions are deterministic math over the user's own shots.
- **Authorization in app code:** every DB query scoped by `requireUserId()`. No Postgres RLS.
- **Do not touch** `src/lib/parsing/fixtures/julioMadridCaturraNitro.ts` or its test — permanent calibration fixture. The regression sweep (Task 5, Step 5 below) must confirm it's still green.
- **Browser UI verification procedure** (copied verbatim from Plan 2, reused by every task below):
  1. Start the dev server in the background: `npm run dev` (already runs `next dev --webpack` — do not change this). Serves on `http://localhost:3000`.
  2. **Auth:** every page here is behind `requireUserId()`, which redirects unauthenticated requests to `/login`. Claude-in-Chrome drives the human's existing Chrome session — Chase must be logged in to the app in that Chrome profile first. Landing on `/login` is the signal to log in, not a component bug.
  3. At the start of the browser pass, call `tabs_context_mcp` once, then `tabs_create_mcp` for a fresh tab (never reuse a prior session's tab id).
  4. Per route: `navigate` → `read_page`/screenshot to confirm expected elements → exercise the specific interactions called out → `read_console_messages` to confirm no hydration errors, uncaught exceptions, or failed server-action requests → record a one-line pass/fail.
  5. **Do not** trigger `alert`/`confirm`/`prompt` dialogs — they freeze the extension. None of these components use them; keep it that way.
  6. On any failure: fix the component and re-run the check before moving on or committing.
- **Known accepted gaps, not to be silently "fixed" mid-verification** (carried from Plan 2's task reviews — if a browser check surfaces one of these, it's expected, not a new bug):
  - No guard anywhere against `microStepsPerMacroNotch === 0` (would divide-by-zero in grind math). Flagged three times across Plan 2's reviews (Tasks 1, 4), never resolved by design. If it causes a visibly broken UI during this plan's checks, that graduates it from "theoretical" to "real" — fix it then (small, targeted guard in `src/lib/grind/position.ts`'s `computeGrindPosition`/`splitGrindPosition`), but don't preemptively touch it if it doesn't surface.
  - `EquipmentForm.tsx` has no error handling around a failed `createEquipment` call (silent failure, form clears as if it succeeded) — inherited from the plan's own prescribed code, not this plan's concern unless a check below actually depends on error-path behavior.
- **Cloud-produced work needs the same review rigor as local tasks.** Nothing the scheduled routine (`trig_01RnAFY1eysfq4C7tKXFUQsX`) wrote gets treated as pre-approved just because it passed its own tests — Task 2 below applies the same task-reviewer process used for Tasks 1-5.

---

## Starting State (as of 2026-07-08)

- Branch `plan-2-grind-dial-in` has Tasks 1-5 committed, reviewed clean, and pushed to `origin/plan-2-grind-dial-in` (commits `76cccdf`..`6c09d61`, plus hook fix `14d9303`).
- A scheduled cloud routine (`trig_01RnAFY1eysfq4C7tKXFUQsX`, fired 2026-07-08 ~05:33 UTC) was dispatched to implement Tasks 6 (shot server actions), 7 (shot logging UI, code only), and 8 (coffee detail integration, code only), skip Task 9 entirely, then push and open a **draft PR** into `main`. It explicitly could not run any browser check.
- **None of Plan 2's required browser-verification passes have happened yet** — not Task 5's (`/equipment`), not Task 7's or Task 8's (blocked on the cloud routine's code existing), and not the full Task 9 end-to-end walkthrough.
- Full history and reasoning: `.superpowers/sdd/progress.md` (git-ignored, local only).

---

## Task 1: Browser verification — Equipment registration UI (Plan 2 Task 5)

**Files:** none expected (verification only); fix `src/components/equipment/EquipmentForm.tsx` or `src/app/equipment/page.tsx` only if a check fails.

**Interfaces:** exercises `/equipment` (already implemented and pushed — no dependency on the cloud routine).

- [ ] **Step 1: Start the dev server and open a fresh tab**

Run in background: `npm run dev`. Then `tabs_context_mcp` → `tabs_create_mcp`.

- [ ] **Step 2: Navigate and confirm initial render**

`navigate` to `http://localhost:3000/equipment`. If it redirects to `/login`, log in first, then re-navigate. `read_page` and confirm: a form with a Type selector (Grinder/Machine), Nickname, Brand, Model inputs; "Grinders" and "Machines" list sections (empty-state text if nothing registered yet).

- [ ] **Step 3: Exercise the micro-dial toggle branching**

With Type = Grinder: confirm the "Has a secondary/micro adjustment?" checkbox is present and unchecked by default. Check it — confirm a "Micro steps per macro notch" number input appears, pre-filled with `6`. Switch Type to Machine — confirm the micro-dial checkbox disappears entirely.

- [ ] **Step 4: Submit a grinder and a machine**

Set Type = Grinder, Nickname = "Test Grinder (Plan 2a)", check the micro-dial toggle (leave steps at `6`), submit. Confirm it appears in the Grinders list with the `· micro ÷6` suffix. Then set Type = Machine, Nickname = "Test Machine (Plan 2a)", submit. Confirm it appears in the Machines list.

- [ ] **Step 5: Confirm nav + console**

Confirm the "Equipment" link is present in the app's nav bar and routes to `/equipment`. `read_console_messages` — confirm no hydration errors, uncaught exceptions, or failed server-action requests.

- [ ] **Step 6: Record result**

If all checks pass: no commit needed, record "Task 1: PASS" in this plan's tracking (todo list / ledger). If any check failed: fix the specific component, re-run Steps 2-5 for the failed check, then commit:

```bash
git add src/components/equipment/ src/app/equipment/
git commit -m "fix(equipment): <describe what the browser pass caught>"
```

---

## Task 2: Review the cloud routine's Tasks 6-8 work

**Files:** none created by this task directly — this is a review/fix gate on whatever the cloud routine (`trig_01RnAFY1eysfq4C7tKXFUQsX`) produced.

**Interfaces:** consumes the routine's draft PR (or its pushed branch state if it didn't get as far as opening a PR); produces either an approved, merge-ready `src/lib/actions/shots.ts` + shot-logging UI + coffee-detail integration, or a fix commit that makes them so.

- [ ] **Step 1: Check the routine's outcome**

```bash
gh pr list --state all --head plan-2-grind-dial-in
git fetch origin plan-2-grind-dial-in
git log --oneline origin/plan-2-grind-dial-in
```

Confirm what actually landed: did it complete Tasks 6, 7, and 8? Did it open a draft PR? Did it stop partway and leave a summary of why? Read whatever it left (PR description, or the tip commit's message) before proceeding.

- [ ] **Step 2: Pull the routine's branch state locally**

```bash
git pull origin plan-2-grind-dial-in
npm install
npm run test:run && npm run typecheck && npm run lint
```

All must be green (matches what the routine was instructed to leave clean). If not, stop here and fix before any browser pass — a red baseline invalidates the checks that follow.

- [ ] **Step 3: Run task review on each of Tasks 6, 7, 8**

For each task the routine claims to have completed, generate a review package and dispatch a task reviewer exactly as Tasks 1-5 were reviewed (see `.superpowers/sdd/progress.md` for the pattern and the global constraints block to hand the reviewer). Use the corresponding section of `docs/plans/2026-07-07-plan-2-grind-dial-in.md` (Task 6, Task 7, Task 8) as the spec each review checks against — same brief text a local implementer would have received.

Pay specific attention to constraints the routine was told about secondhand rather than deriving itself: `requireUserId()` scoping on every new query in `shots.ts`, the `grindPosition` formula applied consistently, and whether it silently introduced its own test-mock deviations (expected, given Tasks 4/5's precedent — verify any such deviation the same way those were verified, don't just accept the routine's own say-so).

- [ ] **Step 4: Fix any Critical/Important findings**

If the reviewer(s) found issues, fix them (as a normal task-review fix cycle) and re-review before proceeding to Task 3 of this plan. Do not attempt the browser passes below against code that failed its own task review.

- [ ] **Step 5: Record result**

Record which of Tasks 6/7/8 are now confirmed complete-and-reviewed. If the routine did not finish all three, this plan's remaining tasks only apply to what actually landed — note the gap and treat the unfinished task(s) as still owed from Plan 2 itself (dispatch a normal local implementer for them before continuing).

---

## Task 3: Browser verification — Shot logging UI (Plan 2 Task 7)

**Files:** none expected; fix `src/components/shots/ShotForm.tsx`, `src/components/shots/DialInCard.tsx`, or `src/app/coffee/[id]/log/page.tsx` only if a check fails.

**Interfaces:** exercises `/coffee/<id>/log`. Depends on Task 2 above confirming Task 7's code is present and reviewed clean.

- [ ] **Step 1: Get a real coffee id**

`navigate` to `http://localhost:3000/library`, open any coffee, note its id from the URL (or add one first via `/coffee/add` if the library is empty).

- [ ] **Step 2: No-equipment empty state (skip if equipment already exists)**

If this is a fresh environment with no equipment registered yet, `navigate` to `/coffee/<id>/log` and confirm it shows "Add at least one grinder and one machine first" linking to `/equipment`. Otherwise skip this check (Task 1 above already registered a test grinder + machine).

- [ ] **Step 3: Branching grind input**

`navigate` to `/coffee/<id>/log`. With a micro-dial grinder selected (e.g. the "Test Grinder (Plan 2a)" from Task 1), confirm two grind inputs render: "Grind (macro)" and "Micro adjust". If a single-dial grinder is also registered, select it and confirm the inputs swap to one "Grind setting" text field.

- [ ] **Step 4: Dial-in card renders and reflects state**

Confirm a dial-in card renders above the form. On a fresh grinder+machine combo with zero logged shots, confirm it shows the "log N more shots to unlock a suggestion" gating message (or the new-bag-baseline / insufficient-history message, depending on prior data).

- [ ] **Step 5: Submit a shot**

Fill dose/yield/time, a grind value (macro+micro or text, matching Step 3's grinder), and toggle at least one outcome tag (e.g. "balanced"). Click "Save shot". Confirm it redirects to `/coffee/<id>` and the shot appears in the shot history there.

- [ ] **Step 6: Console check**

`read_console_messages` — confirm no hydration errors, uncaught exceptions, or failed server-action requests across Steps 2-5.

- [ ] **Step 7: Record result**

PASS → no commit. FAIL → fix the specific component, re-run the failed step, commit:

```bash
git add src/components/shots/ "src/app/coffee/[id]/log/"
git commit -m "fix(shots): <describe what the browser pass caught>"
```

---

## Task 4: Browser verification — Coffee detail integration (Plan 2 Task 8)

**Files:** none expected; fix `src/app/coffee/[id]/page.tsx` only if a check fails.

**Interfaces:** exercises `/coffee/<id>`. Depends on Task 2 confirming Task 8's code is present and reviewed clean, and Task 3 having logged at least one shot.

- [ ] **Step 1: Navigate to the coffee used in Task 3**

`navigate` to `/coffee/<id>` (the same coffee Task 3 logged a shot against).

- [ ] **Step 2: Dial-in section**

Confirm a "Dial-in" section renders with a "Log shot" button linking to `/coffee/<id>/log`. Confirm a per-combo dial-in card renders, labeled `<grinder nickname> · <machine nickname>`.

- [ ] **Step 3: Shot history**

Confirm the shot-history list shows the shot logged in Task 3: its `grindSetting`, `dose→yield · time`, and grinder·machine line.

- [ ] **Step 4: Empty-state check on a different coffee**

`navigate` to a different coffee with zero logged shots. Confirm the shot-history section shows "No shots logged yet" and no dial-in cards appear (or, if that grinder+machine pair has ≥15 shots elsewhere, confirm a "Rough starting point" new-bag baseline card instead — either is correct per the plan's gating logic, just confirm it's one or the other, not broken).

- [ ] **Step 5: Console check**

`read_console_messages` — confirm no hydration errors, uncaught exceptions, or failed server-action requests.

- [ ] **Step 6: Record result**

PASS → no commit. FAIL → fix, re-run, commit:

```bash
git add "src/app/coffee/[id]/page.tsx"
git commit -m "fix(coffee): <describe what the browser pass caught>"
```

---

## Task 5: Full end-to-end browser walkthrough (Plan 2 Task 9)

**Files:** none expected — pure verification across the assembled feature, distinct from Tasks 1/3/4 above (which each checked one component in isolation). Fix wherever a defect is found.

**Interfaces:** exercises the whole Plan 2 surface end-to-end. Depends on Tasks 1-4 above all passing.

- [ ] **Step 1: Cold-start to live suggestion**

Using the grinder+machine from Task 1/3, log shots on the *same combo* (same coffee) until you have ≥5 shots at ≥2 distinct grind positions, with ≥1 tagged `balanced` or `excellent`. Confirm the dial-in card walks through the gating states as data accrues, in this order:
- <5 shots → "log N more shots…"
- ≥5 but no positive tag → "log a shot you rate balanced or excellent…"
- ≥5, positive, but all one position → "try a shot at a different setting…"
- eligible → a `display → ~Ns` suggestion with an evidence list.

- [ ] **Step 2: New-bag baseline**

Once that grinder+machine pair has ≥15 total shots (across any coffee) including a positive-tagged one, open a *different* coffee with zero shots on that pair at `/coffee/<newId>/log`. Confirm the card shows "Rough starting point: <display>" (clearly labeled as an estimate), and that it's replaced by a real combo suggestion the moment that new combo gets its own ≥5 qualifying shots.

- [ ] **Step 3: Regression sweep**

```bash
npm run test:run && npm run typecheck && npm run lint
```

All green. Confirm the permanent Julio Madrid Caturra Nitro fixture test (`src/lib/parsing/parseListing.test.ts`) is present in the run output and passing, unweakened.

- [ ] **Step 4: Record results**

Write a short pass/fail summary of Steps 1-3. If any step required a code fix, it should already be committed with a `fix(...)` message per that step's own task above — note it here. Otherwise no commit for this task.

---

## Task 6: Final whole-branch review and merge

**Files:** none created — final review + merge only.

**Interfaces:** consumes the full branch diff `main...plan-2-grind-dial-in`.

- [ ] **Step 1: Dispatch a final whole-branch code review**

Follow superpowers:requesting-code-review's template (`code-reviewer.md`) against the merge-base (`main` tip at branch creation, `2615ffe`) through the current tip. Point it at the plan's Global Constraints (this plan's, plus the original Plan 2's) as its attention lens. This mirrors Plan 1's final review step.

- [ ] **Step 2: Fix any findings, re-review**

Same fix-and-re-review loop as every prior task review. Batch all findings into one fix dispatch if more than one, per subagent-driven-development's guidance.

- [ ] **Step 3: Use superpowers:finishing-a-development-branch**

Once the final review is clean and all browser passes (Tasks 1-5 above) are recorded PASS, hand off to `superpowers:finishing-a-development-branch` to decide push/PR/merge. If the cloud routine already opened a draft PR (Task 2, Step 1), update/mark it ready for review instead of opening a new one — don't create a duplicate PR for the same branch.

---

## Still owed to Chase (genuinely manual / device-only)

- Real-device PWA behavior for the new routes, if that matters for this milestone (carried over from Plan 2, never in scope for any automated pass).
- Anything the browser passes above can't seed by hand at reasonable volume (e.g. genuinely large shot-history datasets).
