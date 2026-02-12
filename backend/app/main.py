from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

from app.db import init_db

from app.routers import (
    ui_assets,
    admin_tools,
    mysets,
    wishlist,
    buildability,
    catalog,
    search,
    inventory,
    brick,
    top_common_parts,
    top_common_parts_by_color,
)
from app.routers import buildability_discover
from app.routers import auth as auth_router
from app.routers.auth import get_current_user
from app.image_resolver import router as image_resolver_router
from app.routers import brick_ui

app = FastAPI(title="Aim2Build API")


import os
from fastapi.responses import RedirectResponse

STATIC_BASE_URL = (os.getenv("A2B_STATIC_BASE_URL") or "").rstrip("/")

if STATIC_BASE_URL:
    @app.api_route("/static/{path:path}", methods=["GET", "HEAD"], include_in_schema=False)
    def static_redirect(path: str):
        return RedirectResponse(url=f"{STATIC_BASE_URL}/static/{path}", status_code=302)
else:
    # keep whatever local static behavior you want here (or leave disabled)
    pass
        
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

app.include_router(
    brick.router,
    prefix="/api/brick",
    tags=["brick"],
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

# UI assets (public)
app.include_router(
    ui_assets.router,
    prefix="/api/ui",
    tags=["ui-assets"],
)

# Images (public; R2-only URLs)
app.include_router(image_resolver_router, prefix="/api/images", tags=["images"])

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

# A2B_STATIC_ALWAYS_R2
@app.get("/static/{path:path}")
def a2b_static_r2(path: str):
    base = os.environ.get("A2B_STATIC_BASE_URL", "").strip().rstrip("/")
    if not base:
        # No local fallback by design.
        return RedirectResponse("/api/health", status_code=302)
    return RedirectResponse(f"{base}/{path}", status_code=302)
# Brick UI (AUTH REQUIRED)
app.include_router(
    brick_ui.router,
    prefix="/api",
    tags=["brick-ui"],
    dependencies=[Depends(get_current_user)],
)
