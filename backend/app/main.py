from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from app.db import init_db

from app.routers import (
    admin_tools,
    mysets,
    wishlist,
    buildability,
    catalog,
    search,
    inventory,
    top_common_parts,
    top_common_parts_by_color,
)
from app.routers import buildability_discover
from app.routers import auth as auth_router
from app.routers.auth import get_current_user

app = FastAPI(title="Aim2Build API")


# Serve local static assets (element_images, etc.)
STATIC_DIR = Path(__file__).resolve().parent / "static"
app.mount("/static", StaticFiles(directory=str(STATIC_DIR)), name="static")

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
    auth_router.router,
    prefix="/api/auth",
    tags=["auth"],
)

# Admin tools (key-gated, handles its own auth via X-Admin-Key)
app.include_router(admin_tools.router)

# Inventory (AUTH REQUIRED)
app.include_router(
    inventory.router,
    prefix="/api/inventory",
    tags=["inventory"],
    dependencies=[Depends(get_current_user)],
)

# My Sets (AUTH REQUIRED)
app.include_router(
    mysets.router,
    prefix="/api/mysets",
    tags=["mysets"],
    dependencies=[Depends(get_current_user)],
)

# Wishlist (AUTH REQUIRED)
app.include_router(
    wishlist.router,
    prefix="/api/wishlist",
    tags=["wishlist"],
    dependencies=[Depends(get_current_user)],
)

# Buildability (AUTH REQUIRED)
app.include_router(
    buildability.router,
    prefix="/api/buildability",
    tags=["buildability"],
    dependencies=[Depends(get_current_user)],
)

# Buildability Discover (AUTH REQUIRED if the router itself expects auth; otherwise remove this dependency inside that router)
app.include_router(
    buildability_discover.router,
    prefix="/api/buildability",
    tags=["buildability-discover"],
    dependencies=[Depends(get_current_user)],
)

# Search (public)
app.include_router(
    search.router,
    prefix="/api",
    tags=["search"],
)

# Catalog (public)
app.include_router(
    catalog.router,
    prefix="/api/catalog",
    tags=["catalog"],
)

# Optional: other public endpoints
app.include_router(
    top_common_parts.router,
    prefix="/api",
    tags=["top-common-parts"],
)
app.include_router(
    top_common_parts_by_color.router,
    prefix="/api",
    tags=["top-common-parts-by-color"],
)