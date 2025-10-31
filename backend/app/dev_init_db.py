import sqlite3, os, sys
DB_PATH = os.environ.get("A2B_DB", "backend/app/aim2build.db")
SCHEMA = "backend/app/schema.sql"
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
con = sqlite3.connect(DB_PATH)
con.executescript(open(SCHEMA, "r", encoding="utf-8").read())
con.execute("PRAGMA journal_mode=WAL;")
con.commit()
con.close()
print(f"DB ready at {DB_PATH}")
