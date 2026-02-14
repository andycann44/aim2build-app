from contextlib import contextmanager
from pathlib import Path
import sqlite3

BASE_DIR = Path(__file__).resolve().parent
USER_DB_PATH = BASE_DIR / "data" / "aim2build_app.db"
CFG_DB_PATH  = BASE_DIR / "data" / "aim2build_config.db"

@contextmanager
def user_db():
    con = sqlite3.connect(USER_DB_PATH)
    con.row_factory = sqlite3.Row

    # attach overrides/config db as "cfg"
    # (idempotent: ignore if already attached)
    try:
        con.execute("ATTACH DATABASE ? AS cfg", (str(CFG_DB_PATH),))
    except sqlite3.OperationalError as e:
        if "already in use" not in str(e).lower():
            raise

    try:
        yield con
    finally:
        con.close()