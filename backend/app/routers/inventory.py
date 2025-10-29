from fastapi import APIRouter

router = APIRouter()

@router.get("/inventory/ping")
def ping_inventory():
    return {"ok": True, "router": "inventory"}
