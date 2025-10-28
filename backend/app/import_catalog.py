import os, csv, sqlite3, sys
from typing import Tuple

DB_PATH = os.environ.get("A2B_DB", "backend/app/aim2build.db")
DATA_DIR = os.environ.get("A2B_DATA", "backend/data/rebrickable")

SETS_CSV = os.path.join(DATA_DIR, "sets.csv")
PARTS_CSV = os.path.join(DATA_DIR, "parts.csv")
COLORS_CSV = os.path.join(DATA_DIR, "colors.csv")
INVENTORIES_CSV = os.path.join(DATA_DIR, "inventories.csv")
INVENTORY_PARTS_CSV = os.path.join(DATA_DIR, "inventory_parts.csv")

def _con() -> sqlite3.Connection:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA journal_mode=WAL;")
    con.execute("PRAGMA synchronous=OFF;")
    return con

def _file_ok(p: str) -> bool:
    return os.path.isfile(p) and os.path.getsize(p) > 0

def _require_files():
    missing = [p for p in (SETS_CSV, PARTS_CSV, COLORS_CSV, INVENTORIES_CSV, INVENTORY_PARTS_CSV) if not _file_ok(p)]
    if missing:
        raise FileNotFoundError(f"Missing CSVs: {', '.join(missing)}")

def _exec_script(con: sqlite3.Connection, path: str):
    with open(path, "r", encoding="utf-8") as f:
        con.executescript(f.read())

def _load_csv(con: sqlite3.Connection, path: str, cols: Tuple[str, ...], sql: str, chunk: int = 5000):
    with open(path, newline="", encoding="utf-8") as f:
        r = csv.DictReader(f)
        buf = []
        for row in r:
            vals = []
            for c in cols:
                v = row[c]
                # ints where appropriate
                if c in ("year","id","version","color_id","quantity","is_spare"):
                    v = int(v) if v != "" else None
                vals.append(v)
            buf.append(tuple(vals))
            if len(buf) >= chunk:
                con.executemany(sql, buf); con.commit(); buf.clear()
        if buf:
            con.executemany(sql, buf); con.commit()

def derive_set_parts(con: sqlite3.Connection):
    con.executescript("""
    DELETE FROM set_parts;
    WITH latest_inv AS (
      SELECT set_num, MAX(version) AS max_ver FROM inventories GROUP BY set_num
    ),
    chosen AS (
      SELECT i.id AS inventory_id, i.set_num
      FROM inventories i
      JOIN latest_inv l ON l.set_num = i.set_num AND l.max_ver = i.version
    )
    INSERT INTO set_parts(set_num, part_num, color_id, qty_per_set)
    SELECT c.set_num, ip.part_num, ip.color_id, SUM(ip.quantity) AS qty
    FROM inventory_parts ip
    JOIN chosen c ON c.inventory_id = ip.inventory_id
    WHERE ip.is_spare = 0
    GROUP BY c.set_num, ip.part_num, ip.color_id;
    """)

def import_all() -> dict:
    _require_files()
    con = _con()
    # ensure schema exists
    schema_path = "backend/app/schema.sql"
    if os.path.isfile(schema_path):
        _exec_script(con, schema_path)

    # staging + reference
    _load_csv(con, SETS_CSV,   ("set_num","name","year"),                "INSERT OR REPLACE INTO sets(set_num,name,year) VALUES (?,?,?)")
    _load_csv(con, PARTS_CSV,  ("part_num","name"),                      "INSERT OR REPLACE INTO parts(part_num,name) VALUES (?,?)")
    _load_csv(con, COLORS_CSV, ("id","name"),                            "INSERT OR REPLACE INTO colors(color_id,name) VALUES (?,?)")
    _load_csv(con, INVENTORIES_CSV,     ("id","version","set_num"),      "INSERT OR REPLACE INTO inventories(id,version,set_num) VALUES (?,?,?)")
    _load_csv(con, INVENTORY_PARTS_CSV, ("inventory_id","part_num","color_id","quantity","is_spare"),
                                      "INSERT OR REPLACE INTO inventory_parts(inventory_id,part_num,color_id,quantity,is_spare) VALUES (?,?,?,?,?)")
    derive_set_parts(con)
    con.commit()

    # stats
    stats = {}
    for name, sql in [
        ("sets", "SELECT COUNT(*) FROM sets"),
        ("parts", "SELECT COUNT(*) FROM parts"),
        ("colors", "SELECT COUNT(*) FROM colors"),
        ("inventories", "SELECT COUNT(*) FROM inventories"),
        ("inventory_parts", "SELECT COUNT(*) FROM inventory_parts"),
        ("set_parts", "SELECT COUNT(*) FROM set_parts"),
    ]:
        stats[name] = con.execute(sql).fetchone()[0]
    con.close()
    return stats

if __name__ == "__main__":
    try:
        out = import_all()
        print("OK", out)
    except Exception as e:
        print("ERROR:", e)
        sys.exit(1)
