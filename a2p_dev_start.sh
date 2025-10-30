#!/bin/bash
: "${HISTTIMEFORMAT:=}"
: "${size:=}"   # neutralise unbound $size
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

: "${HISTTIMEFORMAT:=}"; set -euo pipefail
ROOT="$HOME/aim2build-app"; BE="$ROOT/backend"; FE="$ROOT/frontend"
TUNNEL="${1:-}"
# backend
python3 -m venv "$BE/.venv" >/dev/null 2>&1 || true
source "$BE/.venv/bin/activate"
pip install -q -r "$BE/requirements.txt"
lsof -ti :8000 -sTCP:LISTEN | xargs -r kill
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload > "$BE/uvicorn.out" 2>&1 & echo $! > "$BE/uvicorn.pid"
# wait for health
for i in {1..30}; do curl -sf http://127.0.0.1:8000/api/health >/dev/null && break || sleep 0.3; done
# frontend
cd "$FE"
npm pkg set scripts.dev="vite" >/dev/null
[ -f package-lock.json ] || npm install >/dev/null
lsof -ti :5173 -sTCP:LISTEN | xargs -r kill
printf 'VITE_API_BASE=%s\n' "http://127.0.0.1:8000" > "$FE/.env.local"
nohup npm run dev -- --host --port 5173 > "$FE/vite.out" 2>&1 & echo $! > "$FE/vite.pid"
sleep 1
if [ "$TUNNEL" = "--tunnel" ]; then
  command -v cloudflared >/dev/null 2>&1 || brew install cloudflared
  pkill -f "cloudflared tunnel --url" >/dev/null 2>&1 || true
  cloudflared tunnel --url http://127.0.0.1:8000 --logfile /tmp/cf_be.log --loglevel info >/dev/null 2>&1 & echo $! > /tmp/cf_be.pid
  sleep 1
  cloudflared tunnel --url http://127.0.0.1:5173 --logfile /tmp/cf_fe.log --loglevel info >/dev/null 2>&1 & echo $! > /tmp/cf_fe.pid
  sleep 2
  BE_URL=$(grep -Eo 'https://[A-Za-z0-9.-]+trycloudflare\.com' /tmp/cf_be.log | tail -1 || true)
  FE_URL=$(grep -Eo 'https://[A-Za-z0-9.-]+trycloudflare\.com' /tmp/cf_fe.log | tail -1 || true)
  if [ -n "$BE_URL" ]; then
    printf 'VITE_API_BASE=%s\n' "$BE_URL" > "$FE/.env.local"
    lsof -ti :5173 -sTCP:LISTEN | xargs -r kill
    nohup npm run dev -- --host --port 5173 >> "$FE/vite.out" 2>&1 & echo $! > "$FE/vite.pid"
  fi
  echo "Frontend tunnel: ${FE_URL:-<pending>}"; echo "Backend tunnel : ${BE_URL:-<pending>}"
fi
echo "Local FE: http://127.0.0.1:5173   Local API: http://127.0.0.1:8000"
