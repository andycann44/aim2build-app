#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd "$(dirname "$0")"

# Ensure frontend env
mkdir -p frontend
[ -f frontend/.env.local ] || echo "VITE_API_BASE=http://127.0.0.1:8000" > frontend/.env.local

cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
