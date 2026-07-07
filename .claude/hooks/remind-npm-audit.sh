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
