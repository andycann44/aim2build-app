#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd ~/aim2build-app

echo ">>> Fetching latest from origin..."
git fetch origin

BRANCH=$(git branch --show-current)
echo ">>> Current branch: $BRANCH"

# Adjust this if your frontend lives somewhere else
FRONTEND_DIR="frontend"

echo ">>> Building file lists for origin/main and $BRANCH under ./$FRONTEND_DIR ..."

git ls-tree -r --name-only origin/main -- "$FRONTEND_DIR" | sort > /tmp/frontend_main.lst || true
git ls-tree -r --name-only HEAD        -- "$FRONTEND_DIR" | sort > /tmp/frontend_branch.lst || true

echo
echo "=== Counts ==="
echo "origin/main frontend files:  $(wc -l < /tmp/frontend_main.lst || echo 0)"
echo "$BRANCH frontend files:      $(wc -l < /tmp/frontend_branch.lst || echo 0)"

echo
echo "=== Files only on origin/main (not on $BRANCH) ==="
comm -23 /tmp/frontend_main.lst /tmp/frontend_branch.lst || echo "(none)"

echo
echo "=== Files only on $BRANCH (not on origin/main) ==="
comm -13 /tmp/frontend_main.lst /tmp/frontend_branch.lst || echo "(none)"

echo
echo "=== Files changed between origin/main and $BRANCH (content diffs) ==="
git diff --name-only origin/main...HEAD -- "$FRONTEND_DIR" || echo "(none)"

echo
echo "Done."
