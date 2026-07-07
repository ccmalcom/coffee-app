# Plan 1: Foundation + Coffee Log — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Coffee App repo end to end — Next.js scaffold, full Supabase/Drizzle schema, single-user auth, the LLM listing parser, all three add-coffee flows (paste/URL, barcode, photo fallback), rate/review, the Library screen, and a mobile-first installable PWA shell.

**Architecture:** Next.js 16 App Router on Vercel, Server Actions as the only data-mutation surface (no separate REST API layer), Drizzle ORM talking directly to Supabase Postgres (bypassing PostgREST/RLS — see Global Constraints), Supabase Auth for a single email+password user, Anthropic's native structured-output API for listing parsing, `@zxing/browser` for barcode scanning, Open Food Facts as the open product database fallback, Serwist for the PWA service worker.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, TypeScript 6.0.3, Tailwind CSS 4.3.2, Drizzle ORM 0.45.2 + drizzle-kit 0.31.10 (postgres-js driver), @supabase/supabase-js 2.110.1 + @supabase/ssr 0.12.0, @anthropic-ai/sdk 0.110.0, Zod 4.4.3, @zxing/browser 0.2.1, Serwist 9.5.11 + @serwist/next 9.5.11, Vitest 4.1.10 + Testing Library.

## Scope boundary (read this before starting)

This plan builds **Foundation + Coffee Log only**. The full Drizzle schema for every spec table is created now (so later plans are pure additive migrations), but the following are explicitly **out of scope** for Plan 1 even though their tables exist: onboarding/directive editor UI, equipment management UI, shot logging UI, grind dial-in suggestions, taste profile build/UI, and the Discovery engine (sourcing, scoring, feed). Those are Plans 2–4. Do not build UI for `equipment`, `shots`, `taste_profile`, `directives`, or `discovery_runs` in this plan — schema only.

## Global Constraints

- Fully TypeScript / Next.js. No Python. (spec, locked decision 5)
- `coffees` and `roasters` have no `user_id` — shared catalog. All personal data lives in per-user tables carrying `user_id`. (spec, locked decision 3)
- No bulk import — coffees are added one at a time via paste/URL, barcode, or photo. (spec, locked decision 4)
- `shots.method` defaults to `'espresso'` — schema must not hardcode an enum that blocks future methods. (spec, locked decision 6)
- Espresso-only MVP; no drip/pourover UI. (spec, locked decision 6)
- **`npm audit` runs after every `npm install`/`npm update`.** Non-breaking vulnerabilities are auto-fixed (`npm audit fix`). Never `npm audit fix --force` or otherwise take a breaking upgrade to resolve a vulnerability without a written mini-plan and Chase's explicit approval first. (spec, dependency security policy — non-negotiable)
- Scaffold on verified-latest-stable versions, checked live at build time, never assumed from training data. (spec, dependency security policy)
- LLM extractions validate against a Zod schema; one retry on failure; failures still land a catalog row at `parse_confidence = 'LOW'` for manual review — never silently dropped. (spec, error handling)
- The Julio Madrid Caturra Nitro listing is a **permanent** calibration fixture: must parse to `process = 'nitro_washed'`, `flavor_origin = 'process'`. This test must never be deleted or weakened in later plans. (spec, calibration example + testing section)
- Authorization is enforced in application code, not Postgres RLS: Drizzle connects directly to Postgres via a connection string, bypassing PostgREST, so RLS policies (if any) would not apply to these queries anyway. Every per-user query is scoped by `userId` obtained from `requireUserId()`. This is an explicit, accepted simplification for the single-user MVP — flagged the same way the spec flags the catalog-moderation gap, not an oversight. Multi-user phase should revisit (defense-in-depth RLS).

---

## File structure

```
coffee-app/
├── CLAUDE.md                         # project instructions for any Claude session working in this repo
├── .claude/
│   ├── settings.json                 # hooks: block `npm audit fix --force`, remind to audit after install/update
│   └── hooks/
│       ├── block-audit-force.sh
│       └── remind-npm-audit.sh
├── .github/workflows/ci.yml
├── knowledge/
│   ├── process-taxonomy.md
│   └── tasting-note-vocabulary.md
├── drizzle/                          # generated SQL migrations (drizzle-kit output)
├── drizzle.config.ts
├── next.config.ts
├── vitest.config.ts
├── package.json / tsconfig.json / .env.local (gitignored) / .env.local.example
├── scripts/
│   └── verify-db-connection.ts
└── src/
    ├── proxy.ts                      # Next 16 proxy (formerly middleware) — session refresh + route guard
    ├── app/
    │   ├── layout.tsx
    │   ├── manifest.json
    │   ├── sw.ts                     # Serwist service worker source
    │   ├── page.tsx                  # redirects to /library or /login
    │   ├── login/page.tsx
    │   ├── login/actions.ts
    │   ├── signup/page.tsx
    │   ├── library/page.tsx
    │   ├── coffee/add/page.tsx
    │   └── coffee/[id]/page.tsx
    ├── components/
    │   ├── layout/NavBar.tsx
    │   ├── auth/LoginForm.tsx
    │   ├── auth/SignupForm.tsx
    │   ├── coffee/AddCoffeeForm.tsx
    │   ├── coffee/BarcodeScanner.tsx
    │   ├── coffee/CoffeeCard.tsx
    │   ├── coffee/RatingStars.tsx
    │   └── coffee/RateReviewForm.tsx
    └── lib/
        ├── supabase/client.ts
        ├── supabase/server.ts
        ├── auth/requireUserId.ts
        ├── db/index.ts
        ├── db/schema/catalog.ts
        ├── db/schema/user.ts
        ├── db/schema/index.ts
        ├── parsing/schema.ts
        ├── parsing/parseListing.ts
        ├── parsing/parseListing.test.ts
        ├── parsing/fixtures/julioMadridCaturraNitro.ts
        ├── catalog/similarity.ts
        ├── catalog/similarity.test.ts
        ├── catalog/dedupe.ts
        ├── catalog/dedupe.test.ts
        ├── catalog/barcodeLookup.ts
        ├── catalog/barcodeLookup.test.ts
        └── actions/coffee.ts
```

---

## Task 1: Scaffold the repository

**Files:**
- Create: entire initial Next.js project (via `create-next-app`)
- Create: `.gitignore` additions, `.env.local.example`
- Create: `CLAUDE.md`, `.claude/settings.json`, `.claude/hooks/block-audit-force.sh`, `.claude/hooks/remind-npm-audit.sh`

**Interfaces:**
- Produces: a git repo at `coffee-app/` with Next.js 16 App Router, TypeScript, Tailwind, ESLint, `src/` directory, import alias `@/*`, pushed to `https://github.com/ccmalcom/coffee-app.git` (already created, currently empty).

**Note:** the GitHub repo (`https://github.com/ccmalcom/coffee-app.git`) and the Supabase project (ref `ojaznjstjrzfuinbxner`, see Task 4) already exist — this task pushes into the existing empty repo rather than creating one.

- [ ] **Step 1: Verify latest stable versions live (never assume from training data)**

```bash
cd ~/coding-projects/coffee-app
npm view next version
npm view react version
npm view typescript version
npm view tailwindcss version
```

Expected (as verified 2026-07-07 — re-check the day you actually run this, versions may have moved): `next 16.2.10`, `react 19.2.7`, `typescript 6.0.3`, `tailwindcss 4.3.2`. If newer stable versions exist now, use those instead — the whole point of this step is to never hardcode a stale version.

- [ ] **Step 2: Scaffold with create-next-app**

```bash
cd ~/coding-projects
npx create-next-app@latest coffee-app \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --yes
cd coffee-app
```

- [ ] **Step 3: Confirm the dev server boots**

```bash
npm run build
```

Expected: build succeeds with no errors (default template page).

- [ ] **Step 4: Add `.env.local.example`**

```bash
cat > .env.local.example << 'EOF'
# Supabase project (Project Settings → API)
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=

# Postgres connection strings (Project Settings → Database → Connect)
# DATABASE_URL: "Transaction" pooler (port 6543) — used by the running app.
# DIRECT_URL: "Session" pooler or direct connection (port 5432) — used only by drizzle-kit migrations.
DATABASE_URL=
DIRECT_URL=

# Anthropic (console.anthropic.com)
ANTHROPIC_API_KEY=
EOF
echo ".env.local" >> .gitignore
```

- [ ] **Step 5: Initial commit and push to the existing GitHub remote**

```bash
git add -A
git commit -m "chore: scaffold Next.js 16 app"
git remote add origin https://github.com/ccmalcom/coffee-app.git
git branch -M main
git push -u origin main
```

Expected: push succeeds against the empty repo Chase already created. If `git push` fails with an auth prompt, stop and ask Chase to authenticate (`gh auth login` or a credential helper) rather than embedding a token in the remote URL.

- [ ] **Step 6: Write `CLAUDE.md`**

```markdown
# Coffee App

Personal espresso companion: Coffee Log + Grind Dial-In Assistant + Discovery Engine, built against the approved MVP design spec.

**Read first:** `docs/specs/2026-07-07-coffee-app-mvp-design.md` (design, locked decisions) and the active plan under `docs/plans/` (current build tasks). Don't relitigate decisions already locked in the spec — flag disagreement instead of silently deviating.

## Stack
Next.js 16 (App Router) on Vercel · Supabase (Postgres + Auth) · Drizzle ORM (postgres-js) · Anthropic TypeScript SDK · Zod · @zxing/browser · Serwist (PWA) · Vitest + Testing Library.

## Commands
- `npm run dev` / `npm run build` / `npm run start`
- `npm run lint` · `npm run test` (watch) · `npm run test:run` (CI mode)
- `npm run db:generate` · `npm run db:push` · `npm run db:studio` — Drizzle migrations; pass `--env-file=.env.local` if env vars aren't already loaded
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

## Infra already provisioned
- GitHub: `https://github.com/ccmalcom/coffee-app.git`
- Supabase: project ref `ojaznjstjrzfuinbxner` ("coffee-app", us-east-1, Postgres 17.6) — see Task 4 of Plan 1 for credentials.
```

- [ ] **Step 7: Check for `jq` (required by the hooks in Step 8)**

```bash
jq --version
```

Expected: a version string. If missing, install it before continuing (`winget install jqlang.jq`, or via Git Bash's package manager, or download from jqlang.org) — the hook scripts below parse hook JSON input with `jq` and will silently no-op without it.

- [ ] **Step 8: Add project hooks enforcing the dependency security policy**

```bash
mkdir -p .claude/hooks
```

```json
// .claude/settings.json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(npm audit *)",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/block-audit-force.sh",
            "args": []
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(npm install*)",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/remind-npm-audit.sh",
            "args": []
          },
          {
            "type": "command",
            "if": "Bash(npm update*)",
            "command": "${CLAUDE_PROJECT_DIR}/.claude/hooks/remind-npm-audit.sh",
            "args": []
          }
        ]
      }
    ]
  }
}
```

```bash
#!/bin/bash
# .claude/hooks/block-audit-force.sh
# Blocks `npm audit fix --force`. Per CLAUDE.md's dependency security policy:
# breaking vulnerability fixes require a written mini-plan and explicit
# approval first — never an automatic forced upgrade.
COMMAND=$(jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE -- '--force'; then
  echo "Blocked: '$COMMAND' includes --force. CLAUDE.md's dependency security policy requires a written mini-plan and explicit approval before any breaking dependency upgrade. Use 'npm audit fix' (non-breaking only), or write the mini-plan first." >&2
  exit 2
fi

exit 0
```

```bash
#!/bin/bash
# .claude/hooks/remind-npm-audit.sh
# Reminds Claude to audit after every npm install/update, per CLAUDE.md's
# non-negotiable dependency security policy.
MSG="A package install/update just ran. This project requires npm audit immediately after every npm install or npm update: apply npm audit fix for any non-breaking vulnerability; if only a breaking fix is offered, stop and write a mini-plan for approval instead of running npm audit fix --force."

jq -n --arg msg "$MSG" '{
  hookSpecificOutput: {
    hookEventName: "PostToolUse",
    additionalContext: $msg
  }
}'
```

```bash
chmod +x .claude/hooks/block-audit-force.sh .claude/hooks/remind-npm-audit.sh
```

- [ ] **Step 9: Verify the block hook works, then commit**

```bash
echo '{"tool_input": {"command": "npm audit fix --force"}}' | .claude/hooks/block-audit-force.sh; echo "exit code: $?"
```

Expected: prints the "Blocked: ..." message and `exit code: 2`.

```bash
git add -A
git commit -m "chore: add CLAUDE.md and dependency-security hooks"
git push
```

---

## Task 2: Vitest + Testing Library setup

**Files:**
- Create: `vitest.config.ts`
- Create: `src/lib/sanity.test.ts` (deleted at the end of this task once real tests exist elsewhere — kept only to prove the pipeline works)
- Modify: `package.json` (scripts, devDependencies)

**Interfaces:**
- Produces: `npm test` (watch) and `npm run test:run` (CI mode) commands available to every later task.

- [ ] **Step 1: Install test dependencies**

```bash
npm install -D vitest@4.1.10 @testing-library/react@16.3.2 \
  @testing-library/jest-dom@6.9.1 @testing-library/user-event@14.6.1 \
  jsdom@29.1.1 @vitejs/plugin-react@6.0.3 vite-tsconfig-paths@6.1.1
