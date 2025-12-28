from fastapi import APIRouter, HTTPException, Query, Depends
from pydantic import BaseModel
from typing import Optional, List, Dict, Tuple, Set

from app.catalog_db import db, get_catalog_parts_for_set, get_set_num_parts
from app.routers.auth import get_current_user, User
from app.routers.inventory import load_inventory_parts

router = APIRouter()

# -----------------------
# Internal helpers
# -----------------------

def _load_inventory_json(user_id: int) -> List[dict]:
    """
    Load the current inventory JSON as a list of rows.

    Shape per row (canonical):
      {
        "part_num": "3001",
        "color_id": 5,
        "qty": 6,
        "part_img_url": "..."
      }
    """
    try:
        return load_inventory_parts(user_id)
    except Exception:
        # If the user file is missing or corrupt, treat as empty inventory.
        return []


def _inventory_map(rows: Optional[List[dict]] = None) -> Dict[Tuple[str, int], int]:
    """
    Build a {(part_num, color_id): qty} map from inventory rows.
    """
    if rows is None:
        rows = []

    m: Dict[Tuple[str, int], int] = {}
    for r in rows:
        part = str(r.get("part_num"))
        color = int(r.get("color_id", 0))
        qty = int(
            r.get(
                "qty",
                r.get("qty_total", r.get("quantity", 0)),
            )
        )
        m[(part, color)] = qty
    return m


def _normalize_set_id(raw: str) -> str:
    """
    Normalise a set id so both "70618" and "70618-1" work.
    """
    s = (raw or "").strip()
    if not s:
        return s
    if "-" not in s:
        return f"{s}-1"
    return s



# -----------------------
# Pydantic models
# -----------------------

class BatchCompareRequest(BaseModel):
    sets: List[str]


# -----------------------
# Endpoints
# -----------------------

@router.get("/compare")
def compare_buildability(
    set: Optional[str] = Query(None),
    set_num: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
):
    """
    Compare inventory vs a single set.

    The set can be provided as ?set=, ?set_num= or ?id=; we normalise
    "70618" to "70618-1".

    Response shape:
      {
        "set_num": "...",
        "coverage": 0.84,
        "total_needed": 1234,
        "total_have": 1040,
        "display_total": 1234,
        "missing_parts": [
          { "part_num": "...", "color_id": 5, "need": 2, "have": 1, "short": 1 }
        ]
      }
    """
    raw = set_num or set or id
    if not raw:
        raise HTTPException(
            status_code=400,
            detail="Provide one of set, set_num or id query parameters.",
        )

    set_id = _normalize_set_id(raw)

    # Get canonical parts for this set from the SQLite catalog
    parts = get_catalog_parts_for_set(set_id)
    if not parts:
        # Either the set doesn't exist in the catalog, or there are no parts
        raise HTTPException(
            status_code=404,
            detail=f"No catalog parts found for set {set_id}",
        )

    inv_rows = _load_inventory_json(current_user.id)
    inv_map = _inventory_map(inv_rows)

    total_needed = 0
    total_have = 0
    missing_parts: List[Dict[str, int]] = []

    for row in parts:
            part_num = str(row["part_num"])
            color_id = int(row["color_id"])
            need = int(row["quantity"])

            if need <= 0:
                continue
            # Strict match only (part_num, color_id)
            have = int(inv_map.get((part_num, color_id), 0))
            total_needed += need
            # cap have at need for coverage calculation
            total_have += min(have, need)

            if have < need:
                missing_parts.append(
                    {
                        "part_num": part_num,
                        "color_id": color_id,
                        "need": need,
                        "have": have,
                        "short": need - have,
                    }
                )

    coverage = float(total_have / total_needed) if total_needed > 0 else 0.0
    display_total = get_set_num_parts(set_id)

    return {
        "set_num": set_id,
        "coverage": coverage,
        "total_needed": total_needed,
        "total_have": total_have,
        "display_total": display_total,
        "missing_parts": missing_parts,
    }


@router.post("/batch_compare")
def batch_compare_buildability(
    payload: BatchCompareRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Compare inventory against multiple sets in one call.

    Request:
      { "sets": ["70618-1", "21330-1", ...] }

    Response:
      [
        { "set_num": "70618-1", "coverage": 1.0, "total_needed": 1234, "total_have": 1234 },
        ...
      ]

    Uses the same parent/child family logic as /compare.
    """
    if not payload.sets:
        return []

    inv_rows = _load_inventory_json(current_user.id)
    inv_map = _inventory_map(inv_rows)

    results: List[Dict[str, object]] = []

    with db() as con:
        for raw in payload.sets:
            set_id = _normalize_set_id(raw)
            if not set_id:
                results.append(
                    {
                        "set_num": "",
                        "coverage": 0.0,
                        "total_needed": 0,
                        "total_have": 0,
                    }
                )
                continue

            parts = get_catalog_parts_for_set(set_id)
            if not parts:
                # Set not in catalog
                results.append(
                    {
                        "set_num": set_id,
                        "coverage": 0.0,
                        "total_needed": 0,
                        "total_have": 0,
                    }
                )
                continue

            total_needed = 0
            total_have = 0

            for row in parts:
                part_num = str(row["part_num"])
                color_id = int(row["color_id"])
                need = int(row["quantity"])

                if need <= 0:
                    continue
                have = int(inv_map.get((part_num, color_id), 0))
                total_needed += need
                total_have += min(have, need)

            coverage = float(total_have / total_needed) if total_needed > 0 else 0.0

            results.append(
                {
                    "set_num": set_id,
                    "coverage": coverage,
                    "total_needed": total_needed,
                    "total_have": total_have,
                }
            )

    return results


# Backwards-compatible helper retained for any older code that imports it.
def load_inventory_map(user_id: int) -> Dict[Tuple[str, int], int]:
    """
    Legacy helper kept for backwards compatibility.

    Returns a {(part_num, color_id): qty_total} map using the same logic
    as _inventory_map().
    """
    return _inventory_map(_load_inventory_json(user_id))