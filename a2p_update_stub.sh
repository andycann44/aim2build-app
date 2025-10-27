#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

REPO_SLUG="aim2build-app"
BASE_BRANCH="main"
DATE="$(date +%F)"
BR="a2p/${DATE}-sync"
MSG="chore(sync): update ${DATE}"

git fetch origin || true
git switch -c "${BR}" 2>/dev/null || git switch "${BR}"
git add -A
git commit -m "${MSG}" || echo "No changes to commit."
git push -u origin "${BR}" || true
gh pr create --base "${BASE_BRANCH}" --head "${BR}" --title "Sync: ${DATE}" --body "Auto sync for ${DATE}" || true