npm audit
```

Expected: `npm audit` reports 0 vulnerabilities from this install (Vitest/Testing Library are dev-only, well-maintained). If it reports any, run `npm audit fix` for non-breaking fixes; if only a breaking fix is offered, stop and write a mini-plan before proceeding (per Global Constraints).

- [ ] **Step 2: Write `vitest.config.ts`**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
})
```

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
```

- [ ] **Step 3: Add scripts to `package.json`**

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run"
  }
}
```

- [ ] **Step 4: Write a failing sanity test**

```typescript
// src/lib/sanity.test.ts
import { describe, it, expect } from 'vitest'

describe('vitest pipeline', () => {
  it('adds numbers', () => {
    expect(1 + 1).toBe(3)
  })
})
```

- [ ] **Step 5: Run it and confirm it fails**

Run: `npm run test:run`
Expected: FAIL — `expected 2 to be 3`.

- [ ] **Step 6: Fix the assertion and confirm it passes**

```typescript
// src/lib/sanity.test.ts
import { describe, it, expect } from 'vitest'

describe('vitest pipeline', () => {
  it('adds numbers', () => {
    expect(1 + 1).toBe(2)
  })
})
```

Run: `npm run test:run`
Expected: PASS (1 test).

- [ ] **Step 7: Delete the sanity test and commit**

```bash
rm src/lib/sanity.test.ts
git add -A
git commit -m "chore: set up Vitest + Testing Library"
```

---

## Task 3: CI workflow + audit baseline

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Produces: a CI pipeline every later task's PR runs against. No new runtime interfaces.

- [ ] **Step 1: Record the current audit baseline**

```bash
npm audit --json > /tmp/audit-baseline.json
cat /tmp/audit-baseline.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d['metadata']['vulnerabilities'])"
```

At the time this plan was written, this reports one **moderate** advisory: `drizzle-kit`'s transitive `esbuild` dependency (GHSA-67mh-4wv8-2f99 — the esbuild dev server accepts cross-origin requests). `npm audit fix` offers only a downgrade to `drizzle-kit@0.18.1` (semver-major, loses years of features) — that is a breaking fix and per Global Constraints must not be applied without a written mini-plan and approval. Accepted risk: `drizzle-kit` only runs as a local/CI dev tool (`db:generate`/`db:push`), it is never bundled into the deployed app, so the vulnerable dev-server code path is never exposed in production. Re-run `npm audit` after this step in case a non-breaking `drizzle-kit` patch has shipped since — if `fixAvailable` becomes non-major, apply it.

- [ ] **Step 2: Write the workflow**

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  build-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'npm'
      - run: npm ci
      - name: npm audit (non-blocking on known-accepted moderate advisories)
        run: npm audit --audit-level=high
      - run: npm run lint
      - run: npm run test:run
      - run: npm run build
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

`--audit-level=high` fails CI on new high/critical vulnerabilities while not failing the build on the already-reviewed moderate `drizzle-kit` advisory above. Re-tighten to `moderate` once that advisory is resolved upstream.

- [ ] **Step 3: Verify the commands the workflow depends on all pass locally**

```bash
npm run lint
npm run test:run
npm run build
```

Expected: all three succeed. The repo already has a GitHub remote (`https://github.com/ccmalcom/coffee-app.git`, pushed in Task 1) so this workflow starts running for real on the next push in Step 4 — check the Actions tab after pushing to confirm it goes green. It will fail on the `npm run build` step until Task 4's env vars exist as repo secrets (Settings → Secrets and variables → Actions): `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `ANTHROPIC_API_KEY`. Add those secrets now if Task 4 has already run; otherwise note it as follow-up and move on — CI failing on missing secrets before Task 4 exists is expected, not a regression.

- [ ] **Step 4: Commit and push**

```bash
git add -A
git commit -m "ci: add GitHub Actions workflow with audit gate"
git push
```

---

## Task 4: Supabase environment config (project already provisioned)

**Files:**
- Modify: `.env.local` (gitignored, not committed)
- Create: `scripts/verify-db-connection.ts`

**Interfaces:**
- Produces: working `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `DATABASE_URL`, `DIRECT_URL` in `.env.local` that every later task's database/auth code depends on.

**The Supabase project already exists — do not create a new one.** Provisioned 2026-07-07:
- ref: `ojaznjstjrzfuinbxner`
- name: `coffee-app`, region: `us-east-1`, Postgres 17.6
- URL: `https://ojaznjstjrzfuinbxner.supabase.co`
- Publishable key: `sb_publishable_UoYs0HmM3Im7mLonDtJC0g_70T59HQs`

If the Supabase MCP is connected in this environment, run `get_project` with id `ojaznjstjrzfuinbxner` first to confirm it's still `ACTIVE_HEALTHY` before trusting the values above — they may have changed since this plan was written.

- [ ] **Step 1: Fill in the known values in `.env.local`**

```bash
# .env.local (do not commit)
NEXT_PUBLIC_SUPABASE_URL=https://ojaznjstjrzfuinbxner.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_UoYs0HmM3Im7mLonDtJC0g_70T59HQs
DATABASE_URL=
DIRECT_URL=
```

- [ ] **Step 2: Collect the two Postgres connection strings**

Ask Chase for this project's database password — it was set at project creation and cannot be retrieved via API or MCP. Then, from the Supabase dashboard for this project (Project Settings → Database → Connect): copy the "Transaction pooler" (port 6543) string into `DATABASE_URL`, and the "Session pooler" or "Direct connection" (port 5432) string into `DIRECT_URL`. URL-encode any special characters in the password.

```bash
# .env.local (do not commit)
DATABASE_URL=postgresql://postgres.ojaznjstjrzfuinbxner:PASSWORD@aws-x-xx-xxxx-x.pooler.supabase.com:6543/postgres
DIRECT_URL=postgresql://postgres.ojaznjstjrzfuinbxner:PASSWORD@aws-x-xx-xxxx-x.pooler.supabase.com:5432/postgres
```

- [ ] **Step 3: Write a connection-verification script**

```typescript
// scripts/verify-db-connection.ts
import postgres from 'postgres'

async function main() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  const sql = postgres(url, { prepare: false })
  const [{ now }] = await sql`select now()`
  console.log('Connected. DB time:', now)
  await sql.end()
}

main().catch((err) => {
  console.error('Connection failed:', err)
  process.exit(1)
})
```

- [ ] **Step 4: Install the driver and run it**

```bash
npm install postgres@3.4.9
npm install -D tsx@4.23.0
npm audit
node --env-file=.env.local --experimental-strip-types -e "" 2>/dev/null || true
npx tsx --env-file=.env.local scripts/verify-db-connection.ts
```

Expected: `Connected. DB time: <timestamp>`. If it fails, re-check the connection string (most common issue: unencoded special characters in the password, or using the pooler hostname with the wrong port).

- [ ] **Step 5: Add the verify script to package.json and commit**

```json
{
  "scripts": {
    "verify:db": "tsx --env-file=.env.local scripts/verify-db-connection.ts"
  }
}
```

```bash
git add -A
git commit -m "chore: add DB connection verification script"
```

(`.env.local` itself is gitignored and never committed.)

---

## Task 5: Drizzle client + config

**Files:**
- Create: `drizzle.config.ts`
- Create: `src/lib/db/index.ts`
- Create: `src/lib/db/schema/index.ts` (empty barrel for now, filled in Tasks 6–7)

**Interfaces:**
- Consumes: `DATABASE_URL`, `DIRECT_URL` from Task 4.
- Produces: `export const db` (Drizzle instance) from `src/lib/db/index.ts`, used by every later data-access task.

- [ ] **Step 1: Install Drizzle**

```bash
npm install drizzle-orm@0.45.2
npm install -D drizzle-kit@0.31.10
npm audit
```

Expected: the known moderate `drizzle-kit`/`esbuild` advisory from Task 3 (accepted, dev-only). No new advisories.

- [ ] **Step 2: Write `drizzle.config.ts`**

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DIRECT_URL!,
  },
})
```

- [ ] **Step 3: Write the runtime DB client**

```typescript
// src/lib/db/index.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const client = postgres(process.env.DATABASE_URL!, { prepare: false })

export const db = drizzle({ client, schema })
```

- [ ] **Step 4: Create the empty schema barrel**

```typescript
// src/lib/db/schema/index.ts
// Populated in Tasks 6-7.
export {}
```

- [ ] **Step 5: Add drizzle-kit scripts and confirm it can reach the DB**

```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

```bash
npx drizzle-kit generate --env-file=.env.local
```

