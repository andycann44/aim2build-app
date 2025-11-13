#!/bin/bash
set -euo pipefail

cd "$(dirname "$0")"

PYTHON_BIN="${PYTHON:-python3}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ Required command '$1' is not available on PATH" >&2
    exit 1
  fi
}

ensure_python() {
  require_cmd "$PYTHON_BIN"
}

ensure_pip() {
  if "$PYTHON_BIN" -m pip --version >/dev/null 2>&1; then
    return
  fi
  echo "📦 Bootstrapping pip via $PYTHON_BIN -m ensurepip"
  if ! "$PYTHON_BIN" -m ensurepip --upgrade >/dev/null 2>&1; then
    echo "❌ Could not initialize pip. Install pip for $PYTHON_BIN and retry." >&2
    exit 1
  fi
}

install_requirements() {
  if [ ! -f catalog_import/requirements.txt ]; then
    echo "❌ catalog_import/requirements.txt not found. Are you in the repo root?" >&2
    exit 1
  fi
  echo "📚 Installing catalog importer requirements"
  "$PYTHON_BIN" -m pip install --user -r catalog_import/requirements.txt
}

ensure_export_base() {
  if [ -n "${REBRICKABLE_EXPORT_BASE:-}" ]; then
    return
  fi
  if base=$("$PYTHON_BIN" catalog_import/discover_rebrickable_export_base.py 2>/dev/null) && [ -n "$base" ]; then
    export REBRICKABLE_EXPORT_BASE="$base"
    echo "🌐 Auto-detected Rebrickable export: $REBRICKABLE_EXPORT_BASE"
  else
    echo "⚠️  Could not auto-detect the Rebrickable export directory. Falling back to default logic in a2b_refresh_catalog.sh" >&2
  fi
}

ensure_python
ensure_pip
install_requirements
ensure_export_base

exec ./a2b_refresh_catalog.sh "$@"
