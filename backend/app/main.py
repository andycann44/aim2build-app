from app.routers import (
    mysets,
    wishlist,
    buildability,
    inventory,
    catalog,
    search,
    inventory_images,
)
from app.routers import auth as auth_router
from app.db import db, init_db
from app.paths import DATA_DIR
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Dict, Any

app = FastAPI(title="Aim2Build API")

# CORS (open for local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

def get_catalog_parts_for_set(set_num: str) -> List[Dict[str, Any]]:
    """
    Return canonical parts for a set from the SQLite catalog.

    Shape: [{ "part_num": "...", "color_id": 0, "quantity": 4 }, ...]
    Uses:
      inventories (inventory_id, set_num, ...)
      inventory_parts (inventory_id, part_num, color_id, quantity, ...)
    """
    set_id = (set_num or "").strip()
    if not set_id:
        return []

    # Normalise: allow "70618" or "70618-1"
    if "-" not in set_id:
        set_id = f"{set_id}-1"

    with db() as con:
        cur = con.execute(
            """
            SELECT i.set_num,
                   p.part_num,
                   p.color_id,
                   p.quantity
            FROM inventories i
            JOIN inventory_parts p
              ON p.inventory_id = i.inventory_id
            WHERE i.set_num = ?
            """,
            (set_id,),
        )
        rows = cur.fetchall()

    return [
        {
            "part_num": row["part_num"],
            "color_id": row["color_id"],
            "quantity": row["quantity"],
        }
        for row in rows
    ]

# Optional routers — included if available
def try_include_routers():
    # Buildability (compare endpoint)
    for modname in ("app.routers.buildability", "app.routers.Buildability"):
        try:
            mod = __import__(modname, fromlist=["router"])
            app.include_router(mod.router, prefix="/api/buildability", tags=["buildability"])
            break
        except Exception:
            pass

    # Catalog (shared sets/parts)
    try:
        mod = __import__("app.routers.catalog", fromlist=["router"])
        app.include_router(mod.router, prefix="/api/catalog", tags=["catalog"])
    except Exception:
        pass

try_include_routers()
init_db()

@app.get("/api/health")
def health():
    return {"ok": True}

app.include_router(inventory.router, prefix="/api/inventory")
app.include_router(inventory_images.router)  # ⬅️ no extra prefix
app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])

app.include_router(mysets.router,      prefix="/api/mysets")
app.include_router(wishlist.router,    prefix="/api/wishlist")
app.include_router(buildability.router, prefix="/api/buildability")
app.include_router(search.router,      prefix="/api")
app.include_router(catalog.router,     prefix="/api/catalog")
