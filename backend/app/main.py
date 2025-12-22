from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import auth as auth_router
from app.routers import buildability, inventory, mysets, wishlist, search, catalog, inventory_images
from app.routers import catalog_browse

app = FastAPI(title="Aim2Build API")

# CORS (local dev)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=True,
)

# Core routers
app.include_router(auth_router.router, prefix="/api/auth", tags=["auth"])
app.include_router(search.router, prefix="/api", tags=["search"])
app.include_router(mysets.router, prefix="/api", tags=["mysets"])
app.include_router(wishlist.router, prefix="/api", tags=["wishlist"])
app.include_router(inventory.router, prefix="/api", tags=["inventory"])
app.include_router(inventory_images.router, prefix="/api", tags=["inventory-images"])
app.include_router(buildability.router, prefix="/api", tags=["buildability"])
app.include_router(catalog.router, prefix="/api/catalog", tags=["catalog"])

# Browse endpoints (categories, by-category, etc.)
app.include_router(catalog_browse.router, prefix="/api/catalog", tags=["catalog-browse"])


@app.get("/api/health")
def health():
    return {"ok": True}