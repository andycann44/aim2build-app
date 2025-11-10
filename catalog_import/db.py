from __future__ import annotations
import sqlite3
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parents[1] / "backend" / "app" / "data"
DB_PATH = DATA_DIR / "lego_catalog.db"

def _ensure_data_dir() -> None:
    DATA_DIR.mkdir(parents=True, exist_ok=True)

def db() -> sqlite3.Connection:
    """Return a SQLite connection configured like the API expects."""
    _ensure_data_dir()
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con
