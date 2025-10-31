from fastapi import APIRouter
from ..commands import search, add_set

router = APIRouter()

@router.get("/search_sets")
def search_sets(q: str):
    return search.search_sets(q)

@router.post("/add_set")
def add_set_route(set_num: str):
    return add_set.add_set(set_num)
