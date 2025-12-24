#!/bin/bash
set -euo pipefail

fail() { echo "LOCKED RULES VIOLATION: $1" >&2; exit 1; }

LOCKED_DOC="AIM2BUILD_LOCKED.md"
INV_ROUTER="backend/app/routers/inventory.py"

[ -f "$LOCKED_DOC" ] || fail "Missing $LOCKED_DOC"
[ -f "$INV_ROUTER" ] || fail "Missing $INV_ROUTER"

# Rule: No inventory_images router/file/imports (LOCKED)
[ ! -f backend/app/routers/inventory_images.py ] || fail "inventory_images router file must not exist"
if git grep -nI "inventory_images" -- backend/app 2>/dev/null | grep -v "$LOCKED_DOC" >/dev/null; then
  fail "inventory_images must not be referenced in backend/app (doc-only mention allowed)"
fi

# Rule: Inventory mutation endpoints must be canonical-only (LOCKED)
# Disallow legacy mutations in inventory router; allow canonical endpoints incl clear-canonical.
bad_lines="$(
  git grep -nE '@router\.(post|put|delete|patch)\("/(add_batch|add|replace|decrement|batch_[^"]*|clear|part|remove_set|remove-set)' -- "$INV_ROUTER" 2>/dev/null \
  | grep -vE '"/(add-canonical|set-canonical|decrement-canonical|clear-canonical)"' \
  || true
)"

if [ -n "$bad_lines" ]; then
  echo "$bad_lines" >&2
  fail "Backend defines non-canonical inventory mutation routes. Only add-canonical/set-canonical/decrement-canonical/clear-canonical allowed."
fi

echo "OK: Locked rules satisfied."
