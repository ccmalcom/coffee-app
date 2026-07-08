# Coffee App

Personal espresso companion: Coffee Log + Grind Dial-In Assistant + Discovery Engine, built against the approved MVP design spec.

**Read first:** `docs/specs/2026-07-07-coffee-app-mvp-design.md` (design, locked decisions) and the active plan under `docs/plans/` (current build tasks). Don't relitigate decisions already locked in the spec — flag disagreement instead of silently deviating.

## Stack
Next.js 16 (App Router) on Vercel · Supabase (Postgres + Auth) · Drizzle ORM (postgres-js) · Anthropic TypeScript SDK · Zod · @zxing/browser · Serwist (PWA) · Vitest + Testing Library.

## Commands
- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` · `npm run test` (watch) · `npm run test:run` (CI mode)
- `npm run db:generate` · `npm run db:push` · `npm run db:studio` — Drizzle migrations. drizzle-kit 0.31.10 does NOT accept `--env-file` itself; load env with Node's own flag instead: `node --env-file=.env.local ./node_modules/drizzle-kit/bin.cjs <generate|push|studio>`
- `npm run verify:db` — confirms `DATABASE_URL` is reachable

## Locked architectural decisions (do not relitigate)
- The LLM is never the recommender — Discovery (Plan 4) is deterministic retrieval + LLM rerank only.
- Grind suggestions (Plan 2) come only from the user's own logged shots — never generic espresso heuristics.
- `coffees`/`roasters` are a shared catalog with no `user_id`; all personal data lives in per-user tables.
- No bulk import — coffees are added one at a time (paste/URL, barcode, or photo).
- Espresso-only MVP; `shots.method` defaults to `'espresso'` but isn't a hardcoded enum, so other methods are additive later.
- Authorization is enforced in application code (`requireUserId()` scoping every query), not Postgres RLS — Drizzle connects directly to Postgres, bypassing PostgREST. Accepted single-user simplification; revisit for multi-user.

## Dependency security policy (non-negotiable)
- Run `npm audit` after every `npm install` / `npm update`.
- Non-breaking vulnerabilities: fix immediately with `npm audit fix`.
- Breaking-only fixes: never run `npm audit fix --force`. Stop, write a short mini-plan, get explicit approval first. A hook in `.claude/settings.json` blocks `--force` outright — see below.
- Always scaffold/upgrade onto verified-latest-stable versions checked live (`npm view <pkg> version`), never assumed from training data.

## Permanent test fixture — do not delete or weaken
`src/lib/parsing/fixtures/julioMadridCaturraNitro.ts` (Tinker Coffee Co., Colombia "Julio Madrid Caturra Nitro") is a calibration fixture for the listing parser: it must always parse to `process: 'nitro_washed'`, `flavorOrigin: 'process'`. Its test in `src/lib/parsing/parseListing.test.ts` must survive every future plan unchanged.

## Scope by plan
- **Plan 1 (this one):** foundation, schema for every spec table, auth, Coffee Log (add/rate/review), Library screen, PWA shell.
- **Plan 2:** Grind Dial-In Assistant (equipment + shot logging UI, interpolation suggestions).
- **Plan 3:** Taste profile build/UI.
- **Plan 4:** Discovery engine (sourcing, scoring, feed).

Schema for all of the above already exists after Plan 1 (Drizzle tables for `equipment`, `shots`, `taste_profile`, `directives`, `discovery_runs`) — later plans add UI/logic on existing tables, not new migrations for these, unless a plan says otherwise.

## Local dev gotchas
- Supabase's direct host (`db.<ref>.supabase.co`) is IPv6-only — use the pooler for both `DATABASE_URL`/`DIRECT_URL` on IPv4-only networks: `postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:{6543,5432}/postgres`.
- Next 16 defaults to Turbopack, but Serwist (PWA) requires webpack — `dev`/`build` npm scripts already run with `--webpack` baked in; don't "fix" this back to plain `next dev`/`next build`.
- Mocking `@/lib/db` in tests: route mocked table queries by reference equality (`table === roasters`), not `table._.name` — that property doesn't exist on real `drizzle-orm` v0.45.2 `pgTable` objects.
- `src/lib/db/schema/user.ts`'s `auth.users` stub is for FK typing only. If `drizzle-kit generate` emits a `CREATE TABLE auth.users` statement, strip it from the migration before `push` — Supabase already owns that table.

## Infra already provisioned
- GitHub: `https://github.com/ccmalcom/coffee-app.git`
- Supabase: project ref `ojaznjstjrzfuinbxner` ("coffee-app", us-east-1, Postgres 17.6) — see Task 4 of Plan 1 for credentials.
