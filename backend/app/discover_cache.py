from __future__ import annotations

from typing import List, Tuple
import logging

from app.catalog_db import db as catalog_db
from app.user_db import user_db

log = logging.getLogger(__name__)

# Tunables (safe defaults)
COMMON_PARTS_CUTOFF = 1000   # parts used in > N sets are ignored for candidate triggering
MIN_MATCH_PAIRS = 1          # sets must share at least N (part_num,color_id) pairs to become candidates


def bump_inventory_version(user_id: int) -> None:
    with user_db() as con:
        con.execute(
            """
            INSERT INTO USER_INVENTORY_META(user_id, inv_version, updated_at)
            VALUES(?, 1, datetime('now'))
            ON CONFLICT(user_id) DO UPDATE SET
              inv_version = inv_version + 1,
              updated_at = datetime('now')
            """,
            (user_id,),
        )
        con.commit()


def rebuild_discover_candidates(user_id: int) -> None:
    """
    Build per-user discover candidate list (set_num + match_pairs hint).
    Does NOT compute coverage. Coverage stays strict & exact at request time.
    """

    # 1) Load user inventory pairs (strict) — DB source of truth
    with user_db() as ucon:
        inv = ucon.execute(
            """
            SELECT part_num, color_id
            FROM user_inventory_parts
            WHERE user_id = ?
              AND qty > 0
              AND part_num IS NOT NULL
              AND TRIM(part_num) <> ''
            """,
            (user_id,),
        ).fetchall()

    inv_pairs: List[Tuple[str, int]] = []
    for row in inv:
        try:
            pn = str(row["part_num"]).strip()  # type: ignore[index]
            cid = int(row["color_id"])         # type: ignore[index]
        except Exception:
            pn = str(row[0]).strip()
            cid = int(row[1])
        if pn:
            inv_pairs.append((pn, cid))

    # If inventory empty, clear candidates
    if not inv_pairs:
        with user_db() as ucon:
            ucon.execute(
                "DELETE FROM USER_DISCOVER_CANDIDATES WHERE user_id = ?",
                (user_id,),
            )
            ucon.execute(
                """
                INSERT INTO USER_INVENTORY_META(user_id, inv_version, updated_at)
                VALUES(?, 0, datetime('now'))
                ON CONFLICT(user_id) DO UPDATE SET inv_version=0, updated_at=datetime('now')
                """,
                (user_id,),
            )
            ucon.commit()
        return

    # 2) Compute candidates in catalog DB
    with catalog_db() as ccon:
        ccon.execute("DROP TABLE IF EXISTS temp_inv_pairs")
        ccon.execute(
            """
            CREATE TEMP TABLE temp_inv_pairs(
              part_num TEXT NOT NULL,
              color_id INTEGER NOT NULL
            )
            """
        )
        ccon.executemany(
            "INSERT INTO temp_inv_pairs(part_num, color_id) VALUES(?, ?)",
            inv_pairs,
        )
        ccon.execute(
            "CREATE INDEX IF NOT EXISTS idx_temp_inv_pairs ON temp_inv_pairs(part_num, color_id)"
        )

        sql = f"""
        SELECT
          r.set_num AS set_num,
          COUNT(*) AS match_pairs
        FROM v_set_requirements r
        JOIN temp_inv_pairs i
          ON i.part_num = r.part_num
         AND i.color_id = r.color_id
        WHERE COALESCE(r.quantity, 0) > 0
        GROUP BY r.set_num
        HAVING COUNT(*) >= {MIN_MATCH_PAIRS}
        ORDER BY match_pairs DESC
        """

        cand = ccon.execute(sql).fetchall()

    # 3) Write into user DB (MUST COMMIT)
    with user_db() as ucon:
        ucon.execute(
            "DELETE FROM USER_DISCOVER_CANDIDATES WHERE user_id = ?",
            (user_id,),
        )
        ucon.executemany(
            """
            INSERT INTO USER_DISCOVER_CANDIDATES(user_id, set_num, match_pairs, updated_at)
            VALUES(?, ?, ?, datetime('now'))
            """,
            [(user_id, str(r[0]), int(r[1])) for r in cand],
        )
        ucon.commit()

    bump_inventory_version(user_id)


def safe_rebuild_discover_candidates(user_id: int) -> None:
    """
    Inventory writes must not fail if candidate rebuild fails.
    """
    try:
        rebuild_discover_candidates(user_id)
    except Exception:
        log.exception("discover candidate rebuild failed for user_id=%s", user_id)