#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd "$(dirname "$0")"

# Activate the correct venv path
source venv/bin/activate

# Run the backend
uvicorn app.main:app --reload --port 8000