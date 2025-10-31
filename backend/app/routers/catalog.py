from fastapi import APIRouter
from ..commands import import_sets

router = APIRouter()

@router.post("/catalog/import")
def catalog_import():
    return import_sets.import_all()

@router.get("/catalog/stats")
def catalog_stats():
    return {"sets": 0, "parts": 0}  # TODO: hook into DB
