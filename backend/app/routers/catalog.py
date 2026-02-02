from __future__ import annotations
from pathlib import Path
import sqlite3

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import re

from app.catalog_db import db, get_catalog_parts_for_set


from app.core.image_resolver import resolve_image_url
router = APIRouter(tags=["catalog"])

def _is_printed_part_num(part_num: str) -> bool:
    # Rebrickable-style printed variants often contain 'pr' (e.g. 11477pr0028)
    return isinstance(part_num, str) and ("pr" in part_num)

def _base_part_num_for_printed(part_num: str) -> str:
    # 11477pr0028 -> 11477
    if not isinstance(part_num, str):
        return part_num
    m = re.match(r"^(\d+)", part_num)
    return m.group(1) if m else part_num

def _img_lookup_map(db, keys):
    # keys: set of (part_num, color_id)
    # returns dict[(part_num,color_id)] = img_url
    if not keys:
        return {}
    part_nums = sorted({k[0] for k in keys})
    # Query by part_num only, then filter by color_id in python
    q_marks = ",".join(["?"] * len(part_nums))
    rows = db.execute(
        f"SELECT part_num, color_id, img_url FROM element_images WHERE part_num IN ({q_marks})",
        part_nums,
    ).fetchall()
    out = {}
    for r in rows:
        out[(str(r["part_num"]), int(r["color_id"]))] = str(r["img_url"])
    return out


