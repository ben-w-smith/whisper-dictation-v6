#!/usr/bin/env bash
# Fail if renderer UI introduces new hardcoded hex colors. Use tokens from
# src/renderer/src/styles/tokens.css instead.
#
# Mechanism: every hex literal found in the scoped files is normalized as
# "file:#xxxxxx" (stable across line-number changes) and compared against
# scripts/.hex-allowlist.txt. Matches not on the allowlist fail the build.
#
# To intentionally grandfather an existing literal, add it to the allowlist
# file. This is a discouraged escape hatch — prefer extending tokens.css.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

ALLOWLIST_FILE="scripts/.hex-allowlist.txt"
SCOPE=(
  "src/renderer/src/views"
  "src/renderer/src/components"
)

find_hex() {
  rg --no-heading --no-line-number --with-filename \
     -oe '#[0-9a-fA-F]{3,8}\b' \
     --glob '*.tsx' --glob '*.ts' \
     "${SCOPE[@]}" 2>/dev/null \
    | sort -u \
    || true
}

current="$(find_hex)"

if [ ! -f "$ALLOWLIST_FILE" ]; then
  echo "[hex-guard] No allowlist at $ALLOWLIST_FILE — seeding from current state."
  printf '%s\n' "$current" > "$ALLOWLIST_FILE"
  echo "[hex-guard] Baseline seeded. Commit the allowlist file."
  exit 0
fi

allowed="$(sort -u < "$ALLOWLIST_FILE")"

new="$(comm -23 <(printf '%s\n' "$current") <(printf '%s\n' "$allowed") || true)"
stale="$(comm -13 <(printf '%s\n' "$current") <(printf '%s\n' "$allowed") || true)"

if [ -n "$new" ]; then
  echo "✗ [hex-guard] New hardcoded hex colors introduced in renderer UI:"
  printf '%s\n' "$new" | sed 's/^/    /'
  echo ""
  echo "Use tokens from src/renderer/src/styles/tokens.css. If a token does"
  echo "not exist for what you need, add it there and reference it."
  echo ""
  echo "Allowlist (use only as a last resort): $ALLOWLIST_FILE"
  exit 1
fi

if [ -n "$stale" ]; then
  echo "ℹ [hex-guard] Stale allowlist entries (safe to remove):"
  printf '%s\n' "$stale" | sed 's/^/    /'
fi

echo "✓ [hex-guard] No new hardcoded hex colors."
