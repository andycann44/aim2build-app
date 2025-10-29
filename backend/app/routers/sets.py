from fastapi import APIRouter

router = APIRouter()

@router.get("/sets/ping")
def ping_sets():
    return {"ok": True, "router": "sets"}
