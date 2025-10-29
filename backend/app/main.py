from fastapi import FastAPI
from .routers import catalog, sets

app = FastAPI()
app.include_router(catalog.router)
app.include_router(sets.router)
