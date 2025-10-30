#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
cd ~/aim2build-app

# Rename file
mv backend/app/routers/owned_sets.py backend/app/routers/my_sets.py || true

# Update route paths in router
sed -i '' 's@/owned_sets@/my-sets@g' backend/app/routers/my_sets.py

# Patch main.py
sed -i '' '/from \.routers import/c\
from .routers import catalog, sets, inventory, my_sets, search_online
' backend/app/main.py

# Rename frontend file
mv frontend/src/pages/OwnedSets.tsx frontend/src/pages/MySets.tsx || true
sed -i '' 's@/api/owned_sets@/api/my-sets@g' frontend/src/pages/MySets.tsx
sed -i '' 's@Owned Sets@My Sets@g' frontend/src/pages/MySets.tsx

echo "[ok] My Sets rename complete."
