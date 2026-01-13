from typing import Dict, List, Any, Set

from fastapi import APIRouter, Depends, Query

from app.catalog_db import db
from app.routers.auth import get_current_user, User
from app.routers.buildability import load_inventory_map
from app.user_db import user_db

router = APIRouter()


def _sets_has_theme_id(con) -> bool:
    try:
        row = con.execute(
            "SELECT 1 FROM pragma_table_info('sets') WHERE name = 'theme_id' LIMIT 1"
        ).fetchone()
        return row is not None
    except Exception:
        return False


def _has_table(con, table_name: str) -> bool:
    try:
        row = con.execute(
            "SELECT 1 FROM sqlite_master WHERE type='table' AND name=? LIMIT 1",
            (table_name,),
        ).fetchone()
        return row is not None
    except Exception:
        return False


def _has_set_filters(con) -> bool:
    return _has_table(con, "set_filters")


def _base_set_num(set_num: str) -> str:
    sn = (set_num or "").strip()
    if "-" in sn:
        return sn.split("-", 1)[0].strip()
    return sn


def _load_owned_set_nums(user_id: int) -> Set[str]:
    owned: Set[str] = set()
    try:
        with user_db() as con:
            cur = con.execute(
                "SELECT set_num FROM user_mysets WHERE user_id=?",
                (user_id,),
            )
            for r in cur.fetchall():
                sn = (r["set_num"] or "").strip()
                if sn:
                    owned.add(sn)
    except Exception:
        pass
    return owned