Expected: `No schema changes, nothing to migrate 😴` (or it creates an empty migration) — either way, no connection error. This confirms `DIRECT_URL` is reachable before real tables are added.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: configure Drizzle ORM against Supabase Postgres"
```

---

## Task 6: Database schema — shared catalog tables

**Files:**
- Create: `src/lib/db/schema/catalog.ts`
- Modify: `src/lib/db/schema/index.ts`

**Interfaces:**
- Produces: `roasters`, `coffees` tables and `addedViaEnum`, `processEnum`, `flavorOriginEnum`, `parseConfidenceEnum` — imported by `src/lib/db/schema/user.ts` (Task 7), `src/lib/parsing/schema.ts` (Task 10), `src/lib/catalog/dedupe.ts` (Task 12).

- [ ] **Step 1: Write the catalog schema**

```typescript
// src/lib/db/schema/catalog.ts
import { sql } from 'drizzle-orm'
import {
  pgTable,
  uuid,
  text,
  varchar,
  boolean,
  integer,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core'

export const addedViaEnum = pgEnum('added_via', ['manual', 'discovery'])

export const processEnum = pgEnum('process', [
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'carbonic_maceration',
  'nitro_washed',
  'co_ferment',
  'thermal_shock',
  'other',
])

export const flavorOriginEnum = pgEnum('flavor_origin', ['process', 'added', 'unknown'])

export const parseConfidenceEnum = pgEnum('parse_confidence', ['HIGH', 'MEDIUM', 'LOW'])

export const roasters = pgTable('roasters', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  website: text('website'),
  location: text('location'),
  watched: boolean('watched').notNull().default(false),
  addedVia: addedViaEnum('added_via').notNull().default('manual'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const coffees = pgTable('coffees', {
  id: uuid('id').primaryKey().defaultRandom(),
  roasterId: uuid('roaster_id')
    .notNull()
    .references(() => roasters.id),
  name: text('name').notNull(),
  originCountry: text('origin_country'),
  originRegion: text('origin_region'),
  producer: text('producer'),
  variety: text('variety'),
  process: processEnum('process'),
  processDetail: text('process_detail'),
  flavorOrigin: flavorOriginEnum('flavor_origin').notNull().default('unknown'),
  tastingNotes: text('tasting_notes')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  rawListingText: text('raw_listing_text'),
  listingUrl: text('listing_url').unique(),
  barcode: varchar('barcode', { length: 64 }).unique(),
  priceCents: integer('price_cents'),
  sizeGrams: integer('size_grams'),
  parseConfidence: parseConfidenceEnum('parse_confidence').notNull().default('LOW'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})
```

- [ ] **Step 2: Re-export from the schema barrel**

```typescript
// src/lib/db/schema/index.ts
export * from './catalog'
```

- [ ] **Step 3: Generate and review the migration**

```bash
npx drizzle-kit generate --env-file=.env.local
```

Expected: a new file under `drizzle/0000_*.sql` creating the enums, `roasters`, and `coffees`. Open it and confirm it matches the schema above — no accidental column drops (there's nothing to drop yet, but this habit matters for every later migration).

- [ ] **Step 4: Push to the database and verify**

```bash
npx drizzle-kit push --env-file=.env.local
npx drizzle-kit studio --env-file=.env.local
```

Expected: `drizzle-kit studio` opens a browser view showing empty `roasters` and `coffees` tables with the correct columns. Stop the studio process once confirmed.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): add shared catalog schema (roasters, coffees)"
```

---

## Task 7: Database schema — per-user tables

**Files:**
- Create: `src/lib/db/schema/user.ts`
- Modify: `src/lib/db/schema/index.ts`

**Interfaces:**
- Consumes: `coffees` from `./catalog` (Task 6).
- Produces: `libraryEntries`, `equipment`, `shots`, `tasteProfile`, `directives`, `discoveryRuns` tables. `libraryEntries` and `libraryStatusEnum` are consumed by `src/lib/actions/coffee.ts` (Task 14).

- [ ] **Step 1: Write the per-user schema**

```typescript
// src/lib/db/schema/user.ts
import { sql } from 'drizzle-orm'
import {
  pgTable,
  pgSchema,
  uuid,
  text,
  varchar,
  integer,
  real,
  boolean,
  jsonb,
  timestamp,
  pgEnum,
} from 'drizzle-orm/pg-core'
import { coffees } from './catalog'

// Supabase manages this table; we only need a typed reference for FKs.
const authSchema = pgSchema('auth')
export const authUsers = authSchema.table('users', {
  id: uuid('id').primaryKey(),
})

export const libraryStatusEnum = pgEnum('library_status', [
  'candidate',
  'wishlist',
  'owned',
  'finished',
])

export const equipmentKindEnum = pgEnum('equipment_kind', ['grinder', 'machine'])

export const shotOutcomeTagEnum = pgEnum('shot_outcome_tag', [
  'sour',
  'bitter',
  'weak',
  'harsh',
  'balanced',
  'excellent',
])

export const discoveryRunTypeEnum = pgEnum('discovery_run_type', ['roaster_check', 'web_search'])

export const libraryEntries = pgTable('library_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id),
  coffeeId: uuid('coffee_id')
    .notNull()
    .references(() => coffees.id),
  status: libraryStatusEnum('status').notNull().default('candidate'),
  rating: integer('rating'),
  review: text('review'),
  discoveryScore: real('discovery_score'),
  discoveryExplanation: text('discovery_explanation'),
  discoveredInRunId: uuid('discovered_in_run_id'),
  acquiredAt: timestamp('acquired_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
})

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
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const shots = pgTable('shots', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id),
  coffeeId: uuid('coffee_id')
    .notNull()
    .references(() => coffees.id),
  grinderId: uuid('grinder_id')
    .notNull()
    .references(() => equipment.id),
  machineId: uuid('machine_id')
    .notNull()
    .references(() => equipment.id),
  method: varchar('method', { length: 32 }).notNull().default('espresso'),
  doseGrams: real('dose_g').notNull(),
  yieldGrams: real('yield_g').notNull(),
  timeSeconds: real('time_s').notNull(),
  grindSetting: text('grind_setting').notNull(),
  outcomeTags: shotOutcomeTagEnum('outcome_tags')
    .array()
    .notNull()
    .default(sql`'{}'::shot_outcome_tag[]`),
  note: text('note'),
  rating: integer('rating'),
  brewedAt: timestamp('brewed_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

export const tasteProfile = pgTable('taste_profile', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => authUsers.id),
  builtAt: timestamp('built_at', { withTimezone: true }).notNull().defaultNow(),
  profile: jsonb('profile').notNull(),
  stale: boolean('stale').notNull().default(false),
})

export const directives = pgTable('directives', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .unique()
    .references(() => authUsers.id),
  goals: text('goals')
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  freeText: text('free_text'),
  excludeAddedFlavor: boolean('exclude_added_flavor').notNull().default(true),
  editedAt: timestamp('edited_at', { withTimezone: true }).notNull().defaultNow(),
})

export const discoveryRuns = pgTable('discovery_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  type: discoveryRunTypeEnum('type').notNull(),
  source: text('source'),
  candidatesFound: integer('candidates_found').notNull().default(0),
  candidatesCreated: integer('candidates_created').notNull().default(0),
  errors: jsonb('errors'),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
})
```

- [ ] **Step 2: Re-export from the schema barrel**

```typescript
// src/lib/db/schema/index.ts
export * from './catalog'
export * from './user'
```

- [ ] **Step 3: Generate, review, and push the migration**

```bash
npx drizzle-kit generate --env-file=.env.local
```

Expected: a new migration creating `library_entries`, `equipment`, `shots`, `taste_profile`, `directives`, `discovery_runs`, plus the four new enums. It should NOT try to create `auth.users` — Drizzle should recognize it as an existing external table and only add the FK references. If the generated SQL includes a `CREATE TABLE auth.users` statement, stop and manually strip that statement from the migration file before pushing (this schema stub exists only for typed FKs, not to create Supabase's real auth table).

```bash
npx drizzle-kit push --env-file=.env.local
```

- [ ] **Step 4: Verify in Studio**

```bash
npx drizzle-kit studio --env-file=.env.local
```

Expected: all six per-user tables visible with correct columns and FKs to `coffees`/`equipment`/`auth.users`.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(db): add per-user schema (library_entries, equipment, shots, taste_profile, directives, discovery_runs)"
```

---

## Task 8: Supabase Auth (single-user, email + password)

**Files:**
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Create: `src/lib/auth/requireUserId.ts`
- Create: `src/proxy.ts`
- Create: `src/app/login/page.tsx`, `src/app/login/actions.ts`
- Create: `src/components/auth/LoginForm.tsx`
- Create: `src/app/signup/page.tsx`, `src/components/auth/SignupForm.tsx`
- Modify: `src/app/layout.tsx`, `src/app/page.tsx`

**Interfaces:**
- Produces: `createClient()` (browser, sync) from `src/lib/supabase/client.ts`; `createClient()` (server, async) from `src/lib/supabase/server.ts`; `requireUserId(): Promise<string>` from `src/lib/auth/requireUserId.ts` — consumed by every server action in Task 14 and every server component page in Tasks 15–16.

- [ ] **Step 1: Install Supabase packages**

```bash
npm install @supabase/supabase-js@2.110.1 @supabase/ssr@0.12.0
npm audit
```

- [ ] **Step 2: Browser client**

```typescript
// src/lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

- [ ] **Step 3: Server client**

```typescript
// src/lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Called from a Server Component that can't set cookies — proxy.ts refreshes the session instead.
          }
        },
      },
    }
  )
}
```

- [ ] **Step 4: `requireUserId` helper**

```typescript
// src/lib/auth/requireUserId.ts
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function requireUserId(): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (error || !userId) {
    redirect('/login')
  }
  return userId
}
```

- [ ] **Step 5: `proxy.ts` — session refresh + route guard**

Next.js 16 renamed the `middleware.ts` convention to `proxy.ts` (exported function `proxy`, not `middleware`); it now defaults to the Node.js runtime. Using the old filename is silently ignored at build time, so this must be named exactly `proxy.ts` at `src/`.

```typescript
// src/proxy.ts
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_PATHS = ['/login', '/signup']

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data } = await supabase.auth.getClaims()
  const isPublic = PUBLIC_PATHS.some((p) => request.nextUrl.pathname.startsWith(p))

  if (!data?.claims && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons).*)'],
}
```

- [ ] **Step 6: Login page, form, and server action**

```typescript
// src/app/login/actions.ts
'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export async function signIn(formData: FormData) {
  const email = String(formData.get('email'))
  const password = String(formData.get('password'))
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) {
    redirect(`/login?error=${encodeURIComponent(error.message)}`)
  }
  redirect('/library')
}
```

```typescript
// src/components/auth/LoginForm.tsx
'use client'

import { signIn } from '@/app/login/actions'

export function LoginForm({ error }: { error?: string }) {
  return (
    <form action={signIn} className="flex flex-col gap-3 max-w-sm mx-auto p-6">
      <h1 className="text-xl font-semibold">Log in</h1>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <input name="email" type="email" placeholder="Email" required className="border rounded p-2" />
      <input name="password" type="password" placeholder="Password" required className="border rounded p-2" />
      <button type="submit" className="bg-black text-white rounded p-2">Log in</button>
      <a href="/signup" className="text-sm text-center underline">Need an account?</a>
    </form>
  )
}
```

```typescript
// src/app/login/page.tsx
import { LoginForm } from '@/components/auth/LoginForm'

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  return <LoginForm error={error} />
}
```

- [ ] **Step 7: Signup page (one-time bootstrap for Chase's account)**

```typescript
// src/components/auth/SignupForm.tsx
'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export function SignupForm() {
  const [message, setMessage] = useState<string | null>(null)
  const router = useRouter()

  async function handleSubmit(formData: FormData) {
    const supabase = createClient()
    const { error } = await supabase.auth.signUp({
      email: String(formData.get('email')),
      password: String(formData.get('password')),
    })
    if (error) {
      setMessage(error.message)
      return
    }
    setMessage('Account created. Check your email to confirm, then log in.')
    setTimeout(() => router.push('/login'), 1500)
  }

  return (
    <form action={handleSubmit} className="flex flex-col gap-3 max-w-sm mx-auto p-6">
      <h1 className="text-xl font-semibold">Create account</h1>
      {message && <p className="text-sm">{message}</p>}
      <input name="email" type="email" placeholder="Email" required className="border rounded p-2" />
      <input name="password" type="password" placeholder="Password (min 6 chars)" required minLength={6} className="border rounded p-2" />
      <button type="submit" className="bg-black text-white rounded p-2">Sign up</button>
    </form>
  )
}
```

```typescript
// src/app/signup/page.tsx
import { SignupForm } from '@/components/auth/SignupForm'

export default function SignupPage() {
  return <SignupForm />
}
```

- [ ] **Step 8: Root redirect**

```typescript
// src/app/page.tsx
import { redirect } from 'next/navigation'

export default function RootPage() {
  redirect('/library')
}
```

(`/library` doesn't exist until Task 16 — `proxy.ts` will correctly bounce unauthenticated requests to `/login` in the meantime; once Task 16 lands, authenticated requests reach the real page.)

- [ ] **Step 9: Manual verification**

```bash
npm run build
npm run dev
```

Visit `http://localhost:3000` — expect a redirect to `/login`. Go to `/signup`, create Chase's one account, confirm via the email link, log in, confirm you land on (a currently 404) `/library` rather than bouncing back to `/login` — that 404-not-redirect is the proof the auth guard works.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(auth): single-user email+password auth with proxy-based session refresh"
```

---

## Task 9: Knowledge corpus

**Files:**
- Create: `knowledge/process-taxonomy.md`
- Create: `knowledge/tasting-note-vocabulary.md`

**Interfaces:**
- Produces: human-reviewable markdown consumed directly by Task 10's Zod schema comments/enum and Task 11's parser prompt (referenced by content, not imported as code).

- [ ] **Step 1: Write the process taxonomy**

```markdown
<!-- knowledge/process-taxonomy.md -->
# Espresso/Coffee Process Taxonomy (v1)

Canonical `process` enum values, what they mean, and how roasters typically phrase them on listings. This is the ground truth the LLM listing parser maps messy listing language onto.

## washed
Cherry is depulped, fermented briefly to remove remaining mucilage, then washed clean before drying. Cleanest, most transparent cup; origin/varietal character shows clearly, floral/citrus/tea-like notes common.
Listing phrases: "fully washed", "wet process", "washed process".

## natural
Whole cherry dried intact (skin and pulp on), then hulled after drying. Fruit sugars ferment against the bean through the whole drying period. Heavier body, pronounced fruit/wine/fermented notes.
Listing phrases: "natural process", "dry process", "sun-dried".

## honey
Skin removed, some or all mucilage (the "honey") left on during drying. Sits between washed and natural; named by mucilage retained (white/yellow/red/black honey, lightest to heaviest).
Listing phrases: "honey process", "pulped natural", "miel process", "yellow/red/black honey".

## anaerobic
Cherry (or depulped bean) ferments in a sealed, oxygen-free tank before further processing (which may itself be washed/natural/honey). Produces intense, often funky or fruit-candy flavors from anaerobic fermentation byproducts.
Listing phrases: "anaerobic fermentation", "anaerobic natural", "anaerobic washed".

## carbonic_maceration
A wine-technique variant of anaerobic processing: whole cherries ferment in a CO2-flooded sealed tank (CO2 added or produced by initial fermentation), suppressing browning and building distinct fruity/floral esters before drying.
Listing phrases: "carbonic maceration", "CM process".

## nitro_washed
Cherry or parchment ferments in a sealed tank flushed with nitrogen (not just CO2 self-generated) before washing. A newer, more controlled anaerobic variant — extremely aromatic, candy/tropical-fruit-forward. **Permanent calibration case: Tinker's Colombia "Julio Madrid Caturra Nitro"** must map here.
Listing phrases: "nitro washed", "nitrogen-flushed fermentation", "N2 washed".

## co_ferment
Fruit, spices, or other flavor-adjacent organic matter is fermented together with the cherry/parchment. Produces additive-adjacent flavors, but the flavor still originates in a fermentation process rather than a post-roast additive — distinguish from actually flavored coffee (see `flavor_origin`).
Listing phrases: "co-ferment", "cherry-fermented with [fruit]", "mosto process".

## thermal_shock
Cherry or parchment is exposed to a deliberate temperature shock (hot water bath, then cold, or similar) partway through fermentation/drying to arrest or alter fermentation activity.
Listing phrases: "thermal shock process", "thermal shock fermentation".

## other
Anything not covered above (e.g. novel/proprietary named processes). Use `process = 'other'` and put the roaster's own phrase verbatim in `process_detail` — never force a bad-fit match into one of the categories above.

## flavor_origin (not a process, but decided alongside it)
- `process` — wild/intense flavors are a genuine side effect of fermentation/processing (the target of Discovery). Anaerobic, nitro-washed, carbonic maceration, and co-ferment coffees are usually `process` even when notes sound like candy.
- `added` — flavoring was added after roasting (flavored syrups/oils, e.g. "hazelnut flavored", "pumpkin spice flavored"). Chase's directive excludes these from Discovery.
- `unknown` — listing doesn't give enough information to tell; default until the parser or a human resolves it.
```

- [ ] **Step 2: Write the tasting-note vocabulary**

```markdown
<!-- knowledge/tasting-note-vocabulary.md -->
# Tasting-Note Normalization Map (v1)

Maps free-text roaster tasting notes onto a small set of flavor-territory clusters. Seeds `coffees.tasting_notes` normalization and the taste-profile clusters built in Plan 3.

## fruit_candied
watermelon bubble gum, strawberry yogurt candy, mango creamsicle, pink lemonade, tropical candy, fruit punch, bubblegum, cotton candy, jolly rancher, skittles

## fruit_fresh
strawberry, blueberry, raspberry, cherry, red apple, green apple, pear, peach, apricot, plum, grape

## fruit_dried_wine
raisin, fig, date, dried cherry, port wine, red wine, tannic, boozy, fermented fruit

## citrus
lemon, lime, orange, grapefruit, bergamot, mandarin, tangerine

## floral
jasmine, rose, hibiscus, lavender, orange blossom, chamomile, bergamot floral

## tropical
pineapple, papaya, passionfruit, guava, lychee, mango (fresh, non-candied)

## nutty_cocoa
almond, hazelnut, walnut, peanut, cocoa, dark chocolate, milk chocolate, cocoa nib

## sweet_dessert
caramel, brown sugar, molasses, maple syrup, honey, vanilla, toffee, marshmallow

## spice
cinnamon, clove, nutmeg, black pepper, ginger, allspice

## funky_savory
funky, barnyard, umami, olive, soy, fermented, cheesy, gamey

## Normalization rule
Store `tasting_notes` as the roaster's own normalized short phrases (lowercased, trimmed — e.g. "watermelon bubble gum"), not the cluster names themselves. Cluster names are a separate lookup the taste profile (Plan 3) computes over these phrases. This file is that lookup's seed data — extend it as new phrases show up in real listings.
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "docs: add process taxonomy and tasting-note vocabulary knowledge corpus"
```

---

## Task 10: Zod parsing schema

**Files:**
- Create: `src/lib/parsing/schema.ts`

**Interfaces:**
- Consumes: `processEnum` values from `src/lib/db/schema/catalog.ts` (Task 6) — kept as a literal array here, not imported, so this module has no DB dependency (it's used client-adjacent by the parser, which must stay a pure function of text in / structured data out).
- Produces: `ParsedListingSchema` (Zod), `type ParsedListing = z.infer<typeof ParsedListingSchema>`, `PROCESS_VALUES`, `FLAVOR_ORIGIN_VALUES` — consumed by `src/lib/parsing/parseListing.ts` (Task 11) and `src/lib/catalog/dedupe.ts` (Task 12).

- [ ] **Step 1: Install Zod**

```bash
npm install zod@4.4.3
npm audit
```

- [ ] **Step 2: Write a failing test for the schema's shape**

```typescript
// src/lib/parsing/schema.test.ts
import { describe, it, expect } from 'vitest'
import { ParsedListingSchema } from './schema'

describe('ParsedListingSchema', () => {
  it('accepts a complete valid listing', () => {
    const result = ParsedListingSchema.safeParse({
      roasterName: 'Tinker Coffee Co.',
      roasterWebsite: 'https://tinkercoffee.com',
      coffeeName: 'Julio Madrid Caturra Nitro',
      originCountry: 'Colombia',
      originRegion: null,
      producer: 'Julio Madrid',
      variety: 'Caturra',
      process: 'nitro_washed',
      processDetail: 'Nitro Washed',
      flavorOrigin: 'process',
      tastingNotes: ['watermelon bubble gum', 'strawberry yogurt candy'],
      priceCents: 2200,
      sizeGrams: 227,
      parseConfidence: 'HIGH',
    })
    expect(result.success).toBe(true)
  })

  it('rejects an invalid process value', () => {
    const result = ParsedListingSchema.safeParse({
      roasterName: 'Test Roaster',
      roasterWebsite: null,
      coffeeName: 'Test Coffee',
      originCountry: null,
      originRegion: null,
      producer: null,
      variety: null,
      process: 'sous_vide',
      processDetail: null,
      flavorOrigin: 'unknown',
      tastingNotes: [],
      priceCents: null,
      sizeGrams: null,
      parseConfidence: 'LOW',
    })
    expect(result.success).toBe(false)
  })

  it('requires roasterName and coffeeName', () => {
    const result = ParsedListingSchema.safeParse({ roasterName: '', coffeeName: '' })
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 2b: Run it and confirm it fails (schema doesn't exist yet)**

Run: `npm run test:run -- schema.test.ts`
Expected: FAIL — cannot find module `./schema`.

- [ ] **Step 3: Write the schema**

```typescript
// src/lib/parsing/schema.ts
import { z } from 'zod'

export const PROCESS_VALUES = [
  'washed',
  'natural',
  'honey',
  'anaerobic',
  'carbonic_maceration',
  'nitro_washed',
  'co_ferment',
  'thermal_shock',
  'other',
] as const

export const FLAVOR_ORIGIN_VALUES = ['process', 'added', 'unknown'] as const

export const PARSE_CONFIDENCE_VALUES = ['HIGH', 'MEDIUM', 'LOW'] as const

export const ParsedListingSchema = z.object({
  roasterName: z.string().min(1),
  roasterWebsite: z.string().url().nullable(),
  coffeeName: z.string().min(1),
  originCountry: z.string().nullable(),
  originRegion: z.string().nullable(),
  producer: z.string().nullable(),
  variety: z.string().nullable(),
  process: z.enum(PROCESS_VALUES).nullable(),
  processDetail: z.string().nullable(),
  flavorOrigin: z.enum(FLAVOR_ORIGIN_VALUES),
  tastingNotes: z.array(z.string()),
  priceCents: z.number().int().nonnegative().nullable(),
  sizeGrams: z.number().int().positive().nullable(),
  parseConfidence: z.enum(PARSE_CONFIDENCE_VALUES),
})

export type ParsedListing = z.infer<typeof ParsedListingSchema>
```

- [ ] **Step 4: Run tests and confirm they pass**

Run: `npm run test:run -- schema.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(parsing): add Zod schema for parsed coffee listings"
```

---

## Task 11: Anthropic listing parser + permanent calibration fixture

**Files:**
- Create: `src/lib/parsing/fixtures/julioMadridCaturraNitro.ts`
- Create: `src/lib/parsing/parseListing.ts`
- Create: `src/lib/parsing/parseListing.test.ts`

**Interfaces:**
- Consumes: `ParsedListingSchema`, `ParsedListing` from `./schema` (Task 10).
- Produces: `export async function parseListing(rawText: string): Promise<ParsedListing>` — consumed by `src/lib/actions/coffee.ts` (Task 14). Never throws on a bad-but-parseable listing (returns best-effort `parseConfidence: 'LOW'` instead, per spec's "never silently dropped"); only throws `ListingParseError` if the Anthropic API call itself fails twice (network/auth/rate-limit), which the caller in Task 14 catches and surfaces as a retry-later message.

- [ ] **Step 1: Install the Anthropic SDK**

```bash
npm install @anthropic-ai/sdk@0.110.0
npm audit
```

- [ ] **Step 2: Write the permanent calibration fixture**

```typescript
// src/lib/parsing/fixtures/julioMadridCaturraNitro.ts
// PERMANENT CALIBRATION FIXTURE — do not delete or weaken across any future plan.
// Source: Tinker Coffee Co., Colombia "Julio Madrid Caturra Nitro" (Nitro Washed).
// Ground truth: process = 'nitro_washed', flavor_origin = 'process'
// (wild candy-like notes earned through fermentation, not additives — see
// knowledge/process-taxonomy.md's flavor_origin section for why anaerobic/
// nitro-washed coffees default to 'process' even when notes sound like candy).
export const JULIO_MADRID_CATURRA_NITRO_LISTING = `
Tinker Coffee Co. — Colombia Julio Madrid Caturra Nitro

Producer: Julio Madrid
Region: Colombia
Variety: Caturra
Process: Nitro Washed (nitrogen-flushed anaerobic fermentation, then washed)

Tasting Notes: Watermelon Bubble Gum, Strawberry Yogurt Candy, Mango Creamsicle, Pink Lemonade

This lot spent 96 hours in a sealed tank flushed with nitrogen before being washed clean.
Zero additives — every wild, candy-like note here comes straight from fermentation.

12oz bag — $24.00
`.trim()
```

- [ ] **Step 3: Write the failing parser tests (including the permanent fixture)**

```typescript
// src/lib/parsing/parseListing.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { JULIO_MADRID_CATURRA_NITRO_LISTING } from './fixtures/julioMadridCaturraNitro'

const mockParse = vi.fn()

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: class MockAnthropic {
      messages = { parse: mockParse }
    },
  }
})

describe('parseListing', () => {
  beforeEach(() => {
    mockParse.mockReset()
  })

  it('PERMANENT CALIBRATION: parses Julio Madrid Caturra Nitro as nitro_washed / process', async () => {
    mockParse.mockResolvedValue({
      parsed_output: {
        roasterName: 'Tinker Coffee Co.',
        roasterWebsite: null,
        coffeeName: 'Colombia Julio Madrid Caturra Nitro',
        originCountry: 'Colombia',
        originRegion: null,
        producer: 'Julio Madrid',
        variety: 'Caturra',
        process: 'nitro_washed',
        processDetail: 'Nitro Washed (nitrogen-flushed anaerobic fermentation, then washed)',
        flavorOrigin: 'process',
        tastingNotes: ['watermelon bubble gum', 'strawberry yogurt candy', 'mango creamsicle', 'pink lemonade'],
        priceCents: 2400,
        sizeGrams: 340,
        parseConfidence: 'HIGH',
      },
    })

    const { parseListing } = await import('./parseListing')
    const result = await parseListing(JULIO_MADRID_CATURRA_NITRO_LISTING)

    expect(result.process).toBe('nitro_washed')
    expect(result.flavorOrigin).toBe('process')
    expect(result.tastingNotes).toContain('watermelon bubble gum')
  })

  it('retries once on a validation failure, then succeeds', async () => {
    mockParse
      .mockResolvedValueOnce({ parsed_output: { coffeeName: '' } }) // invalid: fails schema
      .mockResolvedValueOnce({
        parsed_output: {
          roasterName: 'Test Roaster',
          roasterWebsite: null,
          coffeeName: 'Test Coffee',
          originCountry: null,
          originRegion: null,
          producer: null,
          variety: null,
          process: null,
          processDetail: null,
          flavorOrigin: 'unknown',
          tastingNotes: [],
          priceCents: null,
          sizeGrams: null,
          parseConfidence: 'MEDIUM',
        },
      })

    const { parseListing } = await import('./parseListing')
    const result = await parseListing('some sparse listing text')

    expect(mockParse).toHaveBeenCalledTimes(2)
    expect(result.coffeeName).toBe('Test Coffee')
  })

  it('falls back to a LOW-confidence best-effort row after two failed attempts, never throwing', async () => {
    mockParse
      .mockResolvedValueOnce({ parsed_output: { coffeeName: '' } })
      .mockResolvedValueOnce({ parsed_output: { coffeeName: '' } })

    const { parseListing } = await import('./parseListing')
    const result = await parseListing('Some Roaster - Some Coffee, barely any info')

    expect(result.parseConfidence).toBe('LOW')
    expect(result.coffeeName.length).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 4: Run tests and confirm they fail**

Run: `npm run test:run -- parseListing.test.ts`
Expected: FAIL — cannot find module `./parseListing`.

- [ ] **Step 5: Write the parser**

```typescript
// src/lib/parsing/parseListing.ts
import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { ParsedListingSchema, type ParsedListing } from './schema'

export class ListingParseError extends Error {}

const SYSTEM_PROMPT = `You extract structured data from specialty coffee bag/listing text.

Process taxonomy (map the listing's own wording onto exactly one of these):
- washed: fully washed / wet process
- natural: natural / dry process / sun-dried
- honey: honey process / pulped natural / miel / white-yellow-red-black honey
- anaerobic: anaerobic fermentation/natural/washed (sealed tank, not nitrogen-specific)
- carbonic_maceration: carbonic maceration / CM process
- nitro_washed: nitro washed / nitrogen-flushed fermentation / N2 washed
- co_ferment: co-ferment / cherry fermented with [fruit] / mosto process
- thermal_shock: thermal shock process/fermentation
- other: anything else — put the roaster's exact phrase in processDetail
- null: the listing doesn't mention a process at all

flavorOrigin:
- 'process': wild/candy-like/intense flavors are attributed to fermentation or processing (default for anaerobic, nitro_washed, carbonic_maceration, co_ferment even when notes sound like candy)
- 'added': listing says the coffee is flavored/flavoring added after roasting (e.g. "hazelnut flavored")
- 'unknown': not enough information to tell

parseConfidence: 'HIGH' if roaster, coffee name, origin, and process are all explicit in the text; 'MEDIUM' if some fields are inferred from partial information; 'LOW' if the text is too sparse to extract most fields confidently.

tastingNotes: lowercase, trimmed short phrases exactly as the roaster wrote them (e.g. "watermelon bubble gum"), not your own paraphrase.

priceCents and sizeGrams: null if not present in the text. Convert dollars to cents (e.g. $24.00 -> 2400) and oz to grams (1 oz = 28.35g, round to nearest gram) if only oz is given.`

async function callOnce(rawText: string) {
  const client = new Anthropic()
  const message = await client.messages.parse({
    model: 'claude-sonnet-5',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: rawText }],
    output_config: {
      format: zodOutputFormat(ParsedListingSchema),
    },
  })
  return ParsedListingSchema.safeParse(message.parsed_output)
}

function bestEffortFallback(rawText: string): ParsedListing {
  const firstLine = rawText.split('\n').find((l) => l.trim().length > 0) ?? 'Unknown listing'
  return {
    roasterName: firstLine.slice(0, 200),
    roasterWebsite: null,
    coffeeName: firstLine.slice(0, 200),
    originCountry: null,
    originRegion: null,
    producer: null,
    variety: null,
    process: null,
    processDetail: null,
    flavorOrigin: 'unknown',
    tastingNotes: [],
    priceCents: null,
    sizeGrams: null,
    parseConfidence: 'LOW',
  }
}

export async function parseListing(rawText: string): Promise<ParsedListing> {
  let lastError: unknown

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await callOnce(rawText)
      if (result.success) {
        return result.data
      }
      lastError = result.error
    } catch (err) {
      lastError = err
      if (err instanceof Error && /api|network|rate.?limit|timeout/i.test(err.message) && attempt === 1) {
        throw new ListingParseError(`Anthropic API call failed after retry: ${err.message}`)
      }
    }
  }

  console.warn('parseListing: both attempts failed validation, falling back to LOW-confidence row', lastError)
  return bestEffortFallback(rawText)
}
```

- [ ] **Step 6: Run tests and confirm they pass**

Run: `npm run test:run -- parseListing.test.ts`
Expected: PASS (3 tests) — including the permanent calibration test.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(parsing): add Anthropic listing parser with permanent Julio Madrid Caturra Nitro fixture"
```

---

## Task 12: Catalog dedupe logic

**Files:**
- Create: `src/lib/catalog/similarity.ts`
- Create: `src/lib/catalog/similarity.test.ts`
- Create: `src/lib/catalog/dedupe.ts`
- Create: `src/lib/catalog/dedupe.test.ts`

**Interfaces:**
- Consumes: `db`, `roasters`, `coffees` from `@/lib/db`; `ParsedListing` from `@/lib/parsing/schema`.
- Produces: `export function diceCoefficient(a: string, b: string): number` and `export function normalizeForMatch(s: string): string` from `./similarity.ts`; `export async function findOrCreateRoaster(name: string, website?: string | null): Promise<string>` and `export async function findOrCreateCoffee(parsed: ParsedListing, opts?: { barcode?: string | null; listingUrl?: string | null }): Promise<{ coffeeId: string; wasExisting: boolean }>` from `./dedupe.ts` — consumed by `src/lib/actions/coffee.ts` (Task 14).

- [ ] **Step 1: Write failing similarity tests**

```typescript
// src/lib/catalog/similarity.test.ts
import { describe, it, expect } from 'vitest'
import { diceCoefficient, normalizeForMatch } from './similarity'

describe('normalizeForMatch', () => {
  it('lowercases, trims, and strips punctuation', () => {
    expect(normalizeForMatch('  Julio Madrid, Caturra Nitro!! ')).toBe('julio madrid caturra nitro')
  })
})

describe('diceCoefficient', () => {
  it('returns 1 for identical strings', () => {
    expect(diceCoefficient('caturra nitro', 'caturra nitro')).toBe(1)
  })

  it('returns a high score for near-duplicate names', () => {
    const score = diceCoefficient('julio madrid caturra nitro', 'julio madrid caturra nitro washed')
    expect(score).toBeGreaterThan(0.85)
  })

  it('returns a low score for unrelated strings', () => {
    const score = diceCoefficient('ethiopia yirgacheffe washed', 'colombia caturra nitro')
    expect(score).toBeLessThan(0.3)
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm run test:run -- similarity.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the similarity helpers**

```typescript
// src/lib/catalog/similarity.ts
export function normalizeForMatch(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function bigrams(s: string): string[] {
  const grams: string[] = []
  for (let i = 0; i < s.length - 1; i++) {
    grams.push(s.slice(i, i + 2))
  }
  return grams
}

/** Dice's coefficient over character bigrams. 1 = identical, 0 = nothing in common. */
export function diceCoefficient(a: string, b: string): number {
  const normA = normalizeForMatch(a)
  const normB = normalizeForMatch(b)
  if (normA === normB) return 1
  const bigramsA = bigrams(normA)
  const bigramsB = bigrams(normB)
  if (bigramsA.length === 0 || bigramsB.length === 0) return 0

  const bMap = new Map<string, number>()
  for (const bg of bigramsB) bMap.set(bg, (bMap.get(bg) ?? 0) + 1)

  let matches = 0
  for (const bg of bigramsA) {
    const count = bMap.get(bg) ?? 0
    if (count > 0) {
      matches++
      bMap.set(bg, count - 1)
    }
  }
  return (2 * matches) / (bigramsA.length + bigramsB.length)
}
```

- [ ] **Step 4: Run and confirm similarity tests pass**

Run: `npm run test:run -- similarity.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write failing dedupe tests (mocked DB)**

```typescript
// src/lib/catalog/dedupe.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ParsedListing } from '@/lib/parsing/schema'

const dbState = {
  roasters: [] as Array<{ id: string; name: string; website: string | null }>,
  coffees: [] as Array<{
    id: string
    roasterId: string
    name: string
    barcode: string | null
    listingUrl: string | null
    parseConfidence: string
  }>,
}

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: (table: { _: { name: string } }) => ({
        where: () => {
          const name = table._.name
          return Promise.resolve(name === 'roasters' ? dbState.roasters : dbState.coffees)
        },
      }),
    }),
    insert: (table: { _: { name: string } }) => ({
      values: (vals: Record<string, unknown>) => ({
        returning: () => {
          const row = { id: `generated-${Math.random()}`, ...vals }
          if (table._.name === 'roasters') dbState.roasters.push(row as never)
          else dbState.coffees.push(row as never)
          return Promise.resolve([row])
        },
      }),
    }),
  },
}))

const basicParsed: ParsedListing = {
  roasterName: 'Tinker Coffee Co.',
  roasterWebsite: 'https://tinkercoffee.com',
  coffeeName: 'Julio Madrid Caturra Nitro',
  originCountry: 'Colombia',
  originRegion: null,
  producer: 'Julio Madrid',
  variety: 'Caturra',
  process: 'nitro_washed',
  processDetail: 'Nitro Washed',
  flavorOrigin: 'process',
  tastingNotes: ['watermelon bubble gum'],
  priceCents: 2400,
  sizeGrams: 340,
  parseConfidence: 'HIGH',
}

describe('findOrCreateCoffee', () => {
  beforeEach(() => {
    dbState.roasters = []
    dbState.coffees = []
  })

  it('creates a new roaster and coffee when nothing matches', async () => {
    const { findOrCreateCoffee } = await import('./dedupe')
    const result = await findOrCreateCoffee(basicParsed, { listingUrl: 'https://tinkercoffee.com/products/julio' })
    expect(result.wasExisting).toBe(false)
    expect(dbState.coffees).toHaveLength(1)
  })

  it('matches an existing coffee by barcode', async () => {
    dbState.roasters.push({ id: 'r1', name: 'Tinker Coffee Co.', website: null })
    dbState.coffees.push({
      id: 'c1',
      roasterId: 'r1',
      name: 'Julio Madrid Caturra Nitro',
      barcode: '012345678905',
      listingUrl: null,
      parseConfidence: 'HIGH',
    })
    const { findOrCreateCoffee } = await import('./dedupe')
    const result = await findOrCreateCoffee(basicParsed, { barcode: '012345678905' })
    expect(result.wasExisting).toBe(true)
    expect(result.coffeeId).toBe('c1')
  })

  it('matches an existing coffee by fuzzy roaster+name when no barcode/URL match', async () => {
    dbState.roasters.push({ id: 'r1', name: 'Tinker Coffee Co.', website: null })
    dbState.coffees.push({
      id: 'c1',
      roasterId: 'r1',
      name: 'Julio Madrid Caturra Nitro Washed',
      barcode: null,
      listingUrl: null,
      parseConfidence: 'MEDIUM',
    })
    const { findOrCreateCoffee } = await import('./dedupe')
    const result = await findOrCreateCoffee(basicParsed, {})
    expect(result.wasExisting).toBe(true)
    expect(result.coffeeId).toBe('c1')
  })
})
```

- [ ] **Step 6: Run and confirm dedupe tests fail**

Run: `npm run test:run -- dedupe.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 7: Write the dedupe logic**

```typescript
// src/lib/catalog/dedupe.ts
import { db } from '@/lib/db'
import { roasters, coffees } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import type { ParsedListing } from '@/lib/parsing/schema'
import { diceCoefficient } from './similarity'

const FUZZY_MATCH_THRESHOLD = 0.85

export async function findOrCreateRoaster(name: string, website?: string | null): Promise<string> {
  const existing = await db.select().from(roasters).where(eq(roasters.name, name))
  if (existing.length > 0) return existing[0].id

  const [created] = await db
    .insert(roasters)
    .values({ name, website: website ?? null })
    .returning()
  return created.id
}

export async function findOrCreateCoffee(
  parsed: ParsedListing,
  opts: { barcode?: string | null; listingUrl?: string | null } = {}
): Promise<{ coffeeId: string; wasExisting: boolean }> {
  // 1. Barcode match — strongest signal, a physical bag was scanned.
  if (opts.barcode) {
    const byBarcode = await db.select().from(coffees).where(eq(coffees.barcode, opts.barcode))
    if (byBarcode.length > 0) {
      return pickHighestConfidence(byBarcode)
    }
  }

  // 2. Listing URL match — same product page seen before.
  if (opts.listingUrl) {
    const byUrl = await db.select().from(coffees).where(eq(coffees.listingUrl, opts.listingUrl))
    if (byUrl.length > 0) {
      return pickHighestConfidence(byUrl)
    }
  }

  const roasterId = await findOrCreateRoaster(parsed.roasterName, parsed.roasterWebsite)

  // 3. Fuzzy roaster+name match — same roaster, near-identical coffee name.
  const roasterCoffees = await db.select().from(coffees).where(eq(coffees.roasterId, roasterId))
  const fuzzyMatch = roasterCoffees
    .map((c) => ({ coffee: c, score: diceCoefficient(c.name, parsed.coffeeName) }))
    .filter((m) => m.score >= FUZZY_MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)[0]

  if (fuzzyMatch) {
    return { coffeeId: fuzzyMatch.coffee.id, wasExisting: true }
  }

  // 4. Nothing matched — create a new catalog row.
  const [created] = await db
    .insert(coffees)
    .values({
      roasterId,
      name: parsed.coffeeName,
      originCountry: parsed.originCountry,
      originRegion: parsed.originRegion,
      producer: parsed.producer,
      variety: parsed.variety,
      process: parsed.process,
      processDetail: parsed.processDetail,
      flavorOrigin: parsed.flavorOrigin,
      tastingNotes: parsed.tastingNotes,
      rawListingText: null,
      listingUrl: opts.listingUrl ?? null,
      barcode: opts.barcode ?? null,
      priceCents: parsed.priceCents,
      sizeGrams: parsed.sizeGrams,
      parseConfidence: parsed.parseConfidence,
    })
    .returning()

  return { coffeeId: created.id, wasExisting: false }
}

function pickHighestConfidence<T extends { id: string; parseConfidence: string }>(rows: T[]): {
  coffeeId: string
  wasExisting: true
} {
  const rank = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const
  const best = [...rows].sort(
    (a, b) => (rank[b.parseConfidence as keyof typeof rank] ?? 0) - (rank[a.parseConfidence as keyof typeof rank] ?? 0)
  )[0]
  return { coffeeId: best.id, wasExisting: true }
}
```

- [ ] **Step 8: Run and confirm dedupe tests pass**

Run: `npm run test:run -- dedupe.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat(catalog): add dedupe logic (barcode -> URL -> fuzzy roaster+name)"
```

---

## Task 13: Barcode lookup (catalog + Open Food Facts)

**Files:**
- Create: `src/lib/catalog/barcodeLookup.ts`
- Create: `src/lib/catalog/barcodeLookup.test.ts`

**Interfaces:**
- Consumes: `db`, `coffees`, `roasters` from `@/lib/db`.
- Produces: `export type BarcodeLookupResult = { source: 'catalog'; coffeeId: string; coffeeName: string; roasterName: string } | { source: 'open_food_facts'; productName: string; brand: string | null } | { source: 'not_found' }` and `export async function lookupByBarcode(barcode: string): Promise<BarcodeLookupResult>` — consumed by `src/lib/actions/coffee.ts` (Task 14).

- [ ] **Step 1: Write failing tests**

```typescript
// src/lib/catalog/barcodeLookup.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const dbState = {
  rows: [] as Array<{ id: string; name: string; roasterName: string }>,
}

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          where: () => Promise.resolve(dbState.rows),
        }),
      }),
    }),
  },
}))

