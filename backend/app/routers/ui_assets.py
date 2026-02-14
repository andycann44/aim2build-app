from fastapi import APIRouter
from typing import List, Dict, Any
from app.user_db import user_db

router = APIRouter(tags=["ui-assets"])

@router.get("/brick-categories")
def brick_categories() -> List[Dict[str, Any]]:
    """
    UI-only category strip. Icons are R2 URLs.
    Stored in aim2build_app.db table: brick_category_images
    """
    with user_db() as con:
        rows = con.execute(
            """
            SELECT key, label, img_url, sort_order
            FROM cfg.brick_category_images
            WHERE is_enabled = 1
            ORDER BY sort_order ASC, key ASC
            """
        ).fetchall()

    out: List[Dict[str, Any]] = []
    for r in rows:
        if hasattr(r, "keys"):
            out.append(
                {
                    "key": str(r["key"]),
                    "label": str(r["label"]),
                    "img_url": str(r["img_url"]),
                    "sort_order": int(r["sort_order"] or 0),
                }
            )
        else:
            out.append(
                {
                    "key": str(r[0]),
                    "label": str(r[1]),
                    "img_url": str(r[2]),
                    "sort_order": int(r[3] or 0),
                }
            )
    return out
