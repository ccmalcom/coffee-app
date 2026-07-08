# Plan 1 Execution Report: Foundation + Coffee Log

**For:** the Claude session that authored `2026-07-07-plan-1-foundation-coffee-log.md`
**From:** the Claude session that executed it (via superpowers:subagent-driven-development)
**PR:** https://github.com/ccmalcom/coffee-app/pull/1 (`plan-1-foundation` → `main`)
**Status:** All 18 tasks complete, individually reviewed, final whole-branch review passed, 2 post-review fixes applied and re-reviewed clean. Awaiting Chase's manual browser/device verification before merge.

This report exists so a future planning session (yours or otherwise) doesn't have to re-derive what actually happened during execution — what matched the plan exactly, where the plan's assumptions didn't hold, and what's worth knowing before writing Plan 2.

---

## 1. What shipped, vs. plan

All 18 tasks were implemented substantially as written. The plan's own code blocks were used verbatim in the large majority of cases — this was a well-specified plan, and most implementer subagents reported zero deviation. Where deviations happened, they're cataloged in section 3.

Execution used a fresh implementer subagent + fresh reviewer subagent per task (spec-compliance + code-quality verdicts), plus one final whole-branch review (opus) across the full diff before merge. Tasks 4–7, 12–18 required a live Postgres connection and were blocked for part of the session on Chase supplying real Supabase credentials (see section 4) — Tasks 8, 9, 10, 11 were reordered ahead of them since they had no DB dependency, to avoid idling.

## 2. Review results, task by task

Every task was **Approved** by its reviewer, several after one fix-and-re-review loop. No task was rejected outright or required a redo from scratch.

| Task | What it built | Review outcome |
|---|---|---|
| 1 | Repo scaffold, CLAUDE.md, dependency-security hooks | Approved (1 Critical + 1 Important fixed: hook `-f` bypass, fail-open) |
| 2 | Vitest + Testing Library | Approved clean |
| 3 | CI workflow + audit baseline | Approved (1 Important fixed: missing removal-trigger comment) |
| 4 | Supabase env config | Done directly by controller (pure config/verification, no implementer needed) — see section 4 |
| 5 | Drizzle client + config | Approved clean — surfaced a plan defect (see 3.1) |
| 6 | Catalog schema (roasters/coffees) | Approved clean |
| 7 | Per-user schema (6 tables) | Approved clean — caught and fixed a real risk (see 3.2) |
| 8 | Supabase Auth | Approved clean |
| 9 | Knowledge corpus | Approved (byte-for-byte diff check, no full reviewer needed — pure content) |
| 10 | Zod parsing schema | Approved clean |
| 11 | LLM listing parser + permanent fixture | Approved clean — byte-for-byte fixture/test verification |
| 12 | Catalog dedupe | Approved — 1 justified test-mock deviation (see 3.3) |
| 13 | Barcode lookup | Approved clean |
| 14 | Server actions (coffee.ts) | Approved after 1 fix (see 3.4) |
| 15 | Add-coffee UI | Approved — 1 pre-authorized deviation, 1 disclosed tradeoff (see 3.5, 3.6) |
| 16 | Library + detail UI | Approved — 1 dormant bug flagged, later fixed post-final-review (see 5) |
| 17 | PWA shell | Approved — 1 pre-authorized deviation, 1 disclosed tradeoff (see 3.6, 3.7) |
| 18 | Final verification pass | Complete (no diff — pure verification) |

## 3. Deviations from the plan (with resolutions)

### 3.1 `drizzle-kit generate/push/studio --env-file=...` doesn't work (Task 5)

The plan's literal commands (e.g. `npx drizzle-kit generate --env-file=.env.local`) fail against the installed `drizzle-kit@0.31.10` — `--env-file` is a **Node** flag, not a drizzle-kit CLI flag, and drizzle-kit only auto-loads a plain `.env` (this repo intentionally uses `.env.local`). This surfaced in Task 5 and applied to every subsequent DB-schema task.

**Working form:** `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs <generate|push|studio>`

This is now documented in CLAUDE.md. If Plan 2+ writes new drizzle-kit commands in a plan doc, use this form, not the plan's original.

### 3.2 The `auth.users` stub table almost got created for real (Task 7)

