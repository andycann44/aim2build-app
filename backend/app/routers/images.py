from fastapi import APIRouter

router = APIRouter()

@router.get("/images/ping")
def ping_images():
    return {"ok": True, "router": "images"}
