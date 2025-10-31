#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh
APP="$HOME/aim2build-app/backend"; PORT=8000
echo "→ A2B Backend Doctor on :$PORT"
cd "$APP" || { echo "No backend at $APP"; exit 1; }
python3 -m venv .venv >/dev/null 2>&1 || true
source .venv/bin/activate
pip install -q fastapi uvicorn[standard] python-dotenv requests
lsof -ti :$PORT | xargs -r kill -9 || true
python3 - <<PY
from pathlib import Path
p = Path("app/main.py")
s = p.read_text()
if "load_dotenv(" not in s:
    s = s.replace("from fastapi import FastAPI, HTTPException",
                  "from fastapi import FastAPI, HTTPException\nfrom dotenv import load_dotenv, find_dotenv\nload_dotenv(find_dotenv())")
    p.write_text(s); print("patched: app/main.py now loads .env")
PY
nohup uvicorn app.main:app --host 127.0.0.1 --port $PORT --reload > uvicorn.out 2>&1 &
for i in {1..40}; do nc -z 127.0.0.1 $PORT && break || sleep 0.25; done
echo -n "Health: "; curl -s http://127.0.0.1:$PORT/api/health || true; echo
echo -n "App sees REBRICKABLE_API_KEY: "
python3 - <<PY
import os; print(bool(os.getenv("REBRICKABLE_API_KEY")))
PY
if ! curl -s http://127.0.0.1:$PORT/api/health >/dev/null; then
  echo "Backend not responding. Last 40 log lines:"; tail -n 40 uvicorn.out || true; exit 1
fi
echo "Syncing 31112-1…"
curl -s -i -X POST "http://127.0.0.1:$PORT/api/v1/sync/rebrickable/sets/31112-1" | sed -n 1,6p
echo -n "BOM rows for 31112-1: "
sqlite3 data/aim2build.db "SELECT COUNT(*) FROM set_bom WHERE set_num=31112-1;" 2>/dev/null || echo "sqlite not found"
echo "Cached sets:"; curl -s "http://127.0.0.1:$PORT/api/v1/catalog/sets" || true; echo
echo "Done."
