from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import re

from app.catalog_db import db, get_catalog_parts_for_set

router = APIRouter()


def _resolve_part_img_url_from_db(
    con,
    part_num: str,
    color_id: int,
) -> Optional[str]:
    """
    STRICT image resolution:
    - element_images is the ONLY source of truth
    - exact (part_num, color_id) match only
    - if not found -> None
    """
    cur = con.execute(
        """
        SELECT ei.img_url
        FROM element_images ei
        WHERE ei.part_num = ?
          AND ei.color_id = ?
          AND ei.img_url IS NOT NULL
          AND TRIM(ei.img_url) <> ''
        LIMIT 1
        """,
        (part_num, color_id),
    )
    row = cur.fetchone()
    if not row:
        return None
    return row["img_url"]


def _normalize_set_id(raw: str) -> str:
    return (raw or "").strip()


@router.get("/parts")
def get_catalog_parts(
    set: Optional[str] = Query(None, description="LEGO set number (alias: set_num, id)"),
    set_num: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    raw = set_num or set or id
    if not raw:
        raise HTTPException(
            status_code=400,
            detail="Provide one of set, set_num or id query parameters.",
        )

    set_id = _normalize_set_id(raw)
    base_parts = get_catalog_parts_for_set(set_id)

    if not base_parts:
        raise HTTPException(
            status_code=404,
            detail=f"No catalog parts found for set {set_id}",
        )

    enriched: List[Dict[str, Any]] = []
    with db() as con:
        for row in base_parts:
            part_num = str(row["part_num"])
            color_id = int(row["color_id"])
            quantity = int(row["quantity"])

            img = _resolve_part_img_url_from_db(con, part_num, color_id)

            enriched.append(
                {
                    "part_num": part_num,
                    "color_id": color_id,
                    "quantity": quantity,
                    "part_img_url": img,
                }
            )

    return enriched


@router.get("/parts/search")
def search_parts(
    q: Optional[str] = Query(None, description="Search term for part_num or name"),
    category_id: Optional[int] = Query(None, description="Filter by part_cat_id"),
    color_id: Optional[int] = Query(
        None,
        description="If provided, image lookup is STRICT to that colour.",
    ),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> List[Dict[str, Any]]:
    """
    PART SEARCH (parts only, not set search)

    Search rules:
    - If q has NO spaces:
        - digits only (e.g. '3001'): treat as FAMILY prefix -> p.part_num LIKE '3001%'
          order: exact first, then short suffixes, then longer
        - otherwise: treat as PREFIX -> p.part_num LIKE '<term>%'
    - If q HAS spaces/words (e.g. 'brick 2 x 4'):
        - search by NAME tokens (AND-match) against lower(p.name)
        - ignore stopwords like brick/plate/tile/x/by/and/the/etc.
        - if dims like '2 x 4' present, require that substring too

    Image rules:
    - element_images is the ONLY truth source
    - If color_id provided: STRICT (part_num, color_id)
    - If color_id NOT provided: pick lowest available element_images.color_id
    - Sticker categories => NULL image always
    """
    term = (q or "").strip()
    if not term:
        return []

    is_digits_only = term.isdigit()
    has_spaces = any(ch.isspace() for ch in term)

    clauses: List[str] = []
    params: List[Any] = []

    if category_id is not None:
        clauses.append("p.part_cat_id = ?")
        params.append(int(category_id))

    if not has_spaces:
        clauses.append("p.part_num LIKE ?")
        params.append(f"{term}%")
    else:
        ql = term.lower().strip()

        stop = {
            "brick", "bricks", "plate", "plates", "tile", "tiles",
            "with", "and", "or", "the", "a", "an", "of",
            "x", "by",
        }

        m = re.search(r"(\d+)\s*[xX]\s*(\d+)", ql)
        dims: List[str] = []
        if m:
            a, b = m.group(1), m.group(2)
            dims.append(f"{a} x {b}")
            dims.append(f"{b} x {a}")

        raw_tokens = re.findall(r"[a-z0-9]+", ql)
        tokens = [t for t in raw_tokens if t not in stop]

        for d in dims:
            clauses.append("lower(p.name) LIKE ?")
            params.append(f"%{d}%")

        for t in tokens:
            clauses.append("lower(p.name) LIKE ?")
            params.append(f"%{t}%")

        if not dims and not tokens:
            clauses.append("lower(p.name) LIKE ?")
            params.append(f"%{ql}%")

    where_sql = " WHERE " + " AND ".join(clauses)

    order_params: List[Any] = []
    if (not has_spaces) and is_digits_only:
        order_sql = """
        ORDER BY
          CASE
            WHEN p.part_num = ? THEN 0
            WHEN LENGTH(p.part_num) = ? THEN 1
            ELSE 2
          END,
          LENGTH(p.part_num) ASC,
          p.part_num ASC
        """
        order_params.extend([term, len(term) + 1])
    else:
        order_sql = "ORDER BY p.part_num ASC"

    if color_id is not None:
        img_sql = """
        (
          SELECT ei.img_url
          FROM element_images ei
          WHERE ei.part_num = p.part_num
            AND ei.color_id = ?
            AND ei.img_url IS NOT NULL
            AND TRIM(ei.img_url) <> ''
          LIMIT 1
        )
        """
        img_params: List[Any] = [int(color_id)]
    else:
        img_sql = """
        (
          SELECT ei.img_url
          FROM element_images ei
          WHERE ei.part_num = p.part_num
            AND ei.img_url IS NOT NULL
            AND TRIM(ei.img_url) <> ''
          ORDER BY ei.color_id ASC
          LIMIT 1
        )
        """
        img_params = []

    with db() as con:
        cur = con.execute(
            f"""
            SELECT
              p.part_num,
              p.name,
              CASE
                WHEN p.part_cat_id IN (
                  SELECT part_cat_id
                  FROM part_categories
                  WHERE lower(name) LIKE '%sticker%'
                )
                THEN NULL
                ELSE {img_sql}
              END AS part_img_url,
              CASE
                WHEN p.part_cat_id IN (
                  SELECT part_cat_id
                  FROM part_categories
                  WHERE lower(name) LIKE '%sticker%'
                )
                THEN 0
                WHEN {img_sql} IS NOT NULL THEN 1
                ELSE 0
              END AS image_exists
            FROM parts p
            {where_sql}
            {order_sql}
            LIMIT ?
            OFFSET ?
            """,
            (*img_params, *img_params, *params, *order_params, min(int(limit), 100), int(offset)),
        )
        rows = cur.fetchall()

    return [
        {
            "part_num": r["part_num"],
            "name": r["name"],
            "part_img_url": r["part_img_url"],
            "image_exists": int(r["image_exists"]) if r["image_exists"] is not None else 0,
        }
        for r in rows
    ]


@router.get("/elements/by-part")
def get_elements_by_part(
    part_num: str = Query(..., description="Canonical part number (e.g. 3005 for 1x1 brick)"),
) -> List[Dict[str, Any]]:
    """
    Single-brick flow:
    - Given canonical part_num (e.g. 3005), return ONE row per colour_id.
    - Images-first ordering.
    - Source of truth for images is element_images (part_num, color_id).
    - Also returns an example element_id (useful for debugging / future expansion).
    """
    pn = (part_num or "").strip()
    if not pn:
        raise HTTPException(status_code=400, detail="part_num is required")

    with db() as con:
        cur = con.execute(
            """
            SELECT
              e.part_num AS part_num,
              e.color_id AS color_id,
              c.name     AS color_name,
              (
                SELECT ei.img_url
                FROM element_images ei
                WHERE ei.part_num = e.part_num
                  AND ei.color_id = e.color_id
                  AND ei.img_url IS NOT NULL
                  AND TRIM(ei.img_url) <> ''
                LIMIT 1
              ) AS img_url,
              MIN(e.element_id) AS element_id
            FROM elements e
            LEFT JOIN colors c
              ON c.color_id = e.color_id
            WHERE e.part_num = ?
              AND e.color_id IS NOT NULL
            GROUP BY e.part_num, e.color_id, c.name
            ORDER BY
              CASE
                WHEN (
                  SELECT ei2.img_url
                  FROM element_images ei2
                  WHERE ei2.part_num = e.part_num
                    AND ei2.color_id = e.color_id
                    AND ei2.img_url IS NOT NULL
                    AND TRIM(ei2.img_url) <> ''
                  LIMIT 1
                ) IS NOT NULL THEN 0
                ELSE 1
              END,
              LOWER(COALESCE(c.name, '')) ASC,
              e.color_id ASC
            """,
            (pn,),
        )
        rows = cur.fetchall()

    return [
        {
            "part_num": r["part_num"],
            "color_id": int(r["color_id"]) if r["color_id"] is not None else None,
            "color_name": r["color_name"],
            "img_url": r["img_url"],
            "element_id": r["element_id"],
        }
        for r in rows
    ]