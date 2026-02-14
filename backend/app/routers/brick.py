from typing import List, Dict, Any, Optional
import re

from fastapi import APIRouter, Depends, HTTPException, Query

from app.user_db import user_db
from app.catalog_db import db as catalog_db
from app.routers.auth import get_current_user, User

router = APIRouter(tags=["brick"])


@router.get("/parents")
def brick_parents(current_user: User = Depends(get_current_user)) -> List[Dict[str, Any]]:
    """
    Parent tiles from lego_catalog part_categories (parent_id IS NULL/0)
    with image overrides from aim2build_app.db brick_category_images.
    """
    with catalog_db() as con:
        cur = con.execute(
            """
            SELECT part_cat_id, name
            WHERE p.part_cat_id IN (51,55)
            ORDER BY name ASC
            """
        )
        parent_rows = cur.fetchall()

    parent_names = {
        (r["name"] if hasattr(r, "keys") else r[1]).strip().lower()
        for r in parent_rows
    }

    with user_db() as con:
        cur = con.execute(
            """
            SELECT key, label, img_url, sort_order, part_cat_id
            from cfg.brick_category_images
            WHERE part_cat_id IS NULL AND is_enabled = 1
            ORDER BY sort_order ASC, key ASC
            """
        )
        rows = cur.fetchall()

    out: List[Dict[str, Any]] = []
    for r in rows:
        if hasattr(r, "keys"):
            key = r["key"]
            label = r["label"]
            img_url = r["img_url"]
            sort_order = int(r["sort_order"] or 0)
            part_cat_id = r["part_cat_id"]
        else:
            key, label, img_url, sort_order, part_cat_id = r[0], r[1], r[2], int(r[3] or 0), r[4]

        if label and label.strip().lower() in parent_names:
            out.append(
                {
                    "key": key,
                    "label": label,
                    "img_url": img_url,
                    "sort_order": sort_order,
                    "part_cat_id": part_cat_id,
                }
            )

    return out


