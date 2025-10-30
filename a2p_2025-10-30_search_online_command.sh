#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd ~/aim2build-app

BRANCH="a2p/2025-10-30-search-online-command"
git switch -c "$BRANCH"

mkdir -p backend/app/commands

cat > backend/app/commands/search_online.py <<EOF
import requests

def search_online(query, api_key=None):
    url = f"https://rebrickable.com/api/v3/lego/sets/?search={query}"
    headers = {"Authorization": f"key {api_key}"} if api_key else {}
    r = requests.get(url, headers=headers)
    if r.status_code != 200:
        raise RuntimeError(f"Search failed: {r.status_code}")
    return r.json().get("results", [])
EOF

cat > backend/app/routers/search_online.py <<EOF
from fastapi import APIRouter, HTTPException, Query
from ..commands.search_online import search_online

router = APIRouter()

@router.get("/sets/search_online")
def search_sets_online(q: str = Query(..., alias="q")):
    try:
        return {"items": search_online(q)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
EOF

# Update router mount if not already mounted
grep -q "routers.search_online" backend/app/main.py || echo "from .routers import search_online" >> backend/app/main.py
grep -q "search_online.router" backend/app/main.py || echo "app.include_router(search_online.router, prefix='/api')" >> backend/app/main.py

git add .
git commit -m "Add online search via /api/sets/search_online"
git push --set-upstream origin "$BRANCH"
