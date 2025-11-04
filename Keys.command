#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
read -rsp "Paste REBRICKABLE_KEY: " KEY; echo
mkdir -p /tmp
cat > /tmp/a2p_env.sh <<EOF
export REBRICKABLE_KEY='$KEY'
EOF
echo "Saved. This session will use REBRICKABLE_KEY from /tmp/a2p_env.sh"
