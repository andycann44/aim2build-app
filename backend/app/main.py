from typing import List, Dict, Any

from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware

from app.db import db, init_db
from app.paths import DATA_DIR

from app.routers import (
from app.routers import admin_tools
    mysets,
    wishlist,
    buildability,
    catalog,
    search,
    inventory,   # IMPORTANT: inventory router
    top_common_parts,
    top_common_parts_by_color,
)
from app.routers import buildability_discover
from app.routers import auth as auth_router
from app.routers.auth import get_current_user


app = FastAPI(title="Aim2Build API")

# -----------------------
# CORS (open for local dev)
# -----------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# -----------------------
# Catalog helper (used elsewhere)
# -----------------------
def get_catalog_parts_for_set(set_num: str) -> List[Dict[str, Any]]:
    """
    Return canonical parts for a set from the SQLite catalog.

    Shape:
      [{ "part_num": "...", "color_id": 0, "quantity": 4 }, ...]

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
            SELECT
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


# -----------------------
# Initialise DB on startup
# -----------------------
init_db()


# -----------------------
# Health (public)
# -----------------------
@app.get("/api/health")
def health():
    return {"ok": True}


# =======================
# ROUTERS
# =======================

# Auth routes (public)
app.include_router(
app.include_router(admin_tools.router)
    auth_router.router,
    prefix="/api/auth",
    tags=["auth"],
)

# -----------------------
# INVENTORY (AUTH REQUIRED)
# THIS WAS THE BUG
# -----------------------
app.include_router(
    inventory.router,
    prefix="/api/inventory",
    tags=["inventory"],
)

# -----------------------
# My Sets / Wishlist (AUTH REQUIRED)
# -----------------------
app.include_router(
    mysets.router,
    prefix="/api/mysets",
    tags=["mysets"],
    dependencies=[Depends(get_current_user)],
)

app.include_router(
    wishlist.router,
    prefix="/api/wishlist",
    tags=["wishlist"],
    dependencies=[Depends(get_current_user)],
)

# -----------------------
# Buildability / Catalog / Search
# -----------------------
app.include_router(
    buildability.router,
    prefix="/api/buildability",
    tags=["buildability"],
    dependencies=[Depends(get_current_user)],
)

app.include_router(
    search.router,
    prefix="/api",
    tags=["search"],
)

app.include_router(
    catalog.router,
    prefix="/api/catalog",
    tags=["catalog"],
)

app.include_router(
    buildability_discover.router,
    prefix="/api/buildability",
    tags=["buildability-discover"],
)