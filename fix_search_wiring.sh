#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

echo "Fixing frontend SetsSearch.tsx to point to correct backend route..."

# Path to SetsSearch.tsx
SETS_SEARCH="frontend/src/pages/SetsSearch.tsx"

# Backup before editing
cp "$SETS_SEARCH" "$SETS_SEARCH.bak"

# Replace old endpoint with correct one
sed -i '' 's|/api/rebrickable/search_sets|/api/search/search_sets|g' "$SETS_SEARCH"

echo "✅ Replaced search endpoint in SetsSearch.tsx"

echo "Verifying backend router include in main.py..."

# Show the line with router in main.py
grep "include_router(search_online.router" backend/app/main.py || echo "❌ Missing router line in main.py"

echo "✅ Done. Run backend + frontend now to test."
