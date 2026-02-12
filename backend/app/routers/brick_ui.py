from fastapi import APIRouter, Depends
from typing import List, Dict, Any

from app.user_db import user_db
from app.routers.auth import get_current_user, User

router = APIRouter(tags=["brick-ui"])

@router.get("/brick-ui/categories")
def brick_ui_categories(current_user: User = Depends(get_current_user)) -> List[Dict[str, Any]]:
    # NOTE: current_user is only to keep it behind auth like the rest of inventory UI
    with user_db() as con:
        cur = con.execute(
            """
            SELECT key, label, img_url, sort_order
            FROM brick_category_images
            WHERE is_enabled = 1
            ORDER BY sort_order ASC, label ASC
            """
        )
        rows = cur.fetchall()

    out = []
    for r in rows:
        if hasattr(r, "keys"):
            out.append({"key": r["key"], "label": r["label"], "img_url": r["img_url"], "sort_order": int(r["sort_order"] or 0)})
        else:
            out.append({"key": r[0], "label": r[1], "img_url": r[2], "sort_order": int(r[3] or 0)})
    return out