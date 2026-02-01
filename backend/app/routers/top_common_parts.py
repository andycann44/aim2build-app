from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, Query

from app.catalog_db import db
from app.core.image_resolver import resolve_image_url



router = APIRouter()


def _rebuild_top_common_parts(limit: int) -> None:
    with db() as con:
        cur = con.cursor()
        cur.execute("BEGIN")
        try:
            cur.execute("DROP TABLE IF EXISTS top_common_parts")
            cur.execute(
                """
                CREATE TABLE top_common_parts (
                  part_num   TEXT NOT NULL,
                  color_id   INTEGER NOT NULL,
                  total_qty  INTEGER NOT NULL,
                  set_count  INTEGER NOT NULL,
                  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
                )
                """
            )

            insert_sql = """
                INSERT INTO top_common_parts (part_num, color_id, total_qty, set_count)
                SELECT
                  sp.part_num,
                  sp.color_id,
                  CAST(SUM(sp.qty_per_set) AS INTEGER)        AS total_qty,
                  CAST(COUNT(DISTINCT sp.set_num) AS INTEGER) AS set_count
                FROM set_parts AS sp
                GROUP BY sp.part_num, sp.color_id
                ORDER BY total_qty DESC
                LIMIT ?
            """
            cur.execute(insert_sql, (limit,))

            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_tcp_part_color
                ON top_common_parts(part_num, color_id)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_tcp_total_qty
                ON top_common_parts(total_qty DESC)
                """
            )
            cur.execute(
                """
                CREATE INDEX IF NOT EXISTS idx_tcp_set_count
                ON top_common_parts(set_count DESC)
                """
            )

            cur.execute("COMMIT")
        except Exception:
            cur.execute("ROLLBACK")
            raise


@router.post("/top_common_parts/rebuild")
def rebuild_top_common_parts(
    limit: int = Query(5000, ge=1),
) -> Dict[str, int]:
    _rebuild_top_common_parts(limit)
    return {"limit": limit}


@router.get("/top_common_parts")
def list_top_common_parts(
    limit: int = Query(200, ge=1),
) -> List[Dict[str, Any]]:
    with db() as con:
        row = con.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
            ("top_common_parts",),
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail="top_common_parts not built")

        cur = con.execute(
            """
            SELECT part_num, color_id, total_qty, set_count, updated_at
            FROM top_common_parts
            ORDER BY total_qty DESC, set_count DESC, part_num, color_id
            LIMIT ?
            """,
            (limit,),
        )
        rows = cur.fetchall()

    return [
        {
            "part_num": r["part_num"],
            "color_id": int(r["color_id"]),
            "total_qty": int(r["total_qty"]),
            "set_count": int(r["set_count"]),
            "updated_at": r["updated_at"],
        }
        for r in rows
    ]
