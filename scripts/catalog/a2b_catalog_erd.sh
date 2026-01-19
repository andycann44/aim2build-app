#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

# =============================================================================
# Aim2Build – Catalog DB ERD Generator (READ-ONLY)
# =============================================================================
# Reads ONLY backend/app/data/lego_catalog.db
# Outputs Mermaid ERD to docs/_generated/db_lego_catalog.db.mmd
# Does NOT modify any database.
# =============================================================================

cd ~/aim2build-app

DB_PATH="backend/app/data/lego_catalog.db"
OUT_DIR="docs/_generated"
OUT_FILE="${OUT_DIR}/db_lego_catalog.db.mmd"

mkdir -p "${OUT_DIR}"

python3 - <<'PY'
import sqlite3
from pathlib import Path

db_path = Path("backend/app/data/lego_catalog.db")
out_path = Path("docs/_generated/db_lego_catalog.db.mmd")

conn = sqlite3.connect(str(db_path))
conn.row_factory = sqlite3.Row
cur = conn.cursor()

cur.execute("""
    SELECT name
    FROM sqlite_master
    WHERE type='table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name;
""")
tables = [row["name"] for row in cur.fetchall()]

lines = []
lines.append(f"%% Aim2Build ERD – {db_path.name}")
lines.append("erDiagram")

for table in tables:
    cur.execute(f"PRAGMA table_info('{table}');")
    cols = cur.fetchall()

    lines.append(f"  {table.upper()} {{")
    for col in cols:
        col_name = col["name"]
        col_type = (col["type"] or "TEXT").upper()
        pk = " PK" if col["pk"] else ""
        lines.append(f"    {col_type} {col_name}{pk}")
    lines.append("  }")
    lines.append("")

conn.close()
out_path.write_text("\n".join(lines), encoding="utf-8")
print(f"[OK] ERD written to {out_path}")
PY

echo "Done."
