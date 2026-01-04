#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd ~/aim2build-app

BACKEND_DB_DIR="backend/app/data"
OUT_DIR="docs"
mkdir -p "${OUT_DIR}"

python3 - <<'PY'
import sqlite3
from pathlib import Path

backend_db_dir = Path("backend/app/data")
out_dir = Path("docs")
out_dir.mkdir(parents=True, exist_ok=True)

def make_mermaid(db_path: Path, out_path: Path):
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    cur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name;")
    tables = [row["name"] for row in cur.fetchall()]

    lines = []
    lines.append(f"%% ERD for {db_path.name}")
    lines.append("erDiagram")

    # Tables
    for table in tables:
        cur.execute(f"PRAGMA table_info('{table}');")
        cols = cur.fetchall()
        lines.append(f"  {table.upper()} {{")
        for col in cols:
            name = col["name"]
            col_type = (col["type"] or "").upper() or "TEXT"
            pk = "PK" if col["pk"] else ""
            if pk:
                lines.append(f"    {col_type} {name} PK")
            else:
                lines.append(f"    {col_type} {name}")
        lines.append("  }")
        lines.append("")

    # Relationships from foreign keys
    for table in tables:
        cur.execute(f"PRAGMA foreign_key_list('{table}');")
        fks = cur.fetchall()
        for fk in fks:
            src = table.upper()
            dst = fk["table"].upper()
            rel = f"  {dst} ||--o{{ {src} : fk"
            if rel not in lines:
                lines.append(rel)

    conn.close()
    out_path.write_text("\n".join(lines), encoding="utf-8")
    print(f"[OK] Wrote {out_path} for {db_path}")

# Loop over all .db files
for db_path in sorted(backend_db_dir.glob("*.db")):
    out_name = f"db_{db_path.name}.mmd"
    out_path = out_dir / out_name
    make_mermaid(db_path, out_path)
PY

echo
echo "Done."
echo "Open these in VS Code with a Mermaid preview (one per DB in backend/app/data):"
ls docs/db_*.mmd 2>/dev/null || true
