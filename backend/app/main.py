from fastapi import FastAPI
from backend.app.routers import catalog, sets, my_sets, search_online

app = FastAPI()

app.include_router(catalog.router,       prefix="/api/catalog")
app.include_router(sets.router,          prefix="/api/sets")
app.include_router(my_sets.router,       prefix="/api/my-sets")
app.include_router(search_online.router, prefix="/api/search")
