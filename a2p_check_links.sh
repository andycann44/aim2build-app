#!/bin/bash
: "\${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd ~/aim2build-app

echo "🔍 Aim2Build Link Trace Report"
echo

ok()   { printf "✅ %s\n" "\$1"; }
warn() { printf "❌ %s\n" "\$1"; }

check() {
  [ -e "\$1" ] && ok "\$1" || warn "\$1"
}

echo "main.py ➤ routers:"
check backend/app/routers/my_sets.py
check backend/app/routers/buildability.py
check backend/app/routers/inventory.py

echo
echo "main.py ➤ data dependencies:"
check backend/app/data/inventory_parts.json
check backend/app/data/parts_cache/10293.json
check backend/app/data/my_sets.json

echo
echo "buildability.py ➤ uses:"
check backend/app/data/inventory_parts.json
check backend/app/data/parts_cache/10293.json

echo
echo "my_sets.py ➤ uses:"
check backend/app/data/my_sets.json

echo
echo "frontend ➤ entry point:"
check frontend/index.html
