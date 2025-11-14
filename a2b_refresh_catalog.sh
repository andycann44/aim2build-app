#!/bin/bash
: "${HISTTIMEFORMAT:=}"; set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd "$(dirname "$0")"

CSV_DIR="csv"
DB_PATH="backend/app/data/lego_catalog.db"
DEFAULT_EXPORT_BASE="https://rebrickable.com/media/downloads"
DISCOVERY_SCRIPT="catalog_import/discover_rebrickable_export_base.py"
DOWNLOAD_FAILURE_URL=""
DOWNLOAD_FAILURE_STATUS=0

detect_export_base() {
  if [ -f "$DISCOVERY_SCRIPT" ]; then
    python3 "$DISCOVERY_SCRIPT" 2>/dev/null || true
  fi
}

resolve_export_base() {
  if [ -n "${REBRICKABLE_EXPORT_BASE:-}" ]; then
    printf '%s\n' "${REBRICKABLE_EXPORT_BASE%/}"
    return
  fi

  if detected=$(detect_export_base) && [ -n "$detected" ]; then
    printf '%s\n' "$detected"
    return
  fi

  echo "⚠️  Could not auto-detect the Rebrickable export base; falling back to $DEFAULT_EXPORT_BASE" >&2
  printf '%s\n' "$DEFAULT_EXPORT_BASE"
}

report_download_failure() {
  local export_base="$1"
  local attempt_label="$2"
  local url="${DOWNLOAD_FAILURE_URL:-unknown}"
  local status="${DOWNLOAD_FAILURE_STATUS:-1}"
  printf '\n%s\n\n' '────────────────────────────────────────────────────────────' >&2
  cat <<EOF >&2
❌ curl could not download one of the CSVs. Rebrickable rotates the date-stamped
   export directory periodically, so stale values for REBRICKABLE_EXPORT_BASE
   will trigger HTTP 404 errors like the one you just saw.

   Attempt: $attempt_label
   Export base: $export_base
   Attempted URL: $url
   curl/gunzip exit status: $status

   Try one of the following and rerun ./a2b_refresh_catalog.sh:
     • Allow the script to auto-detect the base URL (unset REBRICKABLE_EXPORT_BASE)
     • Run: python3 catalog_import/discover_rebrickable_export_base.py
       …and export the path it prints
     • Copy the latest directory from https://rebrickable.com/downloads/
       and export REBRICKABLE_EXPORT_BASE to that value
EOF
}

download_csvs() {
  local export_base="$1"
  pushd "$CSV_DIR" >/dev/null
  for name in "${FILES[@]}"; do
    local url="${export_base}/${name}.csv.gz"
    echo "  • $name"
    if ! curl -fsSLO "$url"; then
      DOWNLOAD_FAILURE_URL="$url"
      DOWNLOAD_FAILURE_STATUS=$?
      rm -f "${name}.csv.gz"
      popd >/dev/null
      return 1
    fi
    if ! gunzip -f "${name}.csv.gz"; then
      DOWNLOAD_FAILURE_URL="$url (gunzip)"
      DOWNLOAD_FAILURE_STATUS=$?
      popd >/dev/null
      return 1
    fi
  done
  popd >/dev/null
  DOWNLOAD_FAILURE_URL=""
  DOWNLOAD_FAILURE_STATUS=0
  return 0
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
if ! download_csvs "$EXPORT_BASE"; then
  primary_status="${DOWNLOAD_FAILURE_STATUS:-1}"
  report_download_failure "$EXPORT_BASE" "primary"
  if [ -n "${REBRICKABLE_EXPORT_BASE:-}" ]; then
    if detected=$(detect_export_base) && [ -n "$detected" ] && [ "$detected" != "$EXPORT_BASE" ]; then
      echo "🔁 REBRICKABLE_EXPORT_BASE override failed; retrying with auto-detected export"
      EXPORT_BASE="$detected"
      export REBRICKABLE_EXPORT_BASE="$detected"
      echo "🌐 Retrying Rebrickable export base: $EXPORT_BASE"
      if ! download_csvs "$EXPORT_BASE"; then
        retry_status="${DOWNLOAD_FAILURE_STATUS:-$primary_status}"
        report_download_failure "$EXPORT_BASE" "auto-retry"
        exit $retry_status
      fi
    else
      exit $primary_status
    fi
  else
    exit $primary_status
  fi
fi

echo "🧹 Rebuilding catalog database at $DB_PATH"
rm -f "$DB_PATH"

python3 - <<'PY'
from catalog_import.import_csv import import_catalog
import json

result = import_catalog("csv")
print(json.dumps(result, indent=2))
PY

echo "✅ Catalog refreshed: $DB_PATH"
if command -v sqlite3 >/dev/null 2>&1; then
  echo "📊 sqlite3 sanity checks"
  echo "SELECT COUNT(*) FROM sets;"
  sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sets;"
  echo "SELECT COUNT(*) FROM inventory_parts_summary;"
  sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM inventory_parts_summary;"
fi
