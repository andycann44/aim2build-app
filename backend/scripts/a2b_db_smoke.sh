#!/bin/bash
: "${HISTTIMEFORMAT:=}"; set -euo pipefail
API=${VITE_API_BASE:-http://127.0.0.1:8000}
command -v jq >/dev/null || { echo "Please install jq"; exit 1; }
# try to start backend if not up
if ! curl -fsS "$API/api/health" >/dev/null 2>&1; then
  pkill -f "uvicorn.*8000" 2>/dev/null || true
  ( cd "$(git rev-parse --show-toplevel)/backend" && uvicorn app.main:app --reload --port 8000 ) >/tmp/a2b_uvicorn.log 2>&1 &
  sleep 1
fi
echo "Health:"; curl -fsS "$API/api/health" | jq .
echo "Search(train):"; curl -fsS "$API/api/search?q=train" | jq '.[0:5]'
echo "Inv parts (21330-1):"; curl -fsS "$API/api/inventory/parts?set=21330-1&limit=5" | jq .
echo "Compare (21330-1):"; curl -fsS "$API/api/buildability/compare?set=21330-1" | jq .
echo "Smoke OK"