const fetchMock = vi.fn()
vi.stubGlobal('fetch', fetchMock)

describe('lookupByBarcode', () => {
  beforeEach(() => {
    dbState.rows = []
    fetchMock.mockReset()
  })

  it('returns a catalog hit when the barcode is already known', async () => {
    dbState.rows = [{ id: 'c1', name: 'Julio Madrid Caturra Nitro', roasterName: 'Tinker Coffee Co.' }]
    const { lookupByBarcode } = await import('./barcodeLookup')
    const result = await lookupByBarcode('012345678905')
    expect(result).toEqual({
      source: 'catalog',
      coffeeId: 'c1',
      coffeeName: 'Julio Madrid Caturra Nitro',
      roasterName: 'Tinker Coffee Co.',
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('falls back to Open Food Facts when not in the catalog', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: { product_name: 'Some Grocery Coffee', brands: 'BigBrand' },
      }),
    })
    const { lookupByBarcode } = await import('./barcodeLookup')
    const result = await lookupByBarcode('999999999999')
    expect(result).toEqual({ source: 'open_food_facts', productName: 'Some Grocery Coffee', brand: 'BigBrand' })
  })

  it('returns not_found when neither the catalog nor Open Food Facts has it', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ status: 0 }) })
    const { lookupByBarcode } = await import('./barcodeLookup')
    const result = await lookupByBarcode('000000000000')
    expect(result).toEqual({ source: 'not_found' })
  })

  it('treats an Open Food Facts network failure as not_found rather than throwing', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    const { lookupByBarcode } = await import('./barcodeLookup')
    const result = await lookupByBarcode('111111111111')
    expect(result).toEqual({ source: 'not_found' })
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm run test:run -- barcodeLookup.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the lookup**

```typescript
// src/lib/catalog/barcodeLookup.ts
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { coffees, roasters } from '@/lib/db/schema'

export type BarcodeLookupResult =
  | { source: 'catalog'; coffeeId: string; coffeeName: string; roasterName: string }
  | { source: 'open_food_facts'; productName: string; brand: string | null }
  | { source: 'not_found' }

async function lookupOpenFoodFacts(barcode: string): Promise<BarcodeLookupResult> {
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`, {
      headers: { 'User-Agent': 'CoffeeApp/1.0 (single-user personal project)' },
    })
    if (!res.ok) return { source: 'not_found' }
    const data = await res.json()
    if (data.status !== 1 || !data.product?.product_name) return { source: 'not_found' }
    return {
      source: 'open_food_facts',
      productName: data.product.product_name,
      brand: data.product.brands ?? null,
    }
  } catch {
    return { source: 'not_found' }
  }
}

