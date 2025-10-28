#!/bin/bash
: "${HISTTIMEFORMAT:=}"; set -euo pipefail
tail -n 60 "$HOME/aim2build-app/backend/uvicorn.out" || true
echo "----"
tail -n 60 "$HOME/aim2build-app/frontend/vite.out" || true
