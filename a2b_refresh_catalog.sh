#!/bin/bash
: "${HISTTIMEFORMAT:=}"; set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd "$(dirname "$0")"

CSV_DIR="csv"
DB_PATH="backend/app/data/lego_catalog.db"

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
  inventory_minifigs
  minifigs
  minifig_parts
)

mkdir -p "$CSV_DIR" backend/app/data

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required to download the Rebrickable exports" >&2
  exit 1
fi

echo "📥 Downloading Rebrickable export (12 files)"
pushd "$CSV_DIR" >/dev/null
for name in "${FILES[@]}"; do
  URL="https://rebrickable.com/media/downloads/${name}.csv.gz"
  echo "  • $name"
  rm -f "${name}.csv" "${name}.csv.gz"
  if ! curl --fail --location --silent --show-error \
    --retry 5 --retry-delay 2 --retry-all-errors \
    --output "${name}.csv.gz" "$URL"; then
    status=$?
    echo "    curl exited with status $status" >&2
    if [ "$status" -eq 56 ]; then
      echo "    Status 56 indicates a transient network read error (connection reset/closed)." >&2
      echo "    Re-run the script or try the offline reimport if the error persists." >&2
    fi
    exit $status
  fi
  gunzip -f "${name}.csv.gz"
done
popd >/dev/null

echo "🧹 Rebuilding catalog database at $DB_PATH"
rm -f "$DB_PATH"

python - <<'PY'
from catalog_import.import_csv import import_catalog
import json

result = import_catalog("csv")
print(json.dumps(result, indent=2))
PY

echo "✅ Catalog refreshed: $DB_PATH"
if command -v sqlite3 >/dev/null 2>&1; then
  echo -n "Sets table rows: "
  sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sets;"
  echo -n "Inventory summary rows: "
  sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM inventory_parts_summary;"
fi
