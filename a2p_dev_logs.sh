#!/bin/bash
: "${HISTTIMEFORMAT:=}"
: "${size:=}"   # neutralise unbound $size
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

: "${HISTTIMEFORMAT:=}"; set -euo pipefail
tail -n 60 "$HOME/aim2build-app/backend/uvicorn.out" || true
echo "----"
tail -n 60 "$HOME/aim2build-app/frontend/vite.out" || true
