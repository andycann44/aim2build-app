#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

echo "[+] Starting clean backend rebuild (v0.2.0)"

# Remove backup and temp files
find backend/app -name '*.bak' -delete
find backend/app -name '.DS_Store' -delete

# Create folder structure
mkdir -p backend/app/commands
mkdir -p backend/app/routers
mkdir -p backend/app/db/seed_data

# Move schema + DB to db/
[ -f backend/app/schema.sql ] && mv backend/app/schema.sql backend/app/db/
[ -f backend/app/aim2build.db ] && mv backend/app/aim2build.db backend/app/db/

# Create config.py
cat <<EOF > backend/app/config.py
MODE = "offline"  # or "online"
DB_PATH = "backend/app/db/aim2build.db"
EOF

# Create commands
cat <<EOF > backend/app/commands/__init__.py
# command package init
EOF

cat <<EOF > backend/app/commands/search.py
def search_sets(query, mode="offline"):
    if mode == "online":
        # TODO: call Rebrickable API
        return {"source": "online", "results": []}
    else:
        # TODO: search local DB
        return {"source": "offline", "results": []}
EOF

cat <<EOF > backend/app/commands/add_set.py
def add_set(set_num):
    # TODO: add set to owned_sets
    return {"ok": True, "set_num": set_num}
EOF

cat <<EOF > backend/app/commands/import_sets.py
def import_all():
    # TODO: import CSVs or call Rebrickable
    return {"ok": True, "imported": 0}
EOF

# Create routers
cat <<EOF > backend/app/routers/__init__.py
# router package init
EOF

cat <<EOF > backend/app/routers/catalog.py
from fastapi import APIRouter
from ..commands import import_sets

router = APIRouter()

@router.post("/catalog/import")
def catalog_import():
    return import_sets.import_all()

@router.get("/catalog/stats")
def catalog_stats():
    return {"sets": 0, "parts": 0}  # TODO: hook into DB
EOF

cat <<EOF > backend/app/routers/sets.py
from fastapi import APIRouter
from ..commands import search, add_set

router = APIRouter()

@router.get("/search_sets")
def search_sets(q: str):
    return search.search_sets(q)

@router.post("/add_set")
def add_set_route(set_num: str):
    return add_set.add_set(set_num)
EOF

# Clean main.py
cat <<EOF > backend/app/main.py
from fastapi import FastAPI
from .routers import catalog, sets

app = FastAPI()
app.include_router(catalog.router)
app.include_router(sets.router)
EOF

# Git setup
git checkout -b a2p/2025-10-29-clean-backend
git add backend/app
git commit -m "Clean backend rebuild (v0.2.0) with command structure"
git push -u origin a2p/2025-10-29-clean-backend
gh pr create --fill --title "Clean backend rebuild (v0.2.0)" --body "Fresh structure with commands + routers"
