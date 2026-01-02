from typing import Optional

from app.catalog_db import db  # same db helper inventory was using for element_images


def get_strict_element_image(part_num: str, color_id: int) -> Optional[str]:
    """
    STRICT image lookup using lego_catalog.db element_images table.

    Rules:
      - Look up EXACT (part_num, color_id) in element_images.
      - If no row or blank URL -> return None.
      - No fallback to other colours or parent parts.
    """
    if not part_num or color_id is None:
        return None

    with db() as con:
        cur = con.execute(
            """
            SELECT img_url
            FROM element_images
            WHERE part_num = ?
              AND color_id = ?
              AND img_url IS NOT NULL
              AND TRIM(img_url) != ''
            LIMIT 1
            """,
            (part_num, color_id),
        )
        row = cur.fetchone()

    if not row:
        return None

    return row["img_url"]