#!/bin/bash
: "${HISTTIMEFORMAT:=}"
: "${size:=}"   # neutralise unbound $size
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

: "${HISTTIMEFORMAT:=}"; set -euo pipefail
"$HOME/aim2build-app/a2p_dev_stop.sh"
"$HOME/aim2build-app/a2p_dev_start.sh" "$@"
