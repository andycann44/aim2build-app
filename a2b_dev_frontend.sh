#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

# Default API base if not provided
export VITE_API_BASE="${VITE_API_BASE:-http://127.0.0.1:8000}"

cd "$(dirname "$0")/frontend"

# Install once, then run dev
if [ ! -d node_modules ]; then
  npm install
fi

# Run Vite on standard port
npm run dev -- --host 127.0.0.1 --port 5173
