from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any

from app.catalog_db import get_catalog_parts_for_set

router = APIRouter()


def _normalize_set_id(raw: str) -> str:
    """
    Normalise so both '70618' and '70618-1' work.
    Actual lookup logic is in get_catalog_parts_for_set.
    """
    return (raw or "").strip()


@router.get("/parts")
def get_catalog_parts(
    set: Optional[str] = Query(
        None, description="LEGO set number (alias: set_num, id)"
    ),
    set_num: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    """
    Return the canonical part list for a given set from the SQLite catalog.

    Shape:
      [
        { "part_num": "3001", "color_id": 5, "quantity": 4 },
        ...
      ]
    """
    raw = set_num or set or id
    if not raw:
        raise HTTPException(
            status_code=400,
            detail="Provide one of set, set_num or id query parameters.",
        )

    set_id = _normalize_set_id(raw)
    parts = get_catalog_parts_for_set(set_id)

    if not parts:
        raise HTTPException(
            status_code=404,
            detail=f"No catalog parts found for set {set_id}",
        )

    return parts
