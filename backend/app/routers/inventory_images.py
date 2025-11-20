# backend/app/routers/inventory_images.py
from fastapi import APIRouter, Depends

from app.routers.auth import get_current_user, User
from app.routers.inventory import load_inventory_parts

router = APIRouter(prefix="/api/inventory", tags=["inventory-images"])


@router.get("/parts_with_images")
async def get_inventory_parts_with_images(
    current_user: User = Depends(get_current_user),
):
    # Load the same JSON used by the main inventory router
    raw = load_inventory_parts(current_user.id)

    enriched = []
    for row in raw:
        part_num = row.get("part_num")
        color_id = row.get("color_id")
        qty_total = row.get("qty_total", 0)

        part_img_url = (
            row.get("part_img_url")
            or row.get("img_url")
            or (
                f"https://cdn.rebrickable.com/media/parts/ldraw/{color_id}/{part_num}.png"
                if part_num and color_id is not None
                else None
            )
        )

        enriched.append(
            {
                "part_num": part_num,
                "color_id": color_id,
                "qty_total": qty_total,
                "part_img_url": part_img_url,
            }
        )

    return enriched
