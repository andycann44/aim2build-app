from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
load_dotenv()
from app.routers import catalog, sets, my_sets, inventory
import app.routers.buildability as buildability
import app.routers.reservations as reservations
import app.routers.buildability as buildability
import app.routers.reservations as reservations
import app.routers.buildability as buildability
try:
    from app.routers import buildability  # optional future router
except Exception:
    buildability = None

# search_online lives under routers/search_online.py; import it unconditionally
from app.routers import search_online

app = FastAPI(title="Aim2Build API", version="0.2.0", redirect_slashes=False)


# Inventory API
app.include_router(inventory.router, prefix="/api/inventory", tags=["inventory"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"]
)

# Router mounts (one each)
app.include_router(catalog.router,   prefix="/api/catalog")
app.include_router(reservations.router, prefix="/api/reservations", tags=["reservations"])
app.include_router(sets.router,      prefix="/api/sets")
app.include_router(my_sets.router,   prefix="/api/my-sets")
app.include_router(search_online.router, prefix='/api/search')

# Optional buildability router: include only when present
if buildability is not None:
    app.include_router(buildability.router, prefix="/api/buildability")

@app.get("/")
def root():
    return {"msg": "Aim2Build backend is running"}
