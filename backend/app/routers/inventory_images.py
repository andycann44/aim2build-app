from fastapi import APIRouter, Depends
from typing import List

from app.routers.auth import get_current_user, User
from app.routers.inventory import load_inventory_parts
from app.image_lookup import get_strict_element_image

router = APIRouter(
    prefix="/api/inventory",
    tags=["inventory-images"],
)


@router.get("/parts_with_images")
async def get_inventory_parts_with_images(
    current_user: User = Depends(get_current_user),
) -> List[dict]:
    """
    Strict inventory image endpoint.

    Rules:
      - Only use element_images/<part_num>-<color_id>.png
      - If that file does NOT exist -> part_img_url = None
      - No Rebrickable CDN fallback
      - No 'any colour' fallback
    """
    raw = load_inventory_parts(current_user.id)

    enriched: List[dict] = []
    for row in raw:
        part_num = row.get("part_num")
        color_id = row.get("color_id")
        qty_total = row.get("qty_total", 0)

        part_img_url = get_strict_element_image(part_num, color_id)

        enriched.append(
            {
                "part_num": part_num,
                "color_id": color_id,
                "qty_total": qty_total,
                "part_img_url": part_img_url,  # None if no exact file
            }
        )

    return enriched