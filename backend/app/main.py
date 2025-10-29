from fastapi import FastAPI
from backend.app.routers import catalog, sets, inventory

app = FastAPI(title="Aim2Build API v0.2.0", version="0.2.0")

# Mount routers
app.include_router(catalog.router, prefix="/catalog")
app.include_router(sets.router, prefix="/sets")
app.include_router(inventory.router, prefix="/inventory")

@app.get("/")
def root():
    return {"msg": "Aim2Build backend is running"}