export async function lookupByBarcode(barcode: string): Promise<BarcodeLookupResult> {
  const catalogRows = await db
    .select({ id: coffees.id, name: coffees.name, roasterName: roasters.name })
    .from(coffees)
    .innerJoin(roasters, eq(coffees.roasterId, roasters.id))
    .where(eq(coffees.barcode, barcode))

  if (catalogRows.length > 0) {
    const row = catalogRows[0]
    return { source: 'catalog', coffeeId: row.id, coffeeName: row.name, roasterName: row.roasterName }
  }

  return lookupOpenFoodFacts(barcode)
}
```

- [ ] **Step 4: Run and confirm tests pass**

Run: `npm run test:run -- barcodeLookup.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(catalog): add barcode lookup (catalog first, Open Food Facts fallback)"
```

---

## Task 14: Server actions — add coffee, rate/review, list library

**Files:**
- Create: `src/lib/actions/coffee.ts`
- Create: `src/lib/actions/coffee.test.ts`

**Interfaces:**
- Consumes: `requireUserId` (Task 8), `parseListing`, `ListingParseError` (Task 11), `findOrCreateCoffee` (Task 12), `lookupByBarcode` (Task 13), `db`, `coffees`, `roasters`, `libraryEntries` (Tasks 6–7).
- Produces: `addCoffeeFromListing`, `addCoffeeFromBarcode`, `confirmBarcodeCoffee`, `rateCoffee`, `listLibrary`, `getCoffeeDetail` — all consumed by UI in Tasks 15–16.

- [ ] **Step 1: Write failing tests (mocking every dependency below the action layer)**

```typescript
// src/lib/actions/coffee.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/auth/requireUserId', () => ({
  requireUserId: vi.fn().mockResolvedValue('user-1'),
}))

