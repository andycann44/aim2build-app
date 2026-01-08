from typing import Dict, Tuple, List, Any

from fastapi import APIRouter, Depends, Query

from app.catalog_db import db
from app.routers.auth import get_current_user, User
from app.routers.buildability import load_inventory_map

router = APIRouter()


@router.get("/discover")
def discover_buildability(
    min_coverage: float = Query(1.0, ge=0.0, le=1.0),
    limit: int = Query(200, ge=1, le=5000),
    include_counts: bool = Query(False),
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """
    Discover sets you can build using STRICT (part_num, color_id) matching.

    Inventory source: user_inventory_parts via buildability.load_inventory_map (USER DB)
    Set BOM source: lego_catalog.db set_parts (derived from inventories->inventory_parts, spares excluded)
    Set meta: lego_catalog.db sets (NOTE: set image column is set_img_url)
    """

    inv_map = load_inventory_map(current_user.id)

    inv_values: List[str] = []
    params: List[object] = []
    for (part_num, color_id), qty in inv_map.items():
        inv_values.append("(?, ?, ?)")
        params.extend([part_num, color_id, int(qty)])

    if inv_values:
        inv_cte = "inv(part_num, color_id, qty) AS (VALUES " + ", ".join(inv_values) + ")"
    else:
        inv_cte = (
            "inv(part_num, color_id, qty) AS "
            "(SELECT NULL AS part_num, NULL AS color_id, 0 AS qty WHERE 0)"
        )

    # IMPORTANT:
    # - set_parts columns: (set_num, part_num, color_id, qty_per_set) (created by import_csv.py)
    # - sets image column in your DB is set_img_url (NOT img_url)
    query = f"""
        WITH {inv_cte},
        set_totals AS (
            SELECT
                sp.set_num AS set_num,
                SUM(sp.qty_per_set) AS total_needed,
                SUM(
                    CASE
                        WHEN inv.qty IS NULL THEN 0
                        WHEN inv.qty < sp.qty_per_set THEN inv.qty
                        ELSE sp.qty_per_set
                    END
                ) AS total_have
            FROM set_parts AS sp
            LEFT JOIN inv
              ON inv.part_num = sp.part_num
             AND inv.color_id = sp.color_id
            GROUP BY sp.set_num
        ),
        scored AS (
            SELECT
                st.set_num,
                st.total_needed,
                st.total_have,
                CASE
                    WHEN st.total_needed > 0
                    THEN CAST(st.total_have AS REAL) / st.total_needed
                    ELSE 0
                END AS coverage,
                s.name,
                s.year,
                s.set_img_url AS img_url,
                s.num_parts
            FROM set_totals AS st
            LEFT JOIN sets AS s ON s.set_num = st.set_num
        )
        SELECT
            set_num,
            coverage,
            total_needed,
            total_have,
            name,
            year,
            img_url,
            num_parts,
            (SELECT COUNT(*) FROM set_totals) AS scanned_sets
        FROM scored
        WHERE coverage >= ?
        ORDER BY coverage DESC, total_needed DESC, set_num
        LIMIT ?
    """

    params.extend([min_coverage, limit])

    with db() as con:
        cur = con.execute(query, params)
        rows = cur.fetchall()

    results: List[Dict[str, Any]] = []
    scanned_sets = None

    for row in rows:
        if scanned_sets is None:
            try:
                scanned_sets = int(row["scanned_sets"])
            except Exception:
                scanned_sets = None

        item: Dict[str, Any] = {
            "set_num": row["set_num"],
            "coverage": float(row["coverage"] or 0),
            "total_needed": int(row["total_needed"] or 0),
            "total_have": int(row["total_have"] or 0),
        }
        if row["name"] is not None:
            item["name"] = row["name"]
        if row["year"] is not None:
            item["year"] = int(row["year"])
        if row["img_url"] is not None:
            item["img_url"] = row["img_url"]
        if row["num_parts"] is not None:
            item["num_parts"] = int(row["num_parts"])
        results.append(item)

    if include_counts and scanned_sets is not None:
        # lightweight “log” without spamming stdout
        return [{"scanned_sets": scanned_sets, "returned_sets": len(results)}] + results

    return results