#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd ~/aim2build-app

OUT_DIR="backend/app/data/rebrickable"
LOG="rebrickable_csv_refresh.log"

# Rebrickable export names (cdn.rebrickable.com/media/downloads/<name>.csv.gz)
FILES=(
  colors
  part_categories
  parts
  part_relationships
  elements
  themes
  sets
  inventories
  inventory_parts
  inventory_sets
  inventory_minifigs
  minifigs
  minifig_parts
)

mkdir -p "$OUT_DIR"

echo "==> Rebrickable CSV refresh to: $OUT_DIR" | tee -a "$LOG"
date -u +"UTC %Y-%m-%d %H:%M:%S" | tee -a "$LOG"

for name in "${FILES[@]}"; do
  url="https://cdn.rebrickable.com/media/downloads/${name}.csv.gz"
  gz="${OUT_DIR}/${name}.csv.gz"
  csv="${OUT_DIR}/${name}.csv"

  echo "--- $name" | tee -a "$LOG"
  echo "GET $url" | tee -a "$LOG"

  curl -fL --retry 3 --retry-delay 2 -o "$gz" "$url"

  gunzip -f "$gz"

  # sanity: file exists and not tiny (catches 404/html/etc)
  if [ ! -s "$csv" ]; then
    echo "ERROR: empty file: $csv" | tee -a "$LOG"
    exit 2
  fi

  bytes="$(wc -c < "$csv" | tr -d ' ')"
  if [ "$bytes" -lt 1024 ]; then
    echo "ERROR: suspiciously small CSV ($bytes bytes): $csv" | tee -a "$LOG"
    echo "This usually means the CDN returned an error or placeholder content." | tee -a "$LOG"
    exit 3
  fi

  # sanity: must have a header row
  head -n 1 "$csv" | grep -q ',' || {
    echo "ERROR: no CSV header detected: $csv" | tee -a "$LOG"
    exit 4
  }

  ls -lah "$csv" | tee -a "$LOG"
done

echo "==> OK: CSV refresh complete" | tee -a "$LOG"
