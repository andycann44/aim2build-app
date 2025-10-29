from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import importlib
import sqlite3
from contextlib import contextmanager

def import_router(path: str):
    return importlib.import_module(path)

app = FastAPI(title="Aim2Build API", version="0.2.0")

# CORS (adjust later if you want stricter)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Simple SQLite helper used by routers
@contextmanager
def db():
    con = sqlite3.connect("aim2build.db")
    con.row_factory = sqlite3.Row
    try:
        yield con
    finally:
        con.commit()
        con.close()

# Import routers explicitly via importlib to avoid package __init__ pitfalls
sets = import_router("app.routers.sets")
inventory = import_router("app.routers.inventory")
buildability = import_router("app.routers.buildability")
lego_sync = import_router("app.routers.lego_sync")
images = import_router("app.routers.images")

# Register each router exactly once
app.include_router(sets.router,         prefix="/api/v1", tags=["sets"])
app.include_router(inventory.router,    prefix="/api/v1", tags=["inventory"])
app.include_router(buildability.router, prefix="/api/v1", tags=["buildability"])
app.include_router(lego_sync.router,    prefix="/api/v1", tags=["rebrickable"])
app.include_router(images.router,       prefix="/api/v1", tags=["images"])

@app.get("/healthz")
def healthz():
    return {"ok": True}
