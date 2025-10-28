#!/bin/bash
: "${HISTTIMEFORMAT:=}"; set -euo pipefail
ROOT="$HOME/aim2build-app"; BE="$ROOT/backend"; FE="$ROOT/frontend"
lsof -ti :5173 -sTCP:LISTEN | xargs -r kill; rm -f "$FE/vite.pid"
lsof -ti :8000 -sTCP:LISTEN | xargs -r kill; rm -f "$BE/uvicorn.pid"
pkill -f "cloudflared tunnel --url" >/dev/null 2>&1 || true
echo "Stopped FE/BE and tunnels."
