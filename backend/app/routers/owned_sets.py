from fastapi import APIRouter
import sqlite3
from backend.app.config import DB_PATH

router = APIRouter()  # mounted under /api in main.py

@router.get("/owned-sets")
def list_owned_sets():
    con = sqlite3.connect(DB_PATH); cur = con.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS owned_sets (set_num TEXT PRIMARY KEY, name TEXT, year INTEGER, img_url TEXT)")
    cur.execute("SELECT set_num, name, year, img_url FROM owned_sets ORDER BY year DESC")
    rows = [{"set_num": r[0], "name": r[1], "year": r[2], "img_url": r[3]} for r in cur.fetchall()]
    con.close()
    return rows

@router.post("/owned-sets")
def add_owned_set(set_num: str, name: str, year: int, img_url: str = ""):
    con = sqlite3.connect(DB_PATH); cur = con.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS owned_sets (set_num TEXT PRIMARY KEY, name TEXT, year INTEGER, img_url TEXT)")
    cur.execute("INSERT OR REPLACE INTO owned_sets (set_num, name, year, img_url) VALUES (?,?,?,?)",
                (set_num, name, year, img_url))
    con.commit(); con.close()
    return {"ok": True, "set_num": set_num}

@router.delete("/owned-sets/{set_num}")
def delete_owned_set(set_num: str):
    con = sqlite3.connect(DB_PATH); cur = con.cursor()
    cur.execute("DELETE FROM owned_sets WHERE set_num=?", (set_num,))
    con.commit(); con.close()
    return {"ok": True, "deleted": set_num}
