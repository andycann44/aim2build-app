#!/bin/bash
: "${HISTTIMEFORMAT:=}"; set -euo pipefail
"$HOME/aim2build-app/a2p_dev_stop.sh"
"$HOME/aim2build-app/a2p_dev_start.sh" "$@"
