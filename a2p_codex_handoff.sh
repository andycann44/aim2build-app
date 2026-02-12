#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd ~/aim2build-app

: "${A2B_API_BASE:=http://127.0.0.1:8000}"

auth_hdr=()
if [ -n "${A2B_TOKEN:-}" ]; then
  auth_hdr=(-H "Authorization: ${A2B_TOKEN}")
fi

curl_safe() {
  local url="$1"
  echo "-- GET ${url}"
  if [ ${#auth_hdr[@]} -gt 0 ]; then
    curl -sS -i "${auth_hdr[@]}" "${url}" | head -n 40 || true
  else
    curl -sS -i "${url}" | head -n 40 || true
  fi
  echo
}

echo "[a2b] API base: ${A2B_API_BASE}"
echo

curl_safe "${A2B_API_BASE}/api/health"
curl_safe "${A2B_API_BASE}/api/brick/parents"
curl_safe "${A2B_API_BASE}/api/brick/children?parent_key=brick"
curl_safe "${A2B_API_BASE}/api/brick/filters?parent_key=brick"
curl_safe "${A2B_API_BASE}/api/search?q=21330"
curl_safe "${A2B_API_BASE}/api/buildability/compare?set=21330-1"

PROMPT_FILE="/tmp/a2p_codex_handoff_prompt.txt"
if [ -f "${PROMPT_FILE}" ]; then
  echo "[a2b] Codex prompt exists: ${PROMPT_FILE}"
else
  echo "[a2b] WARNING: prompt file missing: ${PROMPT_FILE}"
fi

echo
echo "[a2b] Done."
