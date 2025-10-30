#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
cd ~/aim2build-app

mkdir -p backend/app/commands
mkdir -p backend/app/routers

cat > backend/app/commands/search_online.py << 'EOF'
import requests

def search_online_sets(query: str, api_key: str = ""):
    url = f"https://rebrickable.com/api/v3/lego/sets/?search={query}"
    headers = {"Authorization": f"key {api_key}"} if api_key else {}
    r = requests.get(url, headers=headers)
    r.raise_for_status()
    return r.json().get("results", [])
EOF

cat > backend/app/routers/search_online.py << 'EOF'
from fastapi import APIRouter, Query
from ..commands.search_online import search_online_sets

router = APIRouter()

@router.get("/sets/search_online")
def search_online(q: str = Query(..., description="Search query")):
    return {"items": search_online_sets(q)}
EOF

# Patch main.py to include the router
sed -i '' '/from \.\.routers import/c\
from .routers import catalog, sets, inventory, my_sets, search_online
' backend/app/main.py

sed -i '' '/include_router(catalog.router/ a\
app.include_router(search_online.router, prefix="/api")
' backend/app/main.py

echo "[ok] Online search command + route installed."