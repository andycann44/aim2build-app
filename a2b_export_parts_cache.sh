#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd "$(dirname "$0")"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <set_num>   # accepts dashed or plain, e.g. 21330 or 21330-1"
  exit 1
fi

SET_RAW="$1"
DB="backend/app/data/lego_catalog.db"
OUT_DIR="backend/app/data/parts_cache"
mkdir -p "$OUT_DIR"

if [ ! -f "$DB" ]; then
  echo "Missing $DB — build it first."
  exit 1
fi

# Normalise set number: if plain number given, prefer <num>-1 when present
SET_NORM="$SET_RAW"
if [[ "$SET_RAW" != *-* ]]; then
  if sqlite3 "$DB" "SELECT 1 FROM sets WHERE set_num='${SET_RAW}-1' LIMIT 1;" | grep -q 1; then
    SET_NORM="${SET_RAW}-1"
  fi
fi

OUT="$OUT_DIR/$SET_NORM.json"

# Export parts for the set into JSON (part_num,color_id,quantity), grouped
sqlite3 -separator '|' "$DB" "
  SELECT part_num, color_id, SUM(quantity)
  FROM inventory_parts_summary
  WHERE set_num='$SET_NORM'
  GROUP BY part_num, color_id
  ORDER BY part_num, color_id;
" | awk -F'|' '
  BEGIN { print "[" }
  { printf("%s{\"part_num\":\"%s\",\"color_id\":%s,\"quantity\":%s}", NR>1?",":"", $1, $2, $3) }
  END { print "]" }
' > "$OUT"

# Quick sanity
echo "Wrote $OUT"
head -n 2 "$OUT" || true