Task 7's schema includes a `pgSchema('auth')` + minimal `authUsers` stub purely for TypeScript FK typing against Supabase's real `auth.users`. `drizzle-kit generate` did emit a `CREATE TABLE "auth"."users"` statement in the generated migration — exactly the failure mode the plan warned about. The implementer caught it and manually stripped it before `push`; the reviewer independently confirmed the final committed migration contains no `auth`/`auth.users` creation, only additive `CREATE TYPE`/`CREATE TABLE public.*`/`ALTER TABLE ADD CONSTRAINT`. **This will recur any time this schema pattern is regenerated** (e.g. if Plan 2+ adds a new per-user table and re-runs `generate`) — always inspect the generated SQL for a stray `auth.users` creation before pushing.

### 3.3 Drizzle table mocks can't use `table._.name` (Task 12, recurring pattern)

The plan's test-mocking pattern for `@/lib/db` (used in Tasks 12, 13, 14) sometimes routed mocked queries by checking `table._.name === 'roasters'`. This property doesn't exist on real `drizzle-orm@0.45.2` `pgTable` objects (verified directly against `node_modules/drizzle-orm` source — table name lives under `Symbol.for('drizzle:Name')`, no `_` accessor). Where this pattern appeared, implementers substituted **reference equality** (`table === roasters`) instead, which is correct and strictly more robust. Documented in CLAUDE.md for any future test that mocks the DB layer.

### 3.4 Inconsistent `ListingParseError` handling (Task 14)

The plan's own Step 3 code wrapped `parseListing` in a try/catch inside `addCoffeeFromListing` (converting `ListingParseError` to a friendly message) but **not** inside the sibling function `confirmBarcodeCoffee`, which called `parseListing` directly. This was a real bug risk (raw Anthropic SDK error text could leak to the client) — flagged Important by the task reviewer, fixed by adding the identical try/catch to `confirmBarcodeCoffee`, re-reviewed clean. If Plan 2+ adds more call sites for `parseListing`, make sure they all handle `ListingParseError` the same way.

### 3.5 Icon generation used Python (Task 17) — this violates a locked constraint

The plan's Task 17 Step 7 generates placeholder PWA icons via `python3 -c "... from PIL import Image ..."`. This directly contradicts CLAUDE.md's locked decision 5 ("Fully TypeScript / Next.js. No Python."). **This should be fixed in the plan doc itself** if Plan 2+ ever needs to regenerate these icons — the controller pre-authorized a Node/TS substitute (hand-rolled PNG bytes via `node:zlib`, no new dependency) for this execution, verified to produce genuinely valid, correctly-sized PNGs, but the plan's own text still has Python in it as written.

### 3.6 Next 16 + Turbopack is incompatible with Serwist (Task 17) — a real gap in the plan's assumptions

The plan's Task 17 assumes `next dev`/`next build` work unmodified with Serwist wired in. They don't: Next.js 16 defaults to Turbopack, and `@serwist/next@9.5.11` injects a webpack-only config, which Next 16 hard-errors on (`This build is using Turbopack, with a webpack config and no turbopack config`) — confirmed via `node_modules/next` and `node_modules/@serwist/next` source, not just the error message. **Fix applied:** `package.json`'s `dev`/`build` scripts now run `next dev --webpack` / `next build --webpack` (Next's own documented escape hatch — verified as a first-class, documented CLI flag, not a hack). **This is a project-wide tradeoff Plan 2+ should know about:** every future task's dev server and build now run on webpack, not Turbopack, until Serwist ships Turbopack support (tracked upstream: [serwist/serwist#54](https://github.com/serwist/serwist/issues/54)). If that lands, `--webpack` can be dropped.

### 3.7 CI pins Node 22; a Task 15 dependency wants Node 24+

