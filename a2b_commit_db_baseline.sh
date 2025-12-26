#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd ~/aim2build-app

echo ">>> Cleaning venv/pycache noise..."
git restore .venv \
  backend/app/__pycache__ \
  backend/app/routers/__pycache__ \
  catalog_import/__pycache__ 2>/dev/null || true

echo ">>> Removing temporary helper script..."
rm -f a2b_add_part_imgs_simple.sh

echo ">>> Ensuring csv/ stays local-only..."
git reset HEAD csv 2>/dev/null || true

echo ">>> Staging DB baseline importer + helpers..."
git add catalog_import/import_csv.py \
        catalog_import/discover_rebrickable_export_base.py \
        catalog_import/requirements.txt

echo ">>> Committing..."
git commit -m "DB baseline: tidy catalog import and helpers"

echo ">>> Pushing to current branch..."
git push

echo ">>> Final status:"
git status -sb