@router.get("/discover")
def discover_buildability(
    min_coverage: float = Query(0.90, ge=0.0, le=1.0),
    limit: int = Query(200, ge=1, le=5000),
    include_counts: bool = Query(False),
    include_complete: bool = Query(False),
    hide_owned: bool = Query(True),
    show_owned: bool = Query(False),  # if true, overrides hide_owned
    current_user: User = Depends(get_current_user),
) -> List[Dict[str, Any]]:
    """
    Discover sets you can (almost) build using STRICT (part_num, color_id) matching.

    Inventory source: user_inventory_parts via buildability.load_inventory_map (USER DB)
    Set BOM source: lego_catalog.db set_parts (spares excluded at import time)
    Set meta: lego_catalog.db sets
    Optional theme exclusions: lego_catalog.db theme_filters (toggle table)
    Optional set exclusions: lego_catalog.db set_filters (toggle table)

    Performance note:
    We avoid scanning *all* set_parts. We compute total_have only for sets that share
    at least one (part_num,color_id) with your inventory, and use sets.num_parts as total_needed.
    """

    inv_map = load_inventory_map(current_user.id)

    inv_values: List[str] = []
    inv_params: List[object] = []
    for (part_num, color_id), qty in inv_map.items():
        q = int(qty or 0)
        if q <= 0:
            continue
        inv_values.append("(?, ?, ?)")
        inv_params.extend([part_num, int(color_id), q])

    if inv_values:
        inv_cte = "inv(part_num, color_id, qty) AS (VALUES " + ", ".join(inv_values) + ")"
    else:
        inv_cte = (
            "inv(part_num, color_id, qty) AS "
            "(SELECT NULL AS part_num, NULL AS color_id, 0 AS qty WHERE 0)"
        )

    effective_hide_owned = bool(hide_owned) and not bool(show_owned)

    owned = _load_owned_set_nums(current_user.id) if effective_hide_owned else set()
    owned_bases = {_base_set_num(sn) for sn in owned if sn}

    with db() as con:
        has_theme_id = _sets_has_theme_id(con)
        has_theme_filters = _has_table(con, "theme_filters") if has_theme_id else False
        has_set_filters = _has_set_filters(con)

        where_bits: List[str] = []
        q_params: List[object] = list(inv_params)

        # Basic guards
        where_bits.append("total_needed > 0")
        where_bits.append("total_needed >= 50")  # auto-kill micro/junk sets
        where_bits.append("coverage >= ?")
        q_params.append(float(min_coverage))

        # default: exclude exact 100% unless include_complete
        if not include_complete:
            where_bits.append("coverage < 1.0")

        # theme filters (toggle table): if a theme_id is marked enabled=1, exclude it
        if has_theme_id and has_theme_filters:
            where_bits.append("filtered_theme_id IS NULL")

        # set filters (toggle table): if a set/base-set is marked enabled=1, exclude it
        if has_set_filters:
            where_bits.append("filtered_set_num IS NULL")

        # hide sets you already own (My Sets) INCLUDING other versions (e.g. 42141-2 when you own 42141-1)
        if owned_bases:
            placeholders = ",".join(["?"] * len(owned_bases))
            where_bits.append(f"base_set_num NOT IN ({placeholders})")
            q_params.extend(sorted(list(owned_bases)))

        where_sql = " AND ".join(where_bits) if where_bits else "1=1"

        theme_join_sql = ""
        filtered_select_sql = ""
        if has_theme_id and has_theme_filters:
            theme_join_sql = (
                "LEFT JOIN theme_filters tf "
                "ON tf.theme_id = s.theme_id AND tf.enabled = 1"
            )
            filtered_select_sql = ", tf.theme_id AS filtered_theme_id"

        set_join_sql = ""
        set_filtered_select_sql = ""
        if has_set_filters:
            # Matches either exact set_num OR base set_num (e.g. store '501' to exclude all '501-*')
            set_join_sql = (
                "LEFT JOIN set_filters sf "
                "ON sf.enabled = 1 AND ("
                " sf.set_num = s.set_num"
                " OR (CASE WHEN instr(sf.set_num,'-')>0 THEN substr(sf.set_num,1,instr(sf.set_num,'-')-1) ELSE sf.set_num END)"
                "    = (CASE WHEN instr(s.set_num,'-')>0 THEN substr(s.set_num,1,instr(s.set_num,'-')-1) ELSE s.set_num END)"
                ")"
            )
            set_filtered_select_sql = ", sf.set_num AS filtered_set_num"

        # NOTE:
        # - total_needed uses sets.num_parts (fast)
        # - total_have is computed only for sets that overlap inventory (fast-ish)
        query = f"""
            WITH {inv_cte},
            have_by_set AS (
                SELECT
                    sp.set_num AS set_num,
                    SUM(
                        CASE
                            WHEN inv.qty IS NULL THEN 0
                            WHEN inv.qty < sp.qty_per_set THEN inv.qty
                            ELSE sp.qty_per_set
                        END
                    ) AS total_have
                FROM set_parts AS sp
                JOIN inv
                  ON inv.part_num = sp.part_num
                 AND inv.color_id = sp.color_id
                GROUP BY sp.set_num
            ),
            scored AS (
                SELECT
                    s.set_num AS set_num,
                    COALESCE(s.num_parts, 0) AS total_needed,
                    COALESCE(h.total_have, 0) AS total_have,
                    CASE
                        WHEN COALESCE(s.num_parts, 0) > 0
                        THEN CAST(COALESCE(h.total_have, 0) AS REAL) / CAST(s.num_parts AS REAL)
                        ELSE 0
                    END AS coverage,
                    s.name,
                    s.year,
                    s.set_img_url AS img_url,
                    s.num_parts,
                    CASE
                        WHEN instr(s.set_num, '-') > 0
                        THEN substr(s.set_num, 1, instr(s.set_num, '-') - 1)
                        ELSE s.set_num
                    END AS base_set_num
                    {", s.theme_id AS theme_id" if has_theme_id else ""}
                    {filtered_select_sql}
                    {set_filtered_select_sql}
                FROM sets AS s
                LEFT JOIN have_by_set AS h ON h.set_num = s.set_num
                {theme_join_sql}
                {set_join_sql}
            )
            SELECT
                set_num,
                coverage,
                total_needed,
                total_have,
                name,
                year,
                img_url,
                num_parts
                {", theme_id" if has_theme_id else ""}
                ,(SELECT COUNT(*) FROM have_by_set) AS scanned_sets
            FROM scored
            WHERE {where_sql}
            ORDER BY coverage DESC, total_needed ASC, set_num
            LIMIT ?
        """

        q_params.append(int(limit))

        cur = con.execute(query, q_params)
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
        return [{"scanned_sets": scanned_sets, "returned_sets": len(results)}] + results

    return results
