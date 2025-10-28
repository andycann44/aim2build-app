import os, sqlite3, requests
from fastapi import APIRouter, HTTPException
from dotenv import load_dotenv, find_dotenv
load_dotenv(find_dotenv())

router = APIRouter()
DB = os.getenv("A2B_DB", "data/aim2build.db")
os.makedirs(os.path.dirname(DB), exist_ok=True)

def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys=ON")
    con.execute("""
    CREATE TABLE IF NOT EXISTS set_bom(
      set_num  TEXT NOT NULL,
      part_num TEXT NOT NULL,
      color_id INTEGER NOT NULL,
      qty      INTEGER NOT NULL,
      is_spare INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (set_num,part_num,color_id)
    )
    """)
    return con

def fetch_bom(set_num: str, key: str):
    url = f"https://rebrickable.com/api/v3/lego/sets/{set_num}/parts/?page_size=1000"
    hdr = {"Authorization": f"key {key}"}
    agg = {}
    while url:
        r = requests.get(url, headers=hdr, timeout=30)
        if r.status_code == 401:
            raise HTTPException(401, "Rebrickable 401 (invalid API key)")
        if r.status_code != 200:
            raise HTTPException(r.status_code, f"Rebrickable error: {r.text[:200]}")
        j = r.json()
        for row in j.get("results", []):
            if row.get("is_spare"):  # ignore spares
                continue
            p = row["part"]["part_num"]
            c = int(row["color"]["id"])
            q = int(row["quantity"])
            agg[(p,c)] = agg.get((p,c), 0) + q
        url = j.get("next")
    if not agg:
        raise HTTPException(404, f"No parts returned for {set_num}")
    return [(set_num, p, c, q, 0) for (p,c), q in agg.items()]

@router.post("/sync/rebrickable/sets/{set_num}")
def sync_set(set_num: str):
    key = (os.getenv("REBRICKABLE_API_KEY") or "").strip()
    if not key:
        raise HTTPException(500, "REBRICKABLE_API_KEY not set (backend/.env)")
    rows = fetch_bom(set_num, key)
    with db() as con:
        con.execute("DELETE FROM set_bom WHERE set_num=?", (set_num,))
        con.executemany(
            "INSERT INTO set_bom (set_num,part_num,color_id,qty,is_spare) VALUES (?,?,?,?,?)",
            rows
        )
        con.commit()
    return {"ok": True, "set_num": set_num, "rows": len(rows)}
