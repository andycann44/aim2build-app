#!/bin/bash
: "${HISTTIMEFORMAT:=}"; set -euo pipefail

cd "$(git rev-parse --show-toplevel 2>/dev/null || echo ~/aim2build-app)"

CSV_DIR_INPUT="${CSV_DIR:-$PWD/csv}"
DB="backend/app/data/lego_catalog.db"

if [ ! -d "$CSV_DIR_INPUT" ]; then
  echo "CSV directory not found: $CSV_DIR_INPUT"
  exit 1
fi

CSV_DIR_ABS="$(cd "$CSV_DIR_INPUT" && pwd)"
echo "Using CSV directory: $CSV_DIR_ABS"

A2B_CATALOG_CSV="$CSV_DIR_ABS" python - <<'PY'
import json
import os

from catalog_import.import_csv import import_catalog

dir_path = os.environ["A2B_CATALOG_CSV"]
result = import_catalog(dir_path)
print(json.dumps(result, indent=2))
PY

echo "Database written to $DB"
if command -v sqlite3 >/dev/null 2>&1; then
  echo -n "Sets: "
  sqlite3 "$DB" "SELECT COUNT(*) FROM sets;"
  echo -n "Inventory summary: "
  sqlite3 "$DB" "SELECT COUNT(*) FROM inventory_parts_summary;"
fi
