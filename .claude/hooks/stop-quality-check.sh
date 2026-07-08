#!/bin/bash
# .claude/hooks/stop-quality-check.sh
# Runs typecheck, lint, and Prettier format check before Claude is allowed to
# stop. Blocks (exit 2) with the combined failure output so issues get fixed
# in-session instead of silently accumulating.
cd "${CLAUDE_PROJECT_DIR}" || exit 0

# Skip entirely when there's nothing worth checking: no uncommitted changes,
# or the only changes are to files typecheck/lint/format wouldn't touch
# anyway (docs, lockfiles, etc. — mirrors .prettierignore's own exclusions).
CHANGED=$(git status --porcelain 2>/dev/null | sed -E 's/^.{3}//; s/.* -> //')

if [ -z "$CHANGED" ]; then
  exit 0
fi

RELEVANT=$(echo "$CHANGED" | grep -viE '^(docs/|knowledge/|\.vscode/|drizzle/meta/|CLAUDE\.md$|AGENTS\.md$|package-lock\.json$|pnpm-lock\.yaml$)' | grep -E '\.(ts|tsx|js|jsx|mjs|cjs|json|css|ya?ml|md)$')

if [ -z "$RELEVANT" ]; then
  exit 0
fi

FAILED=""
OUTPUT=""

run_check() {
  local name="$1"
  shift
  local result
  if ! result=$("$@" 2>&1); then
    FAILED="$FAILED $name"
    OUTPUT="$OUTPUT
--- $name failed ---
$result
"
  fi
}

run_check "typecheck" npm run typecheck --silent
run_check "lint" npm run lint --silent
run_check "format:check" npm run format:check --silent

if [ -n "$FAILED" ]; then
  echo "Quality checks failed before stopping:$FAILED
$OUTPUT
Fix these issues. 'npm run format' auto-fixes formatting; typecheck and lint failures need manual fixes." >&2
  exit 2
fi

exit 0
