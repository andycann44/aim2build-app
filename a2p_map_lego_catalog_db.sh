#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd ~/aim2build-app

DB="backend/app/data/lego_catalog.db"
OUT_DIR="docs"
OUT_MD="$OUT_DIR/db_map_lego_catalog.md"
OUT_TSV="$OUT_DIR/db_map_lego_catalog.tsv"

mkdir -p "$OUT_DIR"
[ -f "$DB" ] || { echo "ERROR: DB not found at $DB"; exit 1; }

echo "# lego_catalog.db schema map" > "$OUT_MD"
echo "" >> "$OUT_MD"
echo "- Generated: $(date -u +"%Y-%m-%d %H:%M:%SZ")" >> "$OUT_MD"
echo "- Path: $DB" >> "$OUT_MD"
echo "" >> "$OUT_MD"

echo -e "table\tcid\tname\ttype\tnotnull\tdflt_value\tpk" > "$OUT_TSV"

TABLES="$(sqlite3 "$DB" "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")"

for t in $TABLES; do
  echo "## $t" >> "$OUT_MD"
  echo "" >> "$OUT_MD"
  echo '```' >> "$OUT_MD"
  sqlite3 "$DB" "PRAGMA table_info('$t');" >> "$OUT_MD"
  echo '```' >> "$OUT_MD"
  echo "" >> "$OUT_MD"

  sqlite3 "$DB" "PRAGMA table_info('$t');" \
    | awk -F'|' -v T="$t" 'BEGIN{OFS="\t"} {print T,$1,$2,$3,$4,$5,$6}' >> "$OUT_TSV"

  echo "**Indexes**" >> "$OUT_MD"
  echo "" >> "$OUT_MD"
  echo '```' >> "$OUT_MD"
  sqlite3 "$DB" "PRAGMA index_list('$t');" >> "$OUT_MD"
  echo '```' >> "$OUT_MD"
  echo "" >> "$OUT_MD"
done

echo "Wrote:"
echo " - $OUT_MD"
echo " - $OUT_TSV"