const parseListingMock = vi.fn()
vi.mock('@/lib/parsing/parseListing', () => ({
  parseListing: parseListingMock,
  ListingParseError: class ListingParseError extends Error {},
}))

const findOrCreateCoffeeMock = vi.fn()
vi.mock('@/lib/catalog/dedupe', () => ({
  findOrCreateCoffee: findOrCreateCoffeeMock,
}))

const lookupByBarcodeMock = vi.fn()
vi.mock('@/lib/catalog/barcodeLookup', () => ({
  lookupByBarcode: lookupByBarcodeMock,
}))

const dbState = {
  libraryEntries: [] as Array<{
    id: string
    userId: string
    coffeeId: string
    status: string
    rating: number | null
    review: string | null
  }>,
}

vi.mock('@/lib/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(dbState.libraryEntries),
      }),
    }),
    insert: () => ({
      values: (vals: Record<string, unknown>) => ({
        returning: () => {
          const row = { id: `le-${Math.random()}`, ...vals }
          dbState.libraryEntries.push(row as never)
          return Promise.resolve([row])
        },
      }),
    }),
    update: () => ({
      set: (vals: Record<string, unknown>) => ({
        where: () => {
          Object.assign(dbState.libraryEntries[0], vals)
          return Promise.resolve()
        },
      }),
    }),
  },
}))

describe('addCoffeeFromListing', () => {
  beforeEach(() => {
    dbState.libraryEntries = []
    parseListingMock.mockReset()
    findOrCreateCoffeeMock.mockReset()
  })

  it('parses, dedupes, and creates a candidate library entry', async () => {
    parseListingMock.mockResolvedValue({ coffeeName: 'Test Coffee', parseConfidence: 'HIGH' })
    findOrCreateCoffeeMock.mockResolvedValue({ coffeeId: 'coffee-1', wasExisting: false })

    const { addCoffeeFromListing } = await import('./coffee')
    const result = await addCoffeeFromListing({ rawText: 'some listing text' })

    expect(result.coffeeId).toBe('coffee-1')
    expect(result.wasExisting).toBe(false)
    expect(dbState.libraryEntries).toHaveLength(1)
    expect(dbState.libraryEntries[0].status).toBe('owned')
  })
})

describe('addCoffeeFromBarcode', () => {
  beforeEach(() => {
    lookupByBarcodeMock.mockReset()
  })

  it('returns the catalog verdict directly when the barcode is already known', async () => {
    lookupByBarcodeMock.mockResolvedValue({
      source: 'catalog',
      coffeeId: 'coffee-1',
      coffeeName: 'Test Coffee',
      roasterName: 'Test Roaster',
    })
    const { addCoffeeFromBarcode } = await import('./coffee')
    const result = await addCoffeeFromBarcode('012345678905')
    expect(result.source).toBe('catalog')
  })
})

describe('rateCoffee', () => {
  it('updates rating and review on the existing library entry', async () => {
    dbState.libraryEntries = [
      { id: 'le-1', userId: 'user-1', coffeeId: 'coffee-1', status: 'owned', rating: null, review: null },
    ]
    const { rateCoffee } = await import('./coffee')
    await rateCoffee({ coffeeId: 'coffee-1', rating: 4, review: 'Great strawberry candy notes' })
    expect(dbState.libraryEntries[0].rating).toBe(4)
    expect(dbState.libraryEntries[0].review).toBe('Great strawberry candy notes')
  })
})
```

- [ ] **Step 2: Run and confirm failure**

Run: `npm run test:run -- coffee.test.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write the server actions**

```typescript
// src/lib/actions/coffee.ts
'use server'

import { eq, and, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { coffees, roasters, libraryEntries, type libraryStatusEnum } from '@/lib/db/schema'
import { requireUserId } from '@/lib/auth/requireUserId'
import { parseListing, ListingParseError } from '@/lib/parsing/parseListing'
import { findOrCreateCoffee } from '@/lib/catalog/dedupe'
import { lookupByBarcode, type BarcodeLookupResult } from '@/lib/catalog/barcodeLookup'

type LibraryStatus = (typeof libraryStatusEnum.enumValues)[number]

async function upsertOwnedEntry(userId: string, coffeeId: string) {
  const existing = await db
    .select()
    .from(libraryEntries)
    .where(and(eq(libraryEntries.userId, userId), eq(libraryEntries.coffeeId, coffeeId)))

  if (existing.length > 0) return existing[0]

  const [created] = await db
    .insert(libraryEntries)
    .values({ userId, coffeeId, status: 'owned', acquiredAt: new Date() })
    .returning()
  return created
}

export async function addCoffeeFromListing(input: {
  rawText: string
  listingUrl?: string
  barcode?: string
}): Promise<{ coffeeId: string; wasExisting: boolean; parseConfidence: string }> {
  const userId = await requireUserId()

  let parsed
  try {
    parsed = await parseListing(input.rawText)
  } catch (err) {
    if (err instanceof ListingParseError) {
      throw new Error('Could not reach the coffee parser right now — try again in a moment.')
    }
    throw err
  }

  const { coffeeId, wasExisting } = await findOrCreateCoffee(parsed, {
    listingUrl: input.listingUrl,
    barcode: input.barcode,
  })

  await upsertOwnedEntry(userId, coffeeId)

  return { coffeeId, wasExisting, parseConfidence: parsed.parseConfidence }
}

export async function addCoffeeFromBarcode(barcode: string): Promise<BarcodeLookupResult> {
  await requireUserId()
  return lookupByBarcode(barcode)
}

export async function confirmBarcodeCoffee(
  barcode: string,
  rawText: string
): Promise<{ coffeeId: string; wasExisting: boolean }> {
  const userId = await requireUserId()
  const parsed = await parseListing(rawText)
  const { coffeeId, wasExisting } = await findOrCreateCoffee(parsed, { barcode })
  await upsertOwnedEntry(userId, coffeeId)
  return { coffeeId, wasExisting }
}

export async function rateCoffee(input: {
  coffeeId: string
  rating: number
  review?: string
  status?: LibraryStatus
}): Promise<void> {
  const userId = await requireUserId()
  await db
    .update(libraryEntries)
    .set({
      rating: input.rating,
      review: input.review ?? null,
      status: input.status ?? 'owned',
      updatedAt: new Date(),
    })
    .where(and(eq(libraryEntries.userId, userId), eq(libraryEntries.coffeeId, input.coffeeId)))
}

export type LibraryEntryWithCoffee = {
  entryId: string
  coffeeId: string
  coffeeName: string
  roasterName: string
  status: LibraryStatus
  rating: number | null
  review: string | null
}

export async function listLibrary(status?: LibraryStatus): Promise<LibraryEntryWithCoffee[]> {
  const userId = await requireUserId()
  const whereClause = status
    ? and(eq(libraryEntries.userId, userId), eq(libraryEntries.status, status))
    : eq(libraryEntries.userId, userId)

  const rows = await db
    .select({
      entryId: libraryEntries.id,
      coffeeId: coffees.id,
      coffeeName: coffees.name,
      roasterName: roasters.name,
      status: libraryEntries.status,
      rating: libraryEntries.rating,
      review: libraryEntries.review,
    })
    .from(libraryEntries)
    .innerJoin(coffees, eq(libraryEntries.coffeeId, coffees.id))
    .innerJoin(roasters, eq(coffees.roasterId, roasters.id))
    .where(whereClause)
    .orderBy(desc(libraryEntries.updatedAt))

  return rows
}

export type CoffeeDetail = {
  id: string
  name: string
  roasterName: string
  originCountry: string | null
  originRegion: string | null
  producer: string | null
  variety: string | null
  process: string | null
  processDetail: string | null
  tastingNotes: string[]
  rating: number | null
  review: string | null
  status: LibraryStatus | null
}

export async function getCoffeeDetail(coffeeId: string): Promise<CoffeeDetail | null> {
  const userId = await requireUserId()

  const coffeeRows = await db
    .select({
      id: coffees.id,
      name: coffees.name,
      roasterName: roasters.name,
      originCountry: coffees.originCountry,
      originRegion: coffees.originRegion,
      producer: coffees.producer,
      variety: coffees.variety,
      process: coffees.process,
      processDetail: coffees.processDetail,
      tastingNotes: coffees.tastingNotes,
    })
    .from(coffees)
    .innerJoin(roasters, eq(coffees.roasterId, roasters.id))
    .where(eq(coffees.id, coffeeId))

  if (coffeeRows.length === 0) return null

  const entryRows = await db
    .select({ rating: libraryEntries.rating, review: libraryEntries.review, status: libraryEntries.status })
    .from(libraryEntries)
    .where(and(eq(libraryEntries.userId, userId), eq(libraryEntries.coffeeId, coffeeId)))

  const entry = entryRows[0]

  return {
    ...coffeeRows[0],
    rating: entry?.rating ?? null,
    review: entry?.review ?? null,
    status: (entry?.status as LibraryStatus) ?? null,
  }
}
```