@router.get("/children")
def brick_children(
    parent_key: str = Query(...),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """
    Child tiles from lego_catalog part_categories, with img overrides from brick_category_images.
    """
    key = (parent_key or "").strip()
    if not key:
        raise HTTPException(status_code=422, detail="Missing parent_key")

    with user_db() as con:
        cur = con.execute(
            """
            SELECT label
            FROM cfg.brick_category_images
            WHERE key = ? AND part_cat_id IS NULL AND is_enabled = 1
            LIMIT 1
            """,
            (key,),
        )
        row = cur.fetchone()

    parent_label = row["label"] if row and hasattr(row, "keys") else (row[0] if row else None)
    if not parent_label:
        return []

    with catalog_db() as con:
        cur = con.execute(
            """
            SELECT part_cat_id
            FROM part_categories
            WHERE LOWER(name) = LOWER(?)
            LIMIT 1
            """,
            (parent_label,),
        )
        row = cur.fetchone()
        parent_id = int(row["part_cat_id"] if row and hasattr(row, "keys") else row[0]) if row else None
    if not parent_id:
        return []

    with catalog_db() as con:
        cur = con.execute(
            """
            SELECT part_cat_id, name
            FROM part_categories
            WHERE parent_id = ?
            ORDER BY name ASC
            """,
            (parent_id,),
        )
        cat_rows = cur.fetchall()

    cat_map: Dict[int, str] = {}
    for r in cat_rows:
        cat_id = int(r["part_cat_id"] if hasattr(r, "keys") else r[0])
        name = r["name"] if hasattr(r, "keys") else r[1]
        cat_map[cat_id] = name

    override_map: Dict[int, Dict[str, Any]] = {}
    with user_db() as con:
        cur = con.execute(
            """
            SELECT part_cat_id, label, img_url, sort_order
            FROM cfg.brick_category_images      
            WHERE part_cat_id IS NOT NULL AND is_enabled = 1
            """
        )
        rows = cur.fetchall()

    for r in rows:
        if hasattr(r, "keys"):
            override_map[int(r["part_cat_id"])] = {
                "label": r["label"],
                "img_url": r["img_url"],
                "sort_order": int(r["sort_order"] or 0),
            }
        else:
            override_map[int(r[0])] = {
                "label": r[1],
                "img_url": r[2],
                "sort_order": int(r[3] or 0),
            }

    out: List[Dict[str, Any]] = []
    for cat_id, name in cat_map.items():
        label = override_map.get(cat_id, {}).get("label") or name
        img_url = override_map.get(cat_id, {}).get("img_url")
        sort_order = override_map.get(cat_id, {}).get("sort_order", 0)
        out.append(
            {
                "part_cat_id": cat_id,
                "label": label,
                "img_url": img_url,
                "sort_order": int(sort_order or 0),
            }
        )

    out.sort(
        key=lambda x: (
            x["sort_order"] if x["sort_order"] else 1_000_000,
            str(x["label"]).lower(),
        )
    )
    return out


@router.get("/filters")
def brick_filters(
    parent_key: str = Query(...),
    scope_kind: str = Query("cat"),
    scope_id: int = Query(-1),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """
    Quick filter tiles from aim2build_app.db brick_quickfilter_images.
    """
    key = (parent_key or "").strip()
    if not key:
        raise HTTPException(status_code=422, detail="Missing parent_key")

    scope_kind = (scope_kind or "cat").strip().lower()
    try:
        scope_id = int(scope_id)
    except Exception:
        scope_id = -1

    with user_db() as con:
        cur = con.execute(
            """
            SELECT filter_key, label, img_url, sort_order, scope_id
            FROM cfg.brick_quickfilter_images
            WHERE key = ? AND is_enabled = 1
              AND scope_kind = ?
              AND scope_id IN (-1, ?)
            ORDER BY sort_order ASC, label ASC
            """,
            (key, scope_kind, scope_id),
        )
        rows = cur.fetchall()

    global_rows: List[Dict[str, Any]] = []
    scoped_rows: List[Dict[str, Any]] = []

    for r in rows:
        if hasattr(r, "keys"):
            entry = {
                "filter_key": r["filter_key"],
                "label": r["label"],
                "img_url": r["img_url"],
                "sort_order": int(r["sort_order"] or 0),
                "scope_id": int(r["scope_id"] or -1),
            }
        else:
            entry = {
                "filter_key": r[0],
                "label": r[1],
                "img_url": r[2],
                "sort_order": int(r[3] or 0),
                "scope_id": int(r[4] or -1),
            }

        if int(entry["scope_id"]) == -1:
            global_rows.append(entry)
        else:
            scoped_rows.append(entry)

    merged: Dict[str, Dict[str, Any]] = {}
    ordered_keys: List[str] = []

    for entry in global_rows:
        k = str(entry.get("filter_key") or "")
        if k not in merged:
            ordered_keys.append(k)
        merged[k] = entry

    for entry in scoped_rows:
        k = str(entry.get("filter_key") or "")
        if k not in merged:
            ordered_keys.append(k)
        merged[k] = entry

    out: List[Dict[str, Any]] = []
    for k in ordered_keys:
        entry = merged.get(k)
        if not entry:
            continue
        entry.pop("scope_id", None)
        out.append(entry)

    return out


def _match_filter_key(filter_key: str, name: str) -> bool:
    if not filter_key or filter_key == "all":
        return True

    s = (name or "").lower()

    # normalize "1x1" -> "1 x 1"
    fk = filter_key.lower().replace("x", " x ").strip()
    fk = re.sub(r"\s+", " ", fk)

    # match whole token, and block 1 x 10 / 1 x 12 etc
    if re.match(r"^\d+\s*x\s*\d+$", fk):
        a, b = [p.strip() for p in fk.split("x")]
        re_pat = rf"\b{re.escape(a)}\s*x\s*{re.escape(b)}\b(?!\d)"
        return re.search(re_pat, s) is not None

    return fk in s


def _normalize_size_text(value: str) -> str:
    s = (value or "").lower()
    s = re.sub(r"(\d)\s*x\s*(\d)", r"\1 x \2", s)
    s = re.sub(r"\s+", " ", s).strip()
    return s


@router.get("/parts")
def brick_parts(
    parent_key: Optional[str] = Query(None),
    child_part_cat_id: Optional[int] = Query(None),
    theme_id: Optional[int] = Query(None),
    filter_key: str = Query("all"),
    q: Optional[str] = Query(None),
    limit: int = Query(600, ge=1, le=2000),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """
    Parts list for a child category.
    - If parent_key == "minifig": child_part_cat_id REQUIRED, theme_id OPTIONAL (narrowing only).
    - If q empty: return only parts with real image AND matching filter_key.
    - If q set: allow text matches even if no image.
    """
    search = (q or "").strip().lower()
    search_norm = _normalize_size_text(search)
    filter_key = (filter_key or "all").strip().lower()
    parent_key = (parent_key or "").strip().lower()

    if child_part_cat_id is None or int(child_part_cat_id) <= 0:
        raise HTTPException(status_code=422, detail="child_part_cat_id is required")

    with catalog_db() as con:
        # minifig = special only because theme_id is optional narrowing (not required)
        if parent_key == "minifig":
            base_sql = """
                SELECT
                  p.part_num,
                  p.name AS part_name,
                  p.part_cat_id,

                  (
                    SELECT COUNT(DISTINCT ei.color_id)
                    FROM element_images ei
                    WHERE ei.part_num = p.part_num
                  ) AS color_count,

                  (
                    SELECT ei.color_id
                    FROM element_images ei
                    WHERE ei.part_num = p.part_num
                      AND ei.img_url IS NOT NULL
                      AND TRIM(ei.img_url) <> ''
                      AND ei.img_url NOT LIKE '%/static/missing.png'
                    ORDER BY RANDOM()
                    LIMIT 1
                  ) AS default_color_id,

                  (
                    SELECT ei.img_url
                    FROM element_images ei
                    WHERE ei.part_num = p.part_num
                      AND ei.img_url IS NOT NULL
                      AND TRIM(ei.img_url) <> ''
                      AND ei.img_url NOT LIKE '%/static/missing.png'
                    ORDER BY RANDOM()
                    LIMIT 1
                  ) AS default_img_url

                FROM parts p
                WHERE p.part_cat_id = ?
            """
            params: List[Any] = [int(child_part_cat_id)]

            if theme_id is not None and int(theme_id) > 0:
                base_sql += """
                  AND p.part_num IN (
                    SELECT DISTINCT sp.part_num
                    FROM set_parts sp
                    JOIN sets s ON s.set_num = sp.set_num
                    WHERE s.theme_id = ?
                  )
                """
                params.append(int(theme_id))

            base_sql += " ORDER BY p.part_num"
            cur = con.execute(base_sql, params)

        else:
            cur = con.execute(
                """
                SELECT
                  p.part_num,
                  p.name AS part_name,
                  p.part_cat_id,

                  (
                    SELECT COUNT(DISTINCT ei.color_id)
                    FROM element_images ei
                    WHERE ei.part_num = p.part_num
                  ) AS color_count,

                  (
                    SELECT ei.color_id
                    FROM element_images ei
                    WHERE ei.part_num = p.part_num
                      AND ei.img_url IS NOT NULL
                      AND TRIM(ei.img_url) <> ''
                      AND ei.img_url NOT LIKE '%/static/missing.png'
                    ORDER BY RANDOM()
                    LIMIT 1
                  ) AS default_color_id,

                  (
                    SELECT ei.img_url
                    FROM element_images ei
                    WHERE ei.part_num = p.part_num
                      AND ei.img_url IS NOT NULL
                      AND TRIM(ei.img_url) <> ''
                      AND ei.img_url NOT LIKE '%/static/missing.png'
                    ORDER BY RANDOM()
                    LIMIT 1
                  ) AS default_img_url

                FROM parts p
                WHERE p.part_cat_id = ?
                ORDER BY p.part_num
                """,
                (int(child_part_cat_id),),
            )

        rows = cur.fetchall()

    out: List[Dict[str, Any]] = []
    for r in rows:
        part_num = r["part_num"] if hasattr(r, "keys") else r[0]
        part_name = r["part_name"] if hasattr(r, "keys") else r[1]
        part_cat_id = int(r["part_cat_id"] if hasattr(r, "keys") else r[2])
        color_count = r["color_count"] if hasattr(r, "keys") else r[3]
        default_color_id = r["default_color_id"] if hasattr(r, "keys") else r[4]
        default_img_url = r["default_img_url"] if hasattr(r, "keys") else r[5]

        has_image = bool(default_img_url and str(default_img_url).strip())

        if search:
            name_norm = _normalize_size_text(part_name or "")
            matches = search in str(part_num).lower() or (search_norm and search_norm in name_norm)
            if not matches:
                continue
        else:
            if not has_image:
                continue
            if not _match_filter_key(filter_key, part_name or ""):
                continue

        out.append(
            {
                "part_num": part_num,
                "part_name": part_name,
                "part_cat_id": part_cat_id,
                "color_count": int(color_count or 0),
                "default_color_id": int(default_color_id or 0),
                "default_img_url": default_img_url,
            }
        )

    out.sort(key=lambda x: (-int(x["color_count"] or 0), str(x["part_num"])))
    return out[: int(limit)]