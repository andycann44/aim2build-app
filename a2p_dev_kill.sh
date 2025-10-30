#!/bin/bash
: "${HISTTIMEFORMAT:=}"
: "${size:=}"   # neutralise unbound $size
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

: "${HISTTIMEFORMAT:=}"; set -euo pipefail
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "vite.*--port 5173" 2>/dev/null || true
pkill -f "cloudflared tunnel --url" 2>/dev/null || true
echo "Killed all dev processes."
