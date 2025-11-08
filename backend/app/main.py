from app.routers import mysets, wishlist, buildability, inventory, catalog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="Aim2Build API")

# CORS (open for local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

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

@app.get("/api/health")
def health():
    return {"ok": True}

app.include_router(inventory.router,   prefix="/api/inventory")


app.include_router(mysets.router,   prefix="/api/mysets")
app.include_router(wishlist.router, prefix="/api/wishlist")