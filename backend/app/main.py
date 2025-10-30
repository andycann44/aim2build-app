from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .routers import catalog, owned_sets
try:
    from .routers import buildability  # optional future router
except Exception:
    buildability = None

app = FastAPI(title="Aim2Build API", version="0.2.0", redirect_slashes=False)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"]
)

# Router mounts (one each)
app.include_router(catalog.router,   prefix="/api/catalog")
app.include_router(my_sets.router, prefix="/api/my-sets")

if buildability is not None:
    pass  # placeholder until buildability is wired

@app.get("/")
def root():
    return {"msg": "Aim2Build backend is running"}
from .routers import search_online
app.include_router(search_online.router, prefix='/api')
