#!/bin/bash
: "${HISTTIMEFORMAT:=}"; set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd "$(dirname "$0")"

CSV_DIR="csv"
DB_PATH="backend/app/data/lego_catalog.db"
DEFAULT_EXPORT_BASE="https://rebrickable.com/media/downloads"
DISCOVERY_SCRIPT="catalog_import/discover_rebrickable_export_base.py"

resolve_export_base() {
  if [ -n "${REBRICKABLE_EXPORT_BASE:-}" ]; then
    printf '%s\n' "${REBRICKABLE_EXPORT_BASE%/}"
    return
  fi

  if [ -f "$DISCOVERY_SCRIPT" ]; then
    if detected=$(python3 "$DISCOVERY_SCRIPT" 2>/dev/null) && [ -n "$detected" ]; then
      printf '%s\n' "$detected"
      return
    else
      echo "⚠️  Could not auto-detect the Rebrickable export base; falling back to $DEFAULT_EXPORT_BASE" >&2
    fi
  fi

  printf '%s\n' "$DEFAULT_EXPORT_BASE"
}

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
)

mkdir -p "$CSV_DIR" backend/app/data

EXPORT_BASE=$(resolve_export_base)
echo "🌐 Using Rebrickable export base: $EXPORT_BASE"

echo "📥 Downloading Rebrickable export (11 files)"
pushd "$CSV_DIR" >/dev/null
for name in "${FILES[@]}"; do
  URL="${EXPORT_BASE}/${name}.csv.gz"
  echo "  • $name"
  if ! curl -fsSLO "$URL"; then
    status=$?
    printf '\n%s\n\n' '────────────────────────────────────────────────────────────' >&2
    cat <<EOF >&2
❌ curl could not download one of the CSVs. Rebrickable rotates the date-stamped
   export directory periodically, so stale values for REBRICKABLE_EXPORT_BASE
   will trigger HTTP 404 errors like the one you just saw.

   Attempted URL: $URL
   curl exit status: $status

   Try one of the following and rerun ./a2b_refresh_catalog.sh:
     • Allow the script to auto-detect the base URL (unset REBRICKABLE_EXPORT_BASE)
     • Run: python3 catalog_import/discover_rebrickable_export_base.py
       …and export the path it prints
     • Copy the latest directory from https://rebrickable.com/downloads/
       and export REBRICKABLE_EXPORT_BASE to that value
EOF
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
