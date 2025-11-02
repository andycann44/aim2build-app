#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

cd ~/aim2build-app

# --- 1) Write compare endpoint (new file): backend/app/routers/buildability_compare.py
cat > backend/app/routers/buildability_compare.py <<'PY'
from fastapi import APIRouter, HTTPException, Query
from typing import Dict, List

router = APIRouter(prefix="/api/buildability", tags=["buildability"])

@router.get("/compare")
def compare_set(set_num: str = Query(..., description="e.g. 21330-1")):
    """
    Side-by-side comparison of parts needed for a set vs what we have free in inventory.
    Joins by (part_num, color_id).
    Returns: { ok, set_num, totals{need_total,have_total,missing_total,cover_pct}, rows[] }
    """
    # 1) needed parts for the set
    try:
        # expects: get_set_parts(set_num=...) -> list[{part_num,color_id,qty,part_name,color_name,img_url?...}]
        from app.routers.catalog import get_set_parts
        need_rows = get_set_parts(set_num=set_num)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"catalog lookup failed: {e}")

    # 2) free inventory parts (pooled)
    try:
        # expects: load_inventory_parts() -> list[{part_num,color_id,qty}]
        from app.services.inventory import load_inventory_parts
        have_rows = load_inventory_parts()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"inventory load failed: {e}")

    # 3) index what we have free by (pn,cid)
    have_map: Dict[tuple, int] = {}
    for r in have_rows:
        key = (r.get("part_num"), r.get("color_id"))
        have_map[key] = have_map.get(key, 0) + int(r.get("qty", 0))

    # 4) build side-by-side rows
    rows: List[dict] = []
    missing_total = 0
    have_total = 0
    need_total = 0

    for n in need_rows:
        key = (n.get("part_num"), n.get("color_id"))
        need = int(n.get("qty", 0))
        have = int(have_map.get(key, 0))
        missing = max(0, need - have)

        rows.append({
            "part_num": n.get("part_num"),
            "part_name": n.get("part_name"),
            "color_id": n.get("color_id"),
            "color_name": n.get("color_name"),
            "need": need,
            "have": have,
            "missing": missing,
            "img_url": n.get("img_url"),
        })

        need_total += need
        have_total += min(have, need)
        missing_total += missing

    cover_pct = (have_total / need_total * 100.0) if need_total else 0.0
    rows.sort(key=lambda r: (-r["missing"], r["part_num"], r["color_id"]))

    return {
        "ok": True,
        "set_num": set_num,
        "totals": {
            "need_total": need_total,
            "have_total": have_total,
            "missing_total": missing_total,
            "cover_pct": round(cover_pct, 1),
        },
        "rows": rows,
    }
PY

# --- 2) Wire router in backend/app/main.py (add import + include if missing)
MAIN=backend/app/main.py
grep -q "from app.routers import .*buildability_compare" "$MAIN" || \
  gsed -i '' '1,/^app = FastAPI/ s|^from app\.routers import \(.*\)$|from app.routers import \1, buildability_compare|' "$MAIN" 2>/dev/null || \
  sed -i '' '1,/^app = FastAPI/ s|^from app\.routers import \(.*\)$|from app.routers import \1, buildability_compare|' "$MAIN"

grep -q "include_router(buildability_compare.router" "$MAIN" || \
  awk '
    /app = FastAPI/ {print; added=0; next}
    /# Router mounts \(one each\)/ && added==0 {
      print;
      print "app.include_router(buildability_compare.router)";
      added=1; next
    }
    {print}
  ' "$MAIN" > "$MAIN.tmp" && mv "$MAIN.tmp" "$MAIN"

echo "✅ Compare endpoint added at /api/buildability/compare?set_num=21330-1"

# --- 3) Quick test command to copy/paste
echo
echo "Test it now (replace set_num as needed):"
echo 'curl -s "http://127.0.0.1:8000/api/buildability/compare?set_num=21330-1" | jq "{set:.set_num,totals:.totals, sample:(.rows|.[0:10])}"'
