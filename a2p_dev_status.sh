#!/bin/bash
: "${HISTTIMEFORMAT:=}"; set -euo pipefail
echo "Ports:"; lsof -nPiTCP:8000,5173 -sTCP:LISTEN || true
echo; echo ".env.local (FE):"; [ -f "$HOME/aim2build-app/frontend/.env.local" ] && cat "$HOME/aim2build-app/frontend/.env.local" || echo "(missing)"
echo; echo "Backend health:"; curl -s http://127.0.0.1:8000/api/health || echo "(down)"
[ -f /tmp/cf_be.log ] && echo; echo "BE tunnel:" && grep -Eo 'https://[A-Za-z0-9.-]+trycloudflare\.com' /tmp/cf_be.log | tail -1 || true
[ -f /tmp/cf_fe.log ] && echo; echo "FE tunnel:" && grep -Eo 'https://[A-Za-z0-9.-]+trycloudflare\.com' /tmp/cf_fe.log | tail -1 || true
