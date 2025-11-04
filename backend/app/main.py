from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()

# Core routers
from app.routers import buildability_v2, catalog, inventory_json, sets, my_sets, inventory

# Optional buildability router: import (case-flexible)
try:
    from app.routers import buildability_v2, buildability as buildability  # our compare endpoint
except Exception:
    try:
        from app.routers import buildability_v2, Buildability as buildability  # macOS-created file
    except Exception:
        buildability = None

# Search router
from app.routers import buildability_v2, search_online

app = FastAPI(title="Aim2Build API", version="0.2.4", redirect_slashes=False)


app.include_router(buildability_v2.router)
app.add_middleware(
    CORSMiddleware,
    # Allow Vite dev server and any localhost origin; fallback to * without credentials
    allow_origins=["http://127.0.0.1:5173", "http://localhost:5173", "*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

# Router mounts
app.include_router(inventory.router,    prefix="/api/inventory", tags=["inventory"])  # summary + parts
app.include_router(catalog.router,   prefix="/api/catalog")
app.include_router(sets.router,      prefix="/api/sets")
app.include_router(my_sets.router,   prefix="/api/my-sets")
app.include_router(search_online.router, prefix='/api/search')
app.include_router(inventory_json.router)  # has its own prefix

# Optional buildability router: include only when present
if buildability is not None:
    app.include_router(buildability.router, prefix="/api/buildability")

@app.get("/")
def root():
    return {"msg": "Aim2Build backend is running"}

# Health endpoints for tests and ops
@app.get("/healthz")
def healthz():
    return {"ok": True}

@app.get("/api/health")
def api_health():
    return {"ok": True}
