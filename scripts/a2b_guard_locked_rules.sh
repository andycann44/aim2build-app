#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

fail() { echo "LOCKED RULES VIOLATION: $*" >&2; exit 1; }

# --- Rule 1: No inventory_images router/file/imports
if [ -f backend/app/routers/inventory_images.py ]; then
  fail "backend/app/routers/inventory_images.py must not exist (images are from lego_catalog.db element_images only)."
fi

if git grep -nE "\\binventory_images\\b" -- backend/app 2>/dev/null | grep -vE "AIM2BUILD_LOCKED|LOCKED" >/dev/null; then
  fail "Found inventory_images import/usage in backend/app. Remove it."
fi

# --- Rule 1b: No URL rewriting helpers (common patterns)
if git grep -nE "apply_color_to_img_url|rewrite.*img|/parts/ldraw/|split\\(\"/\"\\).*isdigit" -- backend/app 2>/dev/null >/dev/null; then
  fail "Found image URL rewriting logic. Not allowed."
fi

# --- Rule 3: Only canonical inventory mutation endpoints (frontend + backend)
# Block frontend calls to old mutation endpoints.
if git grep -nE "/api/inventory/(add_batch|add\\b(?!-canonical)|replace\\b|decrement\\b(?!-canonical)|batch_|clear\\b|part\\b|remove_set\\b|remove-set)" -- frontend/src 2>/dev/null | grep -vE "canonical" >/dev/null; then
  fail "Frontend references non-canonical inventory mutation endpoints. Only add-canonical/set-canonical/decrement-canonical allowed."
fi

# Block backend route decorators for non-canonical mutations (allow reads).
# NOTE: this is a heuristic guard; tighten if needed.
if git grep -nE "@router\\.(post|delete|put)\\(\"/(add_batch|add\"|replace|decrement\"|batch_|clear|part|remove_set|remove-set)" -- backend/app/routers/inventory.py 2>/dev/null >/dev/null; then
  fail "Backend defines non-canonical inventory mutation routes. Only add-canonical/set-canonical/decrement-canonical allowed."
fi

echo "OK: Locked rules satisfied."

# --- Rule 0: Single source-of-truth locked rules file at repo root only
# (Allow only ./AIM2BUILD_LOCKED.md)
dups=$(find . -type f \( -name "AIM2BUILD_LOCKED.md" -o -name "LOCKED_RULES.md" -o -name "*LOCKED*.md" \) \
  | grep -vE "^\./AIM2BUILD_LOCKED\.md$" || true)
if [ -n "$dups" ]; then
  echo "$dups" >&2
  fail "Duplicate locked rules files found. Keep only ./AIM2BUILD_LOCKED.md"
fi
