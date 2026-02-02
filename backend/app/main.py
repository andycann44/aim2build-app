from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path

import os
import json
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import Response

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


# -----------------------
# Global image URL resolver (JSON responses)
# -----------------------

IMG_PREFIXES = ("/static/", "/set_images/", "static/", "set_images/")
IMG_KEYS = {
    "img_url",
    "part_img_url",
    "display_img_url",
    "set_img_url",
}

def resolve_image_url(value: str) -> str:
    """
    Convert known relative image paths into absolute URLs for the R2 image domain.

    Examples:
      /static/element_images/3003/3003__5.jpg
        -> https://img.aim2build.co.uk/static/element_images/3003/3003__5.jpg

      static/element_images/3003/3003__5.jpg
        -> https://img.aim2build.co.uk/static/element_images/3003/3003__5.jpg
    """
    if not isinstance(value, str) or not value:
        return value

    # already absolute
    if value.startswith("http://") or value.startswith("https://"):
        return value

    base = os.getenv("AIM2BUILD_IMG_BASE", "https://img.aim2build.co.uk").rstrip("/")

    # normalize
    if value.startswith("static/") or value.startswith("set_images/"):
        return f"{base}/{value}"

    if value.startswith("/static/") or value.startswith("/set_images/"):
        return f"{base}{value}"

    return value


def _rewrite_images(obj):
    """
    Recursively rewrite image-ish strings in JSON payloads.
    - If a dict key is one of IMG_KEYS, rewrite its string value.
    - Also rewrite any string value that starts with known image prefixes.
    """
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if isinstance(v, str) and (k in IMG_KEYS or v.startswith(IMG_PREFIXES)):
                out[k] = resolve_image_url(v)
            else:
                out[k] = _rewrite_images(v)
        return out

    if isinstance(obj, list):
        return [_rewrite_images(x) for x in obj]

    if isinstance(obj, str) and obj.startswith(IMG_PREFIXES):
        return resolve_image_url(obj)

    return obj


class RewriteImageUrlsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        resp = await call_next(request)

        ctype = resp.headers.get("content-type", "")
        if "application/json" not in ctype:
            return resp

        body = b""
        async for chunk in resp.body_iterator:
            body += chunk

        try:
            data = json.loads(body.decode("utf-8"))
        except Exception:
            # If we can't parse JSON, return original body unchanged.
            return Response(
                content=body,
                status_code=resp.status_code,
                headers=dict(resp.headers),
                media_type=resp.media_type,
            )

        data2 = _rewrite_images(data)
        new_body = json.dumps(data2).encode("utf-8")

        headers = dict(resp.headers)
        headers["content-length"] = str(len(new_body))

        return Response(
            content=new_body,
            status_code=resp.status_code,
            headers=headers,
            media_type="application/json",
        )


app.add_middleware(RewriteImageUrlsMiddleware)


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