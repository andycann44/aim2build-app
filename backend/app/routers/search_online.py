from fastapi import APIRouter, HTTPException, Query
from ..commands.search_online import search_online

router = APIRouter()

@router.get("/sets/search_online")
def search_sets_online(q: str = Query(..., alias="q")):
    try:
        return {"items": search_online(q)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
