from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.catalog_db import db


router = APIRouter()


def _rebuild_top_common_parts_by_color(n_per_color: int, min_set_count: int) -> None:
    with db() as con:
        cur = con.cursor()
        cur.execute("BEGIN")
        try:
            cur.execute("DROP TABLE IF EXISTS top_common_parts_by_color")
            cur.execute(
                """
                CREATE TABLE top_common_parts_by_color (
                  part_num      TEXT NOT NULL,
                  color_id      INTEGER NOT NULL,
                  total_qty     INTEGER NOT NULL,
                  set_count     INTEGER NOT NULL,
                  rank_in_color INTEGER NOT NULL,
                  updated_at    TEXT NOT NULL
                )
                """
            )
            cur.execute(
                """
                WITH part_totals AS (
                  SELECT
                    sp.part_num,
                    sp.color_id,
                    CAST(SUM(sp.qty_per_set) AS INTEGER)        AS total_qty,
                    CAST(COUNT(DISTINCT sp.set_num) AS INTEGER) AS set_count
                  FROM set_parts AS sp
                  GROUP BY sp.part_num, sp.color_id
                ),
                ranked AS (
                  SELECT
                    part_num,
                    color_id,
                    total_qty,
                    set_count,
                    ROW_NUMBER() OVER (
                      PARTITION BY color_id
                      ORDER BY set_count DESC, total_qty DESC, part_num
                    ) AS rank_in_color
                  FROM part_totals
                )
                INSERT INTO top_common_parts_by_color (
                  part_num,
                  color_id,
                  total_qty,
                  set_count,
                  rank_in_color,
                  updated_at
                )
                SELECT
                  part_num,
                  color_id,
                  total_qty,
                  set_count,
                  rank_in_color,
                  datetime('now')
                FROM ranked
                WHERE rank_in_color <= ? AND set_count >= ?
                """,
                (n_per_color, min_set_count),
            )
            cur.execute("COMMIT")
        except Exception:
            cur.execute("ROLLBACK")
            raise


@router.post("/top_common_parts_by_color/rebuild")
def rebuild_top_common_parts_by_color(
    n_per_color: int = Query(50, ge=1),
    min_set_count: int = Query(10, ge=0),
) -> Dict[str, int]:
    _rebuild_top_common_parts_by_color(n_per_color, min_set_count)
    return {"n_per_color": n_per_color, "min_set_count": min_set_count}


@router.get("/top_common_parts_by_color")
def list_top_common_parts_by_color(
    n_per_color: int = Query(50, ge=1),
    min_set_count: int = Query(10, ge=0),
    color_id: Optional[int] = Query(None),
) -> List[Dict[str, Any]]:
    with db() as con:
        row = con.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
            ("top_common_parts_by_color",),
        ).fetchone()
        if row is None:
            raise HTTPException(
                status_code=404,
                detail="top_common_parts_by_color not built",
            )

        where = "rank_in_color <= ? AND set_count >= ?"
        params: List[object] = [n_per_color, min_set_count]
        if color_id is not None:
            where += " AND color_id = ?"
            params.append(color_id)

        cur = con.execute(
            f"""
            SELECT
              part_num,
              color_id,
              total_qty,
              set_count,
              rank_in_color,
              updated_at
            FROM top_common_parts_by_color
            WHERE {where}
            ORDER BY color_id ASC, rank_in_color ASC
            """,
            params,
        )
        rows = cur.fetchall()

    return [
        {
            "part_num": r["part_num"],
            "color_id": int(r["color_id"]),
            "total_qty": int(r["total_qty"]),
            "set_count": int(r["set_count"]),
            "rank_in_color": int(r["rank_in_color"]),
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]


@router.get("/top_common_parts_by_color/stats")
def top_common_parts_by_color_stats() -> Dict[str, Any]:
    with db() as con:
        row = con.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
            ("top_common_parts_by_color",),
        ).fetchone()
        if row is None:
            raise HTTPException(
                status_code=404,
                detail="top_common_parts_by_color not built",
            )

        cur = con.execute(
            """
            SELECT
              COUNT(DISTINCT color_id) AS colors,
              COUNT(*) AS rows,
              MAX(updated_at) AS updated_at
            FROM top_common_parts_by_color
            """
        )
        stats = cur.fetchone()

    return {
        "colors": int(stats["colors"] or 0),
        "rows": int(stats["rows"] or 0),
        "updated_at": stats["updated_at"],
    }