`@zxing/library` (barcode scanning, installed transitively via `@zxing/browser` in Task 15) declares `engines: {node: ">=24.0.0"}`. The local dev machine runs Node 24 (no warning), but `.github/workflows/ci.yml` still pins `node-version: '22'` from Task 3 — CI will see an `EBADENGINE`-class warning (non-fatal, npm doesn't hard-fail on engines mismatch without `engine-strict`) that the local environment doesn't. Worth bumping CI to Node 24 in a follow-up task to align environments.

## 4. The DB-credentials blocker (Tasks 4–7, 12–18)

This session started mid-plan: Tasks 1, 2, 3, 8, 9, 10, 11 were already done from a prior session, and everything else was blocked because `.env.local` had the plan's literal placeholder text (`aws-x-xx-xxxx-x.pooler.supabase.com`) instead of real Supabase connection strings. When Chase supplied the DB password, two more surprises appeared before a working connection was established:

1. The Supabase **direct connection** host (`db.<ref>.supabase.co`) only resolves to an **IPv6** address — it has no A record. On an IPv4-only network path, Node's DNS resolution fails with `ENOTFOUND` even though the hostname is technically valid (confirmed via `nslookup`, which found the AAAA record fine).
2. The working fix was the **pooler** hostname instead: `aws-0-us-east-1.pooler.supabase.com` (the standard per-region pooler, confirmed to resolve to real IPv4 addresses), with username `postgres.<project-ref>` and ports 6543 (transaction pooler, → `DATABASE_URL`) / 5432 (session pooler, → `DIRECT_URL`).

This is now documented in CLAUDE.md as a "local dev gotcha." If Plan 2+'s environment setup instructions assume the direct-connection host works out of the box, they should be revised — it depends entirely on whether the machine running the app has IPv6 connectivity, which most consumer networks don't.

## 5. Final whole-branch review + post-review fixes

After all 18 tasks passed individually, a final whole-branch review (opus, full 21-commit diff, merge-base = pre-plan `main` tip) found:

- **No Critical findings.** All 10 locked architectural constraints were re-verified holistically — most importantly, constraint 10 (application-code authorization via `requireUserId()`, no Postgres RLS) was traced across every per-user query in `src/lib/actions/coffee.ts` and confirmed sound. The permanent Julio Madrid Caturra Nitro fixture was confirmed intact and unweakened. The Anthropic SDK surface used by the parser (`messages.parse`, `zodOutputFormat`, model id) was independently verified against the actually-installed SDK version, not just trusted from mocked tests.
- **2 Important findings**, both real but non-blocking for an MVP merge — both are **latent traps that only become live bugs once Plan 2+ adds more functionality**, which is exactly the kind of thing a per-task review can't see:
  1. `rateCoffee` was update-only — if a `library_entries` row didn't exist yet for a given `(userId, coffeeId)`, the update silently matched zero rows while the UI still showed "Saved." Unreachable in Plan 1 (every coffee-add path creates an entry first), but Plan 4's Discovery will create catalog rows/`candidate` entries where this assumption breaks.
  2. The Library's `wishlist`/`finished` tabs were permanently, silently empty — no code path in Plan 1 ever sets those statuses.
- 3 Minor findings (barcode-detect handler missing a try/catch its siblings have; the parser's fallback net is broad enough a genuine bug could masquerade as low-confidence data; signup has no app-level lockout, relies on a Supabase dashboard setting).

**Chase's decision:** fix both Important findings now, defer the Minor ones. Fixes applied and re-reviewed clean:
- `rateCoffee` converted to select-then-branch: preserves the existing row's status on update (reads from the fetched row, not `input.status ?? 'owned'` — the same bug in disguise would have been an easy mistake here), inserts a new `'owned'` entry only when none exists. Two new tests added, both confirmed red-before-fix.
- Library `TABS` reduced to `['owned']` with a comment explaining the other two return once status-changing UI exists.

**If Plan 2 or 3 adds "mark as wishlist" / "mark as finished" UI, re-enable those two tabs in `src/app/library/page.tsx`'s `TABS` array** — the rendering logic is already generic over that array and needs no other change.

## 6. Recommendations for Plan 2's author

1. Any new drizzle-kit command examples in the plan doc should use `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs <cmd>`, not `npx drizzle-kit <cmd> --env-file=...`.
2. If Plan 2 regenerates the schema (new tables/columns), double-check the generated migration for a stray `auth.users` creation before instructing `push`.
3. Any new server action or component that calls `parseListing` should wrap it in the same `ListingParseError`-handling pattern already established in `coffee.ts`.
4. If Plan 2/3 introduces the first status-changing UI (wishlist/finished), re-enable those two Library tabs and confirm `rateCoffee`'s status-preservation logic actually behaves as intended end-to-end.
5. Consider bumping CI's Node version to 24 (matching local dev and `@zxing/library`'s stated requirement) before it causes confusion.
6. Do not write icon-generation or other one-off asset scripts in Python — this repo is TS/Node-only by locked decision.

## 7. Still outstanding (owed to Chase, not something an agent can do)

- Full manual browser walkthrough: log in → add coffee via paste (Julio Madrid fixture) → rate/review → confirm on `/library`.
- Live camera barcode scan reaching all three branches (catalog hit / Open Food Facts / not found).
- Chrome DevTools → Application → Manifest: confirm no errors, "Install" affordance appears; ideally a real device install test.
- Confirm the Supabase dashboard is actually configured to block new signups after Chase's one account — the app itself has no code-level restriction.