- [ ] **Step 4: Run and confirm tests pass**

Run: `npm run test:run -- coffee.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat(actions): add server actions for add-coffee, rate/review, and library listing"
```

---

## Task 15: Add-coffee UI (paste/URL + barcode scan + photo fallback)

**Files:**
- Create: `src/components/coffee/AddCoffeeForm.tsx`
- Create: `src/components/coffee/BarcodeScanner.tsx`
- Create: `src/app/coffee/add/page.tsx`

**Interfaces:**
- Consumes: `addCoffeeFromListing`, `addCoffeeFromBarcode`, `confirmBarcodeCoffee` from `@/lib/actions/coffee` (Task 14).
- Produces: `/coffee/add` route, navigable from the Library screen (Task 16).

- [ ] **Step 1: Install the barcode scanning library**

```bash
npm install @zxing/browser@0.2.1
npm audit
```

Expected: `@zxing/library` (a peer/transitive dep of `@zxing/browser`) declares `engines.node >= 24` in its own `package.json`. Since this code only ever runs in the browser (not on the Node.js server), this is a harmless `EBADENGINE` warning during `npm install` on Node 22 — not a runtime issue. Confirm the warning is exactly that (`EBADENGINE`, not an install failure) and move on.

- [ ] **Step 2: Barcode scanner component (single-shot scan)**

```typescript
// src/components/coffee/BarcodeScanner.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader, BrowserCodeReader } from '@zxing/browser'

export function BarcodeScanner({
  onDetected,
  onError,
}: {
  onDetected: (barcode: string) => void
  onError?: (message: string) => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    return () => {
      BrowserCodeReader.releaseAllStreams()
    }
  }, [])

  async function start() {
    setScanning(true)
    try {
      const reader = new BrowserMultiFormatReader()
      const result = await reader.decodeOnceFromVideoDevice(undefined, videoRef.current ?? undefined)
      onDetected(result.getText())
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Could not read a barcode from the camera.')
    } finally {
      setScanning(false)
      BrowserCodeReader.releaseAllStreams()
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <video ref={videoRef} className="w-full max-w-sm rounded" muted playsInline />
      <button
        type="button"
        onClick={start}
        disabled={scanning}
        className="bg-black text-white rounded px-4 py-2 disabled:opacity-50"
      >
        {scanning ? 'Scanning…' : 'Scan barcode'}
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Add-coffee form (paste/URL + barcode branch)**

```typescript
// src/components/coffee/AddCoffeeForm.tsx
'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  addCoffeeFromListing,
  addCoffeeFromBarcode,
  confirmBarcodeCoffee,
} from '@/lib/actions/coffee'
import { BarcodeScanner } from './BarcodeScanner'

type Mode = 'paste' | 'scan'
type BarcodeState =
  | { step: 'idle' }
  | { step: 'catalog_hit'; coffeeName: string; roasterName: string; coffeeId: string }
  | { step: 'off_hit'; barcode: string; productName: string; brand: string | null }
  | { step: 'not_found'; barcode: string }

