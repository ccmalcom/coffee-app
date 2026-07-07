#!/bin/bash
# .claude/hooks/block-audit-force.sh
# Blocks `npm audit fix --force`. Per CLAUDE.md's dependency security policy:
# breaking vulnerability fixes require a written mini-plan and explicit
# approval first — never an automatic forced upgrade.
if ! command -v jq >/dev/null 2>&1; then
  echo "Blocked: jq is required to evaluate this security hook but is not on PATH. Install jq (winget install jqlang.jq) and restart the shell." >&2
  exit 2
fi

COMMAND=$(jq -r '.tool_input.command')

if echo "$COMMAND" | grep -qE -- '(^|[[:space:]])(-f|--force)([[:space:]]|=|$)'; then
  echo "Blocked: '$COMMAND' includes --force. CLAUDE.md's dependency security policy requires a written mini-plan and explicit approval before any breaking dependency upgrade. Use 'npm audit fix' (non-breaking only), or write the mini-plan first." >&2
  exit 2
fi

exit 0
