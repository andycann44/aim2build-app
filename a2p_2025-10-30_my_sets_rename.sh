#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd ~/aim2build-app

BRANCH="a2p/2025-10-30-my-sets-rename"
git switch -c "$BRANCH"

# Rename backend route
sed -i '' 's/owned_sets/my_sets/g' backend/app/routers/owned_sets.py || true
mv backend/app/routers/owned_sets.py backend/app/routers/my_sets.py

# Update main.py router import and mount
sed -i '' 's/from .routers import owned_sets/from .routers import my_sets/' backend/app/main.py
sed -i '' 's/app.include_router(owned_sets.router/app.include_router(my_sets.router/' backend/app/main.py
sed -i '' 's|prefix="/api"|prefix="/api/my-sets"|' backend/app/main.py

# Frontend page rename (basic)
find frontend/src/pages -type f -name "*.tsx" -exec sed -i '' 's/Owned Sets/My Sets/g' {} +
mv frontend/src/pages/OwnedSets.tsx frontend/src/pages/MySets.tsx || true

git add .
git commit -m "Rename Owned Sets to My Sets (backend + frontend)"
git push --set-upstream origin "$BRANCH"
