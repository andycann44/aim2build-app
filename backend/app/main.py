import os, sqlite3, json
from typing import Optional
from fastapi import FastAPI, HTTPException
from app.routers import images, lego_sync, buildability, catalog, inv_aggregate
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from dotenv import load_dotenv
import httpx

load_dotenv()
DB_PATH = os.getenv("A2B_DB", "data/aim2build.db")
REBRICKABLE_KEY = (os.getenv("REBRICKABLE_API_KEY") or "").strip()
os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)

def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    with db() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS owned_sets (
          set_num TEXT PRIMARY KEY,
          name TEXT,
          year INTEGER,
          img_url TEXT
        );
        CREATE TABLE IF NOT EXISTS inventory (
          part_num TEXT NOT NULL,
          color_id INTEGER,
          qty_total INTEGER NOT NULL DEFAULT 0,
          notes TEXT,
          PRIMARY KEY(part_num, color_id)
        );
        CREATE TABLE IF NOT EXISTS set_bom (
          set_num TEXT NOT NULL,
          part_num TEXT NOT NULL,
          color_id INTEGER NOT NULL,
          qty INTEGER NOT NULL,
          is_spare INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY(set_num, part_num, color_id)
        );
        """)
init_db()

from app.routers import images, lego_sync, buildability, catalog, inv_aggregate
app = FastAPI(title="Aim2Build API", version="0.2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173","http://localhost:5173","*"],
    allow_credentials=True, allow_methods=["*"], allow_headers=["*"],
)

@app.get("/api/health")
def health(): return {"ok": True}

# Owned Sets
@app.get("/api/owned_sets")
def list_owned_sets():
    with db() as con:
        rows = con.execute("SELECT set_num,name,year,img_url FROM owned_sets ORDER BY set_num").fetchall()
        return [dict(r) for r in rows]

@app.post("/api/owned_sets")
def add_owned_set(item: dict):
    set_num = (item.get("set_num") or "").strip()
    if not set_num: raise HTTPException(400, "set_num required")
    with db() as con:
        # upsert (keep name/year if provided)
        row = con.execute("SELECT set_num FROM owned_sets WHERE set_num=?", (set_num,)).fetchone()
        if row:
            con.execute("UPDATE owned_sets SET name=COALESCE(?,name),year=COALESCE(?,year),img_url=COALESCE(?,img_url) WHERE set_num=?",
                        (item.get("name"), item.get("year"), item.get("img_url"), set_num))
        else:
            con.execute("INSERT INTO owned_sets(set_num,name,year,img_url) VALUES(?,?,?,?)",
                        (set_num, item.get("name"), item.get("year"), item.get("img_url")))
        con.commit()
    return {"ok": True}

@app.delete("/api/owned_sets/{set_num}")
def delete_owned_set(set_num: str):
    with db() as con:
        con.execute("DELETE FROM owned_sets WHERE set_num=?", (set_num,))
        con.commit()
    return {"ok": True}

# Inventory (qty_total)
@app.get("/api/inventory")
def list_inventory():
    with db() as con:
        rows = con.execute("SELECT part_num,color_id,qty_total,notes FROM inventory ORDER BY part_num,color_id").fetchall()
        return [dict(r) for r in rows]

@app.post("/api/inventory")
def upsert_inventory(item: dict):
    part_num = (item.get("part_num") or "").strip()
    color_id = item.get("color_id")
    qty = int(item.get("qty", item.get("qty_total", 0)))
    if not part_num: raise HTTPException(400, "part_num required")
    with db() as con:
        row = con.execute("SELECT qty_total FROM inventory WHERE part_num=? AND IFNULL(color_id,'')=IFNULL(?, '')",
                          (part_num, color_id)).fetchone()
        if row:
            con.execute("UPDATE inventory SET qty_total=?, notes=? WHERE part_num=? AND IFNULL(color_id,'')=IFNULL(?, '')",
                        (qty, item.get("notes"), part_num, color_id))
        else:
            con.execute("INSERT INTO inventory(part_num,color_id,qty_total,notes) VALUES(?,?,?,?)",
                        (part_num, color_id, qty, item.get("notes")))
        con.commit()
    return {"ok": True}

# Search (with images)
@app.get("/api/rebrickable/search_sets")
async def search_sets(q: str):
    if not q.strip(): raise HTTPException(400, "q required")
    if not REBRICKABLE_KEY:
        return {"source":"stub","results":[
            {"set_num":"60051-1","name":"High-Speed Passenger Train","year":2014,
             "img_url":"https://cdn.rebrickable.com/media/sets/60051-1.jpg"}
        ]}
    url = "https://rebrickable.com/api/v3/lego/sets/"
    headers = {"Authorization": f"key {REBRICKABLE_KEY}"}
    params = {"search": q, "page_size": 12}
    async with httpx.AsyncClient(timeout=20.0) as client:
        r = await client.get(url, headers=headers, params=params)
        r.raise_for_status()
        data = r.json()
        out = []
        for s in data.get("results", []):
            out.append({
                "set_num": s.get("set_num"),
                "name": s.get("name"),
                "year": s.get("year"),
                "img_url": s.get("set_img_url")
            })
        return {"source":"rebrickable","results":out}

# Routers
from app.routers.lego_sync import router as lego_sync_router
from app.routers.buildability import router as buildability_router
from app.routers.images import router as images_router
app.include_router(lego_sync_router, prefix="/api/v1", tags=["rebrickable"])
app.include_router(buildability_router, prefix="/api/v1", tags=["buildability"])
app.include_router(images_router, prefix="/api/v1", tags=["images"])

app.include_router(buildability.router, prefix="/api/v1", tags=["buildability"])

app.include_router(lego_sync.router, prefix="/api/v1", tags=["rebrickable"])

app.include_router(catalog.router, prefix="/api/v1", tags=["catalog"])

app.include_router(inv_aggregate.router, prefix="/api/v1", tags=["inventory"])

app.include_router(images.router, prefix="/api/v1", tags=["images"])
