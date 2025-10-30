from fastapi import APIRouter
from pydantic import BaseModel
import sqlite3, os

router = APIRouter()
DB_PATH = os.environ.get("A2B_DB", "aim2build.db")

class OwnedSet(BaseModel):
    set_num: str
    name: str
    year: int
    img_url: str = ""

@router.get("/my-sets")
def list_owned_sets():
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS my_sets (set_num TEXT PRIMARY KEY, name TEXT, year INTEGER, img_url TEXT)")
    rows = cur.execute("SELECT * FROM my_sets").fetchall()
    rows = [dict(zip(["set_num", "name", "year", "img_url"], row)) for row in rows]
    con.close()
    return rows

@router.post("/my-sets")
def add_owned_set(set: OwnedSet):
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS my_sets (set_num TEXT PRIMARY KEY, name TEXT, year INTEGER, img_url TEXT)")
    cur.execute("INSERT OR REPLACE INTO my_sets (set_num, name, year, img_url) VALUES (?, ?, ?, ?)",
                (set.set_num, set.name, set.year, set.img_url))
    con.commit()
    con.close()
    return {"ok": True, "set_num": set.set_num}

@router.delete("/my-sets/{set_num}")
def delete_owned_set(set_num: str):
    con = sqlite3.connect(DB_PATH)
    cur = con.cursor()
    cur.execute("DELETE FROM my_sets WHERE set_num=?", (set_num,))
    con.commit()
    con.close()
    return {"ok": True, "deleted": set_num}