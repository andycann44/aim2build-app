from fastapi import APIRouter, Query
from ..commands.search_online import search_online_sets

router = APIRouter()

@router.get("/sets/search_online")
def search_online(q: str = Query(..., description="Search query")):
    return {"items": search_online_sets(q)}
