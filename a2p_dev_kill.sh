#!/bin/bash
: "${HISTTIMEFORMAT:=}"; set -euo pipefail
pkill -f "uvicorn app.main:app" 2>/dev/null || true
pkill -f "vite.*--port 5173" 2>/dev/null || true
pkill -f "cloudflared tunnel --url" 2>/dev/null || true
echo "Killed all dev processes."
