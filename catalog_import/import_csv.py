import importlib
import os
from pathlib import Path

try:
    from .db import DB_PATH, db
except ImportError:  # allow running as a script (python csv/import_csv.py)
    import importlib.util

    _spec = importlib.util.spec_from_file_location("csv_db", Path(__file__).with_name("db.py"))
    if _spec is None or _spec.loader is None:  # pragma: no cover - defensive guard
        raise
    _db_module = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_db_module)
    DB_PATH = _db_module.DB_PATH
    db = _db_module.db

csv_module = importlib.import_module("csv")


def import_catalog(dir_path: str):
    dir_path = os.path.abspath(os.path.expanduser(dir_path))
    required = ["sets.csv", "parts.csv", "colors.csv", "inventories.csv", "inventory_parts.csv"]
    for filename in required:
        if not os.path.isfile(os.path.join(dir_path, filename)):
            raise FileNotFoundError(f"Missing {filename} in {dir_path}")

    schema_path = Path(__file__).with_name("schema.sql")
    if not schema_path.exists():
        raise FileNotFoundError(f"Missing schema definition at {schema_path}")

    with db() as con:
        con.executescript(schema_path.read_text())

    def load(table, cols, fname, conv=lambda row: row):
        fp = os.path.join(dir_path, fname)
        inserted = 0
        rows = []
        with db() as con, open(fp, newline="", encoding="utf-8") as fh:
            reader = csv_module.DictReader(fh)
            for raw in reader:
                row = conv(raw)
                rows.append(tuple(row[col] for col in cols))
                if len(rows) >= 1000:
                    con.executemany(
                        f"INSERT OR REPLACE INTO {table} ({','.join(cols)}) VALUES ({','.join(['?'] * len(cols))})",
                        rows,
                    )
                    inserted += len(rows)
                    rows = []
            if rows:
                con.executemany(
                    f"INSERT OR REPLACE INTO {table} ({','.join(cols)}) VALUES ({','.join(['?'] * len(cols))})",
                    rows,
                )
                inserted += len(rows)
        return inserted

    sets_inserted = load(
        "sets",
        ["set_num", "name", "year", "theme_id", "num_parts"],
        "sets.csv",
        lambda r: {
            "set_num": r["set_num"],
            "name": r["name"],
            "year": int(r.get("year") or 0),
            "theme_id": int(r.get("theme_id") or 0),
            "num_parts": int(r.get("num_parts") or 0),
        },
    )
    parts_inserted = load(
        "parts",
        ["part_num", "name", "part_cat_id"],
        "parts.csv",
        lambda r: {
            "part_num": r["part_num"],
            "name": r["name"],
            "part_cat_id": int(r.get("part_cat_id") or 0),
        },
    )
    colors_inserted = load(
        "colors",
        ["color_id", "name", "rgb", "is_trans"],
        "colors.csv",
        lambda r: {
            "color_id": int(r.get("id") or r.get("color_id")),
            "name": r["name"],
            "rgb": r.get("rgb") or "",
            "is_trans": int(r.get("is_trans") or 0),
        },
    )
    inventories_inserted = load(
        "inventories",
        ["id", "version", "set_num"],
        "inventories.csv",
        lambda r: {"id": int(r["id"]), "version": int(r.get("version") or 1), "set_num": r["set_num"]},
    )
    inventory_parts_inserted = load(
        "inventory_parts",
        ["inventory_id", "part_num", "color_id", "quantity", "is_spare"],
        "inventory_parts.csv",
        lambda r: {
            "inventory_id": int(r["inventory_id"]),
            "part_num": r["part_num"],
            "color_id": int(r.get("color_id") or 0),
            "quantity": int(r.get("qty") or 0),
            "is_spare": int(r.get("is_spare") or 0),
        },
    )

    with db() as con:
        con.execute("DELETE FROM set_parts")
        con.execute(
            """
              INSERT INTO set_parts(set_num, part_num, color_id, qty_per_set)
              SELECT i.set_num, ip.part_num, ip.color_id, SUM(ip.quantity)
              FROM inventories i
              JOIN inventory_parts ip ON ip.inventory_id = i.id
              WHERE ip.is_spare = 0
              GROUP BY i.set_num, ip.part_num, ip.color_id
            """
        )
        set_parts_count = con.execute("SELECT COUNT(*) AS n FROM set_parts").fetchone()["n"]

    return {
        "ok": True,
        "inserted": {
            "sets": sets_inserted,
            "parts": parts_inserted,
            "colors": colors_inserted,
            "inventories": inventories_inserted,
            "inventory_parts": inventory_parts_inserted,
        },
        "set_parts": set_parts_count,
        "dir": dir_path,
        "db_path": str(DB_PATH),
    }


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Import the Rebrickable CSV catalog into the local SQLite DB")
    parser.add_argument("csv_dir", help="Directory containing the catalog CSV exports")
    args = parser.parse_args()

    result = import_catalog(args.csv_dir)
    print(f"Imported catalog into {result['db_path']} from {result['dir']}")
    print("Inserted rows:")
    for table, count in result["inserted"].items():
        print(f"  {table}: {count}")
    print(f"set_parts: {result['set_parts']}")