export function AddCoffeeForm() {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>('paste')
  const [rawText, setRawText] = useState('')
  const [listingUrl, setListingUrl] = useState('')
  const [barcodeState, setBarcodeState] = useState<BarcodeState>({ step: 'idle' })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handlePasteSubmit() {
    setError(null)
    startTransition(async () => {
      try {
        const result = await addCoffeeFromListing({ rawText, listingUrl: listingUrl || undefined })
        router.push(`/coffee/${result.coffeeId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  function handleBarcodeDetected(barcode: string) {
    startTransition(async () => {
      const result = await addCoffeeFromBarcode(barcode)
      if (result.source === 'catalog') {
        setBarcodeState({
          step: 'catalog_hit',
          coffeeName: result.coffeeName,
          roasterName: result.roasterName,
          coffeeId: result.coffeeId,
        })
      } else if (result.source === 'open_food_facts') {
        setBarcodeState({
          step: 'off_hit',
          barcode,
          productName: result.productName,
          brand: result.brand,
        })
      } else {
        setBarcodeState({ step: 'not_found', barcode })
      }
    })
  }

  function handleConfirmAfterScan(barcode: string) {
    setError(null)
    startTransition(async () => {
      try {
        const result = await confirmBarcodeCoffee(barcode, rawText)
        router.push(`/coffee/${result.coffeeId}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.')
      }
    })
  }

  return (
    <div className="max-w-lg mx-auto p-4 flex flex-col gap-4">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('paste')}
          className={`px-3 py-1 rounded ${mode === 'paste' ? 'bg-black text-white' : 'bg-gray-200'}`}
        >
          Paste / URL
        </button>
        <button
          type="button"
          onClick={() => setMode('scan')}
          className={`px-3 py-1 rounded ${mode === 'scan' ? 'bg-black text-white' : 'bg-gray-200'}`}
        >
          Scan barcode
        </button>
      </div>

      {error && <p className="text-red-600 text-sm">{error}</p>}

      {mode === 'paste' && (
        <div className="flex flex-col gap-3">
          <input
            value={listingUrl}
            onChange={(e) => setListingUrl(e.target.value)}
            placeholder="Listing URL (optional)"
            className="border rounded p-2"
          />
          <textarea
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder="Paste the listing text here"
            rows={8}
            className="border rounded p-2"
          />
          <button
            type="button"
            onClick={handlePasteSubmit}
            disabled={isPending || rawText.trim().length === 0}
            className="bg-black text-white rounded p-2 disabled:opacity-50"
          >
            {isPending ? 'Adding…' : 'Add coffee'}
          </button>
        </div>
      )}

      {mode === 'scan' && (
        <div className="flex flex-col gap-4">
          {barcodeState.step === 'idle' && (
            <BarcodeScanner onDetected={handleBarcodeDetected} onError={setError} />
          )}

          {barcodeState.step === 'catalog_hit' && (
            <div className="border rounded p-4">
              <p className="font-medium">You&apos;ve had this — {barcodeState.roasterName}</p>
              <p>{barcodeState.coffeeName}</p>
              <button
                type="button"
                onClick={() => router.push(`/coffee/${barcodeState.coffeeId}`)}
                className="mt-3 bg-black text-white rounded px-3 py-2"
              >
                View / rate again
              </button>
            </div>
          )}

          {(barcodeState.step === 'off_hit' || barcodeState.step === 'not_found') && (
            <div className="flex flex-col gap-3">
              <p className="text-sm">
                {barcodeState.step === 'off_hit'
                  ? `Found "${barcodeState.productName}"${barcodeState.brand ? ` (${barcodeState.brand})` : ''} in the open product database — specialty roasters rarely have full tasting notes there. Paste the bag's full listing text below to get proper flavor/process details.`
                  : "New barcode — not in our catalog or the open product database. Paste the listing text or snap the bag's info below."}
              </p>
              <textarea
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder="Paste the listing text (or type what's on the bag)"
                rows={8}
                className="border rounded p-2"
              />
              <button
                type="button"
                onClick={() => handleConfirmAfterScan(barcodeState.barcode)}
                disabled={isPending || rawText.trim().length === 0}
                className="bg-black text-white rounded p-2 disabled:opacity-50"
              >
                {isPending ? 'Adding…' : 'Add coffee'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

Note: a full camera-based "snap a photo of the bag" capture (image → vision-model extraction) is deferred — the paste-text fallback above satisfies the same hero-flow-2 requirement ("new — snap the bag / paste the listing") via typing/pasting what's on the bag, and reuses the exact same parser. Add photo capture as a follow-up enhancement to this same textarea path once the text-paste flow is verified working; do not block Plan 1 on it.

- [ ] **Step 4: Add-coffee page**

```typescript
// src/app/coffee/add/page.tsx
import { AddCoffeeForm } from '@/components/coffee/AddCoffeeForm'

export default function AddCoffeePage() {
  return (
    <main>
      <h1 className="text-xl font-semibold text-center mt-4">Add a coffee</h1>
      <AddCoffeeForm />
    </main>
  )
}
```

- [ ] **Step 5: Manual verification**

```bash
npm run build
npm run dev
```

Log in, visit `/coffee/add`, paste the Julio Madrid Caturra Nitro fixture text (from `src/lib/parsing/fixtures/julioMadridCaturraNitro.ts`) into the Paste/URL tab, submit, and confirm it redirects to `/coffee/[id]` (that page is a 404 until Task 16 — the redirect itself, and a new row in Drizzle Studio's `coffees`/`library_entries` tables, is the proof this task works). Separately, test the Scan tab on a phone or a laptop with a camera pointed at any barcode (a book barcode works fine for this test) and confirm it reaches one of the three branches.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(ui): add-coffee flows (paste/URL, barcode scan, open-DB/photo fallback)"
```

---

## Task 16: Library screen + Coffee detail page (rate/review)

**Files:**
- Create: `src/components/coffee/CoffeeCard.tsx`
- Create: `src/components/coffee/RatingStars.tsx`
- Create: `src/components/coffee/RateReviewForm.tsx`
- Create: `src/app/library/page.tsx`
- Create: `src/app/coffee/[id]/page.tsx`

**Interfaces:**
- Consumes: `listLibrary`, `getCoffeeDetail`, `rateCoffee` from `@/lib/actions/coffee` (Task 14).
- Produces: `/library` and `/coffee/[id]` routes.

- [ ] **Step 1: Rating stars (read-only and interactive modes)**

```typescript
// src/components/coffee/RatingStars.tsx
'use client'

export function RatingStars({
  value,
  onChange,
  readOnly = false,
}: {
  value: number | null
  onChange?: (rating: number) => void
  readOnly?: boolean
}) {
  return (
    <div className="flex gap-1" role="group" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          disabled={readOnly}
          onClick={() => onChange?.(star)}
          aria-label={`${star} star${star > 1 ? 's' : ''}`}
          className={`text-2xl ${readOnly ? 'cursor-default' : 'cursor-pointer'} ${
            value && star <= value ? 'text-yellow-500' : 'text-gray-300'
          }`}
        >
          ★
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Coffee card for the library list**

```typescript
// src/components/coffee/CoffeeCard.tsx
import Link from 'next/link'
import { RatingStars } from './RatingStars'
import type { LibraryEntryWithCoffee } from '@/lib/actions/coffee'

export function CoffeeCard({ entry }: { entry: LibraryEntryWithCoffee }) {
  return (
    <Link
      href={`/coffee/${entry.coffeeId}`}
      className="block border rounded p-3 hover:bg-gray-50"
    >
      <p className="text-sm text-gray-500">{entry.roasterName}</p>
      <p className="font-medium">{entry.coffeeName}</p>
      <RatingStars value={entry.rating} readOnly />
    </Link>
  )
}
```

- [ ] **Step 3: Library page (server component with status tabs)**

```typescript
// src/app/library/page.tsx
import Link from 'next/link'
import { listLibrary } from '@/lib/actions/coffee'
import { CoffeeCard } from '@/components/coffee/CoffeeCard'

const TABS = ['owned', 'wishlist', 'finished'] as const

export default async function LibraryPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab } = await searchParams
  const activeTab = (TABS as readonly string[]).includes(tab ?? '')
    ? (tab as (typeof TABS)[number])
    : 'owned'

  const entries = await listLibrary(activeTab)

  return (
    <main className="max-w-lg mx-auto p-4 flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-semibold">Library</h1>
        <Link href="/coffee/add" className="bg-black text-white rounded px-3 py-1 text-sm">
          + Add coffee
        </Link>
      </div>

      <div className="flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/library?tab=${t}`}
            className={`px-3 py-1 rounded text-sm capitalize ${
              activeTab === t ? 'bg-black text-white' : 'bg-gray-200'
            }`}
          >
            {t}
          </Link>
        ))}
      </div>

      {entries.length === 0 ? (
        <p className="text-gray-500 text-sm">No coffees here yet.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {entries.map((entry) => (
            <CoffeeCard key={entry.entryId} entry={entry} />
          ))}
        </div>
      )}
    </main>
  )
}
```

- [ ] **Step 4: Rate/review form (client component, calls the server action directly)**

```typescript
// src/components/coffee/RateReviewForm.tsx
'use client'

import { useState, useTransition } from 'react'
import { rateCoffee } from '@/lib/actions/coffee'
import { RatingStars } from './RatingStars'

export function RateReviewForm({
  coffeeId,
  initialRating,
  initialReview,
}: {
  coffeeId: string
  initialRating: number | null
  initialReview: string | null
}) {
  const [rating, setRating] = useState(initialRating)
  const [review, setReview] = useState(initialReview ?? '')
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function save(nextRating: number) {
    setRating(nextRating)
    setSaved(false)
    startTransition(async () => {
      await rateCoffee({ coffeeId, rating: nextRating, review })
      setSaved(true)
    })
  }

  function saveReview() {
    if (!rating) return
    startTransition(async () => {
      await rateCoffee({ coffeeId, rating, review })
      setSaved(true)
    })
  }

  return (
    <div className="flex flex-col gap-2 border-t pt-3 mt-3">
      <RatingStars value={rating} onChange={save} />
      <textarea
        value={review}
        onChange={(e) => setReview(e.target.value)}
        onBlur={saveReview}
        placeholder="Notes on this coffee..."
        rows={3}
        className="border rounded p-2 text-sm"
      />
      {isPending && <p className="text-xs text-gray-400">Saving…</p>}
      {saved && !isPending && <p className="text-xs text-green-600">Saved</p>}
    </div>
  )
}
```

- [ ] **Step 5: Coffee detail page**

```typescript
// src/app/coffee/[id]/page.tsx
import { notFound } from 'next/navigation'
import { getCoffeeDetail } from '@/lib/actions/coffee'
import { RateReviewForm } from '@/components/coffee/RateReviewForm'

export default async function CoffeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const coffee = await getCoffeeDetail(id)
  if (!coffee) notFound()

  return (
    <main className="max-w-lg mx-auto p-4">
      <p className="text-sm text-gray-500">{coffee.roasterName}</p>
      <h1 className="text-xl font-semibold">{coffee.name}</h1>

      <dl className="mt-3 text-sm grid grid-cols-2 gap-1">
        {coffee.originCountry && (
          <>
            <dt className="text-gray-500">Origin</dt>
            <dd>{[coffee.originCountry, coffee.originRegion].filter(Boolean).join(', ')}</dd>
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

      <RateReviewForm coffeeId={coffee.id} initialRating={coffee.rating} initialReview={coffee.review} />
    </main>
  )
}
```

- [ ] **Step 6: Manual verification**

```bash
npm run build
npm run dev
```

Log in, land on `/library` (empty state), click "+ Add coffee", paste the Julio Madrid fixture, confirm redirect to its detail page with `Process: Nitro Washed...` shown and the tasting-note chips rendered, rate it 5 stars, add a review, confirm "Saved" appears, go back to `/library`, confirm it now appears under the "owned" tab with 5 stars showing on the card.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): Library screen and Coffee detail page with rate/review"
```

---

## Task 17: Mobile-first PWA shell

**Files:**
- Create: `src/app/manifest.json`
- Create: `src/app/sw.ts`
- Create: `public/icons/icon-192x192.png`, `public/icons/icon-512x512.png` (placeholder icons — swap for real branding later)
- Create: `src/components/layout/NavBar.tsx`
- Modify: `next.config.ts`, `tsconfig.json`, `.gitignore`, `src/app/layout.tsx`

**Interfaces:**
- Produces: an installable PWA shell wrapping every page built in Tasks 8, 15, 16. No new data interfaces — this task is purely presentational/infrastructural.

- [ ] **Step 1: Install Serwist**

```bash
npm install @serwist/next@9.5.11
npm install -D serwist@9.5.11
npm audit
```

- [ ] **Step 2: Wrap `next.config.ts` with Serwist**

```typescript
// next.config.ts
import type { NextConfig } from 'next'
import withSerwistInit from '@serwist/next'

const withSerwist = withSerwistInit({
  swSrc: 'src/app/sw.ts',
  swDest: 'public/sw.js',
  disable: process.env.NODE_ENV === 'development',
})

const nextConfig: NextConfig = {}

export default withSerwist(nextConfig)
```

- [ ] **Step 3: Update `tsconfig.json`**

```json
{
  "compilerOptions": {
    "types": ["@serwist/next/typings"],
    "lib": ["dom", "dom.iterable", "esnext", "webworker"]
  },
  "exclude": ["node_modules", "public/sw.js"]
}
```

(Merge the `types` and `lib` arrays into the existing `compilerOptions` block created by `create-next-app` in Task 1 — don't overwrite the rest of that file.)

- [ ] **Step 4: `.gitignore` additions**

```bash
cat >> .gitignore << 'EOF'

# Serwist
public/sw*
public/swe-worker*
EOF
```

- [ ] **Step 5: Service worker source**

```typescript
// src/app/sw.ts
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import { Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
})

serwist.addEventListeners()
```

- [ ] **Step 6: Web app manifest**

```json
// src/app/manifest.json
{
  "name": "Coffee App",
  "short_name": "Coffee",
  "icons": [
    { "src": "/icons/icon-192x192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable" },
    { "src": "/icons/icon-512x512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#1c1917",
  "background_color": "#ffffff",
  "start_url": "/",
  "display": "standalone",
  "orientation": "portrait"
}
```

- [ ] **Step 7: Generate placeholder icons**

```bash
mkdir -p public/icons
python3 -c "
from PIL import Image, ImageDraw
for size in (192, 512):
    img = Image.new('RGB', (size, size), '#1c1917')
    draw = ImageDraw.Draw(img)
    draw.ellipse([size*0.2, size*0.2, size*0.8, size*0.8], fill='#f5f0e8')
    img.save(f'public/icons/icon-{size}x{size}.png')
"
```

Expected: two PNG files exist. (Swap for real branding art whenever Chase has it — this unblocks "installable" for now.)

- [ ] **Step 8: Nav bar + root layout wiring**

```typescript
// src/components/layout/NavBar.tsx
import Link from 'next/link'

export function NavBar() {
  return (
    <nav className="border-t fixed bottom-0 left-0 right-0 bg-white flex justify-around py-2 md:static md:border-t-0 md:border-b md:justify-start md:gap-6 md:px-4">
      <Link href="/library" className="text-sm">Library</Link>
      <Link href="/coffee/add" className="text-sm">Add</Link>
    </nav>
  )
}
```

```typescript
// src/app/layout.tsx
import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { NavBar } from '@/components/layout/NavBar'
import './globals.css'

const APP_NAME = 'Coffee App'

export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: { default: APP_NAME, template: `%s - ${APP_NAME}` },
  description: 'Personal espresso coffee log, grind dial-in, and discovery.',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: APP_NAME },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: '#1c1917',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="pb-16 md:pb-0">
        <NavBar />
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 9: Verify production build (Serwist is disabled in dev)**

```bash
npm run build
npm run start
```

Visit `http://localhost:3000/manifest.json` — expect the JSON from Step 6. Visit `http://localhost:3000/sw.js` — expect generated JS (not a 404). In Chrome DevTools → Application → Manifest, confirm no errors and an "Install" affordance appears.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(pwa): mobile-first installable shell with Serwist service worker"
```

---

## Task 18: Final integration & verification pass

**Files:**
- None new — this task only runs and reviews.

- [ ] **Step 1: Full test suite**

```bash
npm run test:run
```

Expected: every test written in Tasks 2, 10, 11, 12, 13, 14 passes, including the permanent Julio Madrid Caturra Nitro calibration test.

- [ ] **Step 2: Full audit**

```bash
npm audit
```

Expected: only the accepted moderate `drizzle-kit`/`esbuild` dev-only advisory from Task 3 (re-verify it's still the only one — if new advisories appeared during this plan's dependency installs, triage them now per the Global Constraints policy before proceeding).

- [ ] **Step 3: Lint and build**

```bash
npm run lint
npm run build
```

Expected: both succeed with no errors.

- [ ] **Step 4: Manual end-to-end walkthrough (hero flow 2, partial — full timing/one-hand test is Plan 2's shot-logging flow)**

Fresh incognito window: visit the app root, confirm redirect to `/login`; log in as Chase's account; land on `/library` (empty); add a coffee via paste (use the Julio Madrid fixture) and confirm it shows up rated and reviewed; add a second, different coffee via the barcode scan tab using any real-world barcode and confirm it reaches the Open Food Facts or not-found branch and still completes via the paste fallback; confirm both coffees appear on `/library`, and that visiting `/coffee/[id]` for each shows the right facts.

- [ ] **Step 5: Push everything and confirm CI is green**

```bash
git push
```

Visit the repo's Actions tab (`https://github.com/ccmalcom/coffee-app/actions`) and confirm the latest run is green. If it fails only on missing secrets, add the four secrets listed in Task 3 Step 3 and re-run.

- [ ] **Step 6: Tag the release**

```bash
git tag -a plan-1-complete -m "Plan 1: Foundation + Coffee Log complete"
git push origin plan-1-complete
git log --oneline
```

Expected: a clean, readable commit history from Task 1 through Task 17, tagged and pushed.

---

## Self-review notes (kept for the record)

**Spec coverage:** repo scaffold + CLAUDE.md + dependency-security hooks ✓ (Task 1), Supabase+Drizzle schema for all spec tables ✓ (Tasks 6–7), single-user auth bootstrap ✓ (Task 8), audit-in-CI ✓ (Task 3), knowledge corpus ✓ (Task 9), LLM listing parser with permanent fixture ✓ (Task 11), paste/URL + barcode (catalog→open-DB→fallback) + rate/review ✓ (Tasks 14–16), Library screen ✓ (Task 16), mobile-first PWA ✓ (Task 17). Onboarding directive UI, equipment/shots/taste-profile/discovery UI intentionally excluded per the Scope Boundary section — schema only, as instructed.

**Amended after initial approval (2026-07-07, same day):** Chase provisioned the GitHub repo and Supabase project after this plan was first written, and separately asked that project setup generally include CLAUDE.md, a `.claude/` directory, and hooks. Task 1 now writes `CLAUDE.md` and two hooks enforcing the dependency-security policy (block `npm audit fix --force`, remind after every install/update) instead of leaving that policy as prose only; Task 1/3/18 now push to the real remote instead of treating that as a deferred manual step; Task 4 uses the real Supabase project ref/URL/key instead of placeholder dashboard steps. No other task changed.

**Open items carried forward to later plans:** Vercel Cron cadence/chunking (Plan 4), whether `web_search` sourcing uses Bright Data SERP vs Discover API (Plan 4), onboarding directive UI and its effect on Stage-1/Stage-2 scoring (Plans 3–4), photo-based bag capture with vision extraction (flagged as a Plan 1 follow-up enhancement in Task 15, not a blocker).