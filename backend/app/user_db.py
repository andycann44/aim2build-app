from contextlib import contextmanager
from pathlib import Path
import sqlite3

BASE_DIR = Path(__file__).resolve().parent
USER_DB_PATH = BASE_DIR / "data" / "aim2build_app.db"

@contextmanager
def user_db():
    con = sqlite3.connect(USER_DB_PATH)
    con.row_factory = sqlite3.Row
    try:
        yield con
    finally:
        con.close()