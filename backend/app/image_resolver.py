from fastapi import APIRouter, Query
from typing import Optional, Dict
import os

router = APIRouter(tags=["images"])

def _static_base() -> str:
    return (os.getenv("A2B_STATIC_BASE_URL") or "https://img.aim2build.co.uk").rstrip("/")

def _normalize_set_id(raw: str) -> str:
    s = (raw or "").strip()
    if not s:
        return s
    return s if "-" in s else f"{s}-1"

@router.get("/set")
def resolve_set_image(
    set: str = Query(..., description="Set number, e.g. 21330 or 21330-1")
) -> Dict[str, Optional[str]]:
    set_id = _normalize_set_id(set)
    if not set_id:
        return {"set_num": None, "img_url": None}

    base = _static_base()
    return {
        "set_num": set_id,
        "img_url": f"{base}/static/set_images/{set_id}.jpg",
    }

@router.get("/element")
def resolve_element_image(
    part_num: str = Query(...),
    color_id: int = Query(...),
) -> Dict[str, Optional[str]]:
    pn = (part_num or "").strip()
    if not pn:
        return {"part_num": None, "color_id": None, "img_url": None}

    base = _static_base()
    return {
        "part_num": pn,
        "color_id": int(color_id),
        "img_url": f"{base}/static/parts/elements/{pn}__{int(color_id)}.jpg",
    }
