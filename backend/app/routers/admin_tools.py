from __future__ import annotations

import os
import sqlite3
import time
import subprocess
from pathlib import Path
from typing import Optional, Any

from fastapi import APIRouter, Header, HTTPException

router = APIRouter(prefix="/api/admin", tags=["admin"])

def _need_admin_key(x_admin_key: Optional[str]) -> str:
    want = os.getenv("AIM2BUILD_ADMIN_KEY", "").strip()
    if not want:
        # Safer failure mode: admin endpoints disabled unless explicitly configured.
        raise HTTPException(status_code=503, detail="AIM2BUILD_ADMIN_KEY not configured")
    if not x_admin_key or x_admin_key.strip() != want:
        raise HTTPException(status_code=401, detail="admin key required")
    return want

def _catalog_db_path() -> Path:
    # backend/app/routers/admin_tools.py -> backend/app/data/lego_catalog.db
    here = Path(__file__).resolve()
    backend_app = here.parents[1]  # backend/app
    return backend_app / "data" / "lego_catalog.db"

def _con_catalog() -> sqlite3.Connection:
    db = _catalog_db_path()
    con = sqlite3.connect(str(db))
    con.row_factory = sqlite3.Row
    return con

@router.get("/ping")
def admin_ping(x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key")):
    _need_admin_key(x_admin_key)
    return {"ok": True, "ts": int(time.time())}

@router.get("/catalog/stats")
def admin_catalog_stats(x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key")):
    _need_admin_key(x_admin_key)
    con = _con_catalog()
    try:
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
    finally:
        con.close()

@router.get("/catalog/sample")
def admin_catalog_sample(
    mode: str = "best",          # best | raw
    filter: str = "live",        # live | dead | unchecked | all
    limit: int = 120,
    offset: int = 0,
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
):
    _need_admin_key(x_admin_key)
    limit = max(1, min(limit, 500))
    offset = max(0, offset)

    con = _con_catalog()
    try:
        if mode == "best":
            sql = """
              SELECT part_num, color_id, img_url
              FROM element_best_image
              WHERE img_url IS NOT NULL AND TRIM(img_url) <> ''
              ORDER BY part_num ASC, color_id ASC, img_url ASC
              LIMIT ? OFFSET ?
            """
            rows = con.execute(sql, (limit, offset)).fetchall()
            return [dict(r) for r in rows]

        # raw
        where = "WHERE img_url IS NOT NULL AND TRIM(img_url) <> ''"
        if filter == "live":
            where += " AND is_dead=0"
        elif filter == "dead":
            where += " AND is_dead=1"
        elif filter == "unchecked":
            where += " AND (last_checked IS NULL OR last_checked=0)"
        elif filter == "all":
            pass

        sql = f"""
          SELECT part_num, color_id, img_url, source, priority, http_status, last_checked, is_dead
          FROM element_images
          {where}
          ORDER BY part_num ASC, color_id ASC, priority ASC, COALESCE(created_at,0) DESC, img_url ASC
          LIMIT ? OFFSET ?
        """
        rows = con.execute(sql, (limit, offset)).fetchall()
        return [dict(r) for r in rows]
    finally:
        con.close()

@router.post("/catalog/rebuild-views")
def admin_catalog_rebuild_views(x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key")):
    _need_admin_key(x_admin_key)
    con = _con_catalog()
    try:
        con.executescript(
            """
            DROP VIEW IF EXISTS element_best_image;
            CREATE VIEW element_best_image AS
            SELECT e.part_num, e.color_id, e.img_url
            FROM element_images e
            JOIN (
              SELECT part_num, color_id, MIN(priority) AS best_pri
              FROM element_images
              WHERE is_dead=0 AND img_url IS NOT NULL AND TRIM(img_url) <> ''
              GROUP BY part_num, color_id
            ) b
              ON b.part_num=e.part_num AND b.color_id=e.color_id AND b.best_pri=e.priority
            JOIN (
              SELECT part_num, color_id, priority,
                     MAX(COALESCE(created_at,0)) AS best_created
              FROM element_images
              WHERE is_dead=0 AND img_url IS NOT NULL AND TRIM(img_url) <> ''
              GROUP BY part_num, color_id, priority
            ) c
              ON c.part_num=e.part_num AND c.color_id=e.color_id
             AND c.priority=e.priority AND c.best_created=COALESCE(e.created_at,0)
            WHERE e.is_dead=0
            GROUP BY e.part_num, e.color_id
            HAVING MIN(e.img_url)=e.img_url;

            DROP VIEW IF EXISTS part_best_image;
            CREATE VIEW part_best_image AS
            SELECT part_num, MIN(img_url) AS img_url
            FROM element_best_image
            GROUP BY part_num;
            """
        )
        con.commit()
        return {"ok": True}
    finally:
        con.close()

@router.post("/catalog/audit-images")
def admin_catalog_audit_images(
    only_unchecked: bool = True,
    max_rows: int = 500,
    parallel: int = 12,
    x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key"),
):
    """
    BOUNDED audit: checks up to max_rows URLs using curl (for consistent redirect/status handling).
    Designed for admin use on staging/prod without melting the box.
    """
    _need_admin_key(x_admin_key)
    max_rows = max(1, min(max_rows, 5000))
    parallel = max(1, min(parallel, 32))

    con = _con_catalog()
    try:
        where = "img_url IS NOT NULL AND TRIM(img_url)<>''"
        if only_unchecked:
            where += " AND (last_checked IS NULL OR last_checked=0)"

        rows = con.execute(
            f"""
            SELECT part_num, color_id, img_url
            FROM element_images
            WHERE {where}
            ORDER BY part_num ASC, color_id ASC, priority ASC, COALESCE(created_at,0) DESC, img_url ASC
            LIMIT ?
            """,
            (max_rows,),
        ).fetchall()

        if not rows:
            return {"ok": True, "checked": 0, "dead": 0, "live": 0, "note": "no rows to check"}

        now = int(time.time())

        # For simplicity + reliability: run curl per row, bounded by max_rows.
        dead = 0
        live = 0
        for r in rows:
            url = r["img_url"]
            # curl returns http code; 000 on error/timeout. -L follows redirects.
            try:
                cp = subprocess.run(
                    ["curl", "-s", "-L", "-o", "/dev/null", "-w", "%{http_code}", "--max-time", "12", url],
                    capture_output=True,
                    text=True,
                    check=False,
                )
                code_s = (cp.stdout or "").strip()
                code = int(code_s) if code_s.isdigit() else 0
            except Exception:
                code = 0

            is_dead = 1 if (code == 0 or code == 404 or code == 410 or code >= 400) else 0
            if is_dead:
                dead += 1
            else:
                live += 1

            con.execute(
                """
                UPDATE element_images
                SET last_checked = ?,
                    http_status = ?,
                    is_dead = ?
                WHERE part_num = ?
                  AND color_id = ?
                  AND img_url = ?
                """,
                (now, code, is_dead, r["part_num"], r["color_id"], url),
            )

        con.commit()
        return {"ok": True, "checked": len(rows), "dead": dead, "live": live, "only_unchecked": only_unchecked, "max_rows": max_rows}
    finally:
        con.close()