def _resolve_part_img_url_from_db(
    con,
    part_num: str,
    color_id: int,
) -> Optional[str]:
    """
    STRICT image resolution:
    - element_best_image / element_images are our DB truth (NOT Rebrickable HTTP)
    - exact (part_num, color_id) match only
    - if not found -> None
    """
    cur = con.execute(
        """
        SELECT bi.img_url
        FROM element_best_image bi
        WHERE bi.part_num = ?
          AND bi.color_id = ?
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


@router.get("/part-categories")
def list_part_categories(parent_id: Optional[int] = Query(None)) -> List[Dict[str, Any]]:
    """
    List part categories filtered by parent_id.
    - parent_id omitted => top-level (parent_id IS NULL)
    - parent_id provided => children of that parent
    """
    with db() as con:
        if parent_id is None:
            cur = con.execute(
                """
                SELECT part_cat_id, name, parent_id
                FROM part_categories
                WHERE parent_id IS NULL
                ORDER BY name
                """
            )
        else:
            cur = con.execute(
                """
                SELECT part_cat_id, name, parent_id
                FROM part_categories
                WHERE parent_id = ?
                ORDER BY name
                """,
                (int(parent_id),),
            )
        rows = cur.fetchall()

    return [
        {
            "part_cat_id": int(r["part_cat_id"]),
            "name": r["name"],
            "parent_id": r["parent_id"],
        }
        for r in rows
    ]


@router.get("/part-categories/{part_cat_id:int}")
def get_part_category(part_cat_id: int) -> Dict[str, Any]:
    """
    Return a single part category row (for breadcrumb/back navigation).
    """
    with db() as con:
        cur = con.execute(
            """
            SELECT part_cat_id, name, parent_id
            FROM part_categories
            WHERE part_cat_id = ?
            LIMIT 1
            """,
            (int(part_cat_id),),
        )
        row = cur.fetchone()

    if not row:
        raise HTTPException(status_code=404, detail="Category not found")

    return {
        "part_cat_id": int(row["part_cat_id"]),
        "name": row["name"],
        "parent_id": row["parent_id"],
    }


@router.get("/part-categories/top")
def list_top_part_categories() -> List[Dict[str, Any]]:
    """
    Return top-level categories (parent_id IS NULL) excluding Duplo/Quatro/Primo.
    Also include a sample_img_url (element_images only).
    """
    with db() as con:
        cur = con.execute(
            """
            SELECT part_cat_id, name, parent_id
            FROM part_categories
            WHERE parent_id IS NULL
              AND lower(name) NOT LIKE '%duplo%'
              AND lower(name) NOT LIKE '%quatro%'
              AND lower(name) NOT LIKE '%primo%'
            ORDER BY name
            """
        )
        top_rows = cur.fetchall()

        out: List[Dict[str, Any]] = []
        for row in top_rows:
            cat_id = int(row["part_cat_id"])

            img_cur = con.execute(
                """
                WITH RECURSIVE cats(id) AS (
                  SELECT part_cat_id FROM part_categories WHERE part_cat_id = ?
                  UNION ALL
                  SELECT pc.part_cat_id
                  FROM part_categories pc
                  JOIN cats c ON pc.parent_id = c.id
                )
                SELECT ei.img_url
                FROM parts p
                JOIN cats c ON p.part_cat_id = c.id
                JOIN element_images ei ON ei.part_num = p.part_num
                WHERE ei.img_url IS NOT NULL
                  AND TRIM(ei.img_url) <> ''
                ORDER BY p.part_num ASC
                LIMIT 1
                """,
                (cat_id,),
            )
            img_row = img_cur.fetchone()
            sample_img = img_row["img_url"] if img_row else None

            out.append(
                {
                    "part_cat_id": cat_id,
                    "name": row["name"],
                    "parent_id": row["parent_id"],
                    "sample_img_url": sample_img,
                }
            )

    return out


@router.get("/parts/by-category")
def parts_by_category(
    category_id: int = Query(..., description="part_cat_id to browse (includes descendants)"),
    limit: int = Query(500, ge=1, le=1000),
    offset: int = Query(0, ge=0),
) -> List[Dict[str, Any]]:
    """
    Return parts for a category and all its descendants.
    Images are strict from element_images (any colour, exact part_num match).
    """
    with db() as con:
        cur = con.execute(
            """
            WITH RECURSIVE cats(id) AS (
              SELECT part_cat_id FROM part_categories WHERE part_cat_id = ?
              UNION ALL
              SELECT pc.part_cat_id
              FROM part_categories pc
              JOIN cats c ON pc.parent_id = c.id
            )
            SELECT
              p.part_num,
              p.name AS part_name,
              p.part_cat_id,
              (
                SELECT ei.img_url
                FROM element_images ei
                WHERE ei.part_num = p.part_num
                  AND ei.img_url IS NOT NULL
                  AND TRIM(ei.img_url) <> ''
                ORDER BY
                  CASE WHEN ei.color_id = 0 THEN 1 ELSE 0 END,
                  ei.color_id
                LIMIT 1
              ) AS part_img_url
            FROM parts p
            WHERE p.part_cat_id IN (SELECT id FROM cats)
            ORDER BY p.part_num
            LIMIT ? OFFSET ?
            """,
            (int(category_id), int(limit), int(offset)),
        )
        rows = cur.fetchall()

    return [
        {
            "part_num": r["part_num"],
            "part_name": r["part_name"],
            "part_cat_id": r["part_cat_id"],
            "part_img_url": r["part_img_url"],
        }
        for r in rows
    ]


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
            qty = int(row["quantity"])

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
    color_id: Optional[int] = Query(None, description="If provided, image lookup is STRICT to that colour."),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
) -> List[Dict[str, Any]]:
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
        stop = {"brick", "bricks", "plate", "plates", "tile", "tiles", "with", "and", "or", "the", "a", "an", "of", "x", "by"}

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


@router.get("/images/stats")
def catalog_image_stats():
    with db() as con:
        row = con.execute(
            """
            SELECT
              COUNT(*) AS total,
              SUM(is_dead=1) AS dead,
              SUM(is_dead=0) AS live,
              SUM(last_checked IS NULL OR last_checked=0) AS unchecked
            FROM element_images
            """
        ).fetchone()
        return dict(row) if row else {"total": 0, "dead": 0, "live": 0, "unchecked": 0}


@router.get("/images/sample")
def catalog_image_sample(
    mode: str = "best",          # best | raw
    filter: str = "live",        # live | dead | unchecked | all
    limit: int = 100,
    offset: int = 0,
):
    with db() as con:
        if mode == "best":
            base = """
            SELECT part_num, color_id, img_url
            FROM element_best_image
            """
            where = ""
            params: List[Any] = []
        else:
            base = """
            SELECT part_num, color_id, img_url
            FROM element_images
            """
            where = "WHERE img_url IS NOT NULL AND TRIM(img_url) <> ''"
            params = []

            if filter == "live":
                where += " AND is_dead=0"
            elif filter == "dead":
                where += " AND is_dead=1"
            elif filter == "unchecked":
                where += " AND (last_checked IS NULL OR last_checked=0)"
            elif filter == "all":
                pass

        sql = f"""
        {base}
        {where}
        ORDER BY part_num ASC, color_id ASC, img_url ASC
        LIMIT ? OFFSET ?
        """
        rows = con.execute(sql, (int(limit), int(offset), *params)).fetchall()
        return [dict(r) for r in rows]


# ------------------------------------------------------------
# V2: BuildabilityDetails-safe parts endpoint (local images only)
# - No remote URLs
# - display_img_url resolves to /static/element_images/<part>/<color>.jpg if present
# - Printed variants (..pr....) fall back to base part image for display only
# ------------------------------------------------------------

@router.get("/parts-v2")
def get_parts_v2(
    set: Optional[str] = Query(None),
    set_num: Optional[str] = Query(None),
    id: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    """
    Buildability-details parts endpoint.

    Fixes:
    - DEDUPE: uses get_catalog_parts_for_set() (canonical requirements) to avoid repeated rows.
    - IMAGES: resolves DB img_url via resolve_image_url() so UI hits img.aim2build.co.uk (R2).
    - STRICT: no printed-to-base fallback (printed part_nums are distinct).
    """
    raw = set_num or set or id
    if not raw:
        return []

    set_id = _normalize_set_id(raw)

    base_parts = get_catalog_parts_for_set(set_id)
    if not base_parts:
        raise HTTPException(status_code=404, detail=f"No catalog parts found for set {set_id}")

    out: List[Dict[str, Any]] = []

    with db() as con:
        for row in base_parts:
            pn = str(row["part_num"])
            cid = int(row["color_id"])
            qty = int(row["quantity"])

            raw_img = _resolve_part_img_url_from_db(con, pn, cid)
            img = resolve_image_url(raw_img) if raw_img else None

            out.append(
                {
                    "set_num": set_id,
                    "part_num": pn,
                    "color_id": cid,
                    "quantity": qty,
                    # both fields for compatibility
                    "part_img_url": img,
                    "display_img_url": img,
                    "is_printed": bool(_is_printed_part_num(pn)),
                    "is_sticker": False,
                }
            )

    return out

