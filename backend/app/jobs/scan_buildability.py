from __future__ import annotations
import os, json, time, sys
from pathlib import Path
from typing import Dict, Any, List, Tuple

# --- Config/paths
BASE = Path(__file__).resolve().parents[1]
DATA = BASE / "data"
CATALOG = DATA / "catalog" / "sets_all.jsonl"     # one set per line
OUT = DATA / "buildability_index.json"            # final ranking
CHECKPOINT = DATA / "buildability_scan.ckpt.json" # resume state
CACHE = DATA / "buildability_cache"               # per-set results

# --- Ensure services available
sys.path.insert(0, str(BASE.parent))
from app.services.rebrickable import fetch_set_parts
# inventory parts aggregated by /api/inventory/rebuild
AGG_FILE = DATA / "inventory_parts.json"

def load_inventory_bins() -> Dict[Tuple[str,int], int]:
    if not AGG_FILE.exists():
        print(f"ERR: {AGG_FILE} missing. Run /api/inventory/rebuild first.", file=sys.stderr)
        sys.exit(2)
    rows = json.loads(AGG_FILE.read_text() or "[]")
    bins: Dict[Tuple[str,int], int] = {}
    for r in rows:
        pn = str(r.get("part_num") or "")
        cid = int(r.get("color_id") or 0)
        qty = int(r.get("qty") or 0)
        if not pn: continue
        bins[(pn, cid)] = bins.get((pn, cid), 0) + qty
    return bins

def iter_catalog() -> List[Dict[str,Any]]:
    """Read all sets from JSONL file, minimal fields."""
    if not CATALOG.exists():
        print(f"ERR: {CATALOG} missing. First sync catalog (see instructions).", file=sys.stderr)
        sys.exit(3)
    out = []
    with CATALOG.open() as f:
        for line in f:
            if not line.strip(): continue
            try:
                o = json.loads(line)
                out.append({
                    "set_num": o.get("set_num"),
                    "name": o.get("name"),
                    "year": o.get("year"),
                    "theme_id": o.get("theme_id"),
                    "num_parts": o.get("num_parts"),
                    "img_url": o.get("set_img_url") or o.get("set_url") or ""
                })
            except Exception:
                continue
    return out

def need_for_set(set_num: str) -> List[Dict[str,Any]]:
    # cached BOM to avoid re-hitting API repeatedly
    CACHE.mkdir(parents=True, exist_ok=True)
    cache_file = CACHE / f"{set_num}.json"
    if cache_file.exists():
        try:
            payload = json.loads(cache_file.read_text() or "{}")
            res = payload.get("results")
            if isinstance(res, list) and res:
                return res
        except Exception:
            pass
    payload = fetch_set_parts(set_num)  # uses API/cache layer in your project
    cache_file.write_text(json.dumps(payload))
    return payload.get("results") or []

def coverage_for_set(have_bins: Dict[Tuple[str,int],int], bom: List[Dict[str,Any]]):
    total_needed = 0
    total_have = 0
    missing = 0
    for it in bom:
        qty = int(it.get("quantity") or 0)
        part = (it.get("part") or {})
        color = (it.get("color") or {})
        pn = str(part.get("part_num") or "")
        cid = int(color.get("id") or 0)
        if not pn: continue
        have = have_bins.get((pn, cid), 0)
        use = have if have < qty else qty
        total_needed += qty
        total_have += use
        if use < qty:
            missing += 1
    cov = 0.0 if total_needed == 0 else (100.0 * float(total_have) / float(total_needed))
    return round(cov, 2), int(missing), int(total_needed), int(total_have)

def load_checkpoint() -> Dict[str,Any]:
    if CHECKPOINT.exists():
        try: return json.loads(CHECKPOINT.read_text() or "{}")
        except Exception: return {}
    return {}

def save_checkpoint(state: Dict[str,Any]):
    CHECKPOINT.parent.mkdir(parents=True, exist_ok=True)
    CHECKPOINT.write_text(json.dumps(state, indent=2))

def main(limit: int = 0, min_year: int = 0, pause: float = 0.15):
    have = load_inventory_bins()
    sets = iter_catalog()
    if min_year:
        sets = [s for s in sets if (s.get("year") or 0) >= min_year]
    if limit:
        sets = sets[:limit]
    print(f"Scanning sets: {len(sets)} (min_year={min_year}, limit={limit})")

    ck = load_checkpoint()
    done = set(ck.get("done", []))
    results = ck.get("results", [])

    # resume output into a map for overwrite/merge
    rmap = { r["set_num"]: r for r in results if r.get("set_num") }

    count = 0
    for s in sets:
        sn = s.get("set_num")
        if not sn: continue
        if sn in done:
            continue
        try:
            bom = need_for_set(sn)
            cov, miss_cnt, total_needed, total_have = coverage_for_set(have, bom)
            rmap[sn] = {
                "set_num": sn,
                "name": s.get("name") or "",
                "year": s.get("year"),
                "num_parts": s.get("num_parts"),
                "img_url": s.get("img_url") or "",
                "coverage_pct": cov,
                "missing_count": miss_cnt,
                "total_needed": total_needed,
                "total_have": total_have,
            }
        except Exception as e:
            # keep going; record as unreachable
            rmap[sn] = {
                "set_num": sn,
                "name": s.get("name") or "",
                "year": s.get("year"),
                "num_parts": s.get("num_parts"),
                "img_url": s.get("img_url") or "",
                "coverage_pct": 0.0,
                "missing_count": 0,
                "total_needed": 0,
                "total_have": 0,
                "error": str(e),
            }
        done.add(sn)
        count += 1
        if count % 10 == 0:
            # checkpoint every 10
            ck = {"done": sorted(done), "results": list(rmap.values())}
            save_checkpoint(ck)
        time.sleep(pause)

    # final write
    final = list(rmap.values())
    # sort: highest coverage first, then fewest missing, then most parts
    final.sort(key=lambda r: (-float(r.get("coverage_pct") or 0.0),
                              int(r.get("missing_count") or 0),
                              -(int(r.get("num_parts") or 0))))
    OUT.write_text(json.dumps(final, indent=2))
    CHECKPOINT.unlink(missing_ok=True)
    print(f"Done. Wrote {OUT} ({len(final)} rows).")

if __name__ == "__main__":
    # optional CLI args: limit, min_year
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=0, help="limit number of sets scanned")
    ap.add_argument("--min-year", type=int, default=0, help="only sets from this year forward")
    ap.add_argument("--pause", type=float, default=0.15, help="sleep between requests")
    args = ap.parse_args()
    main(limit=args.limit, min_year=args.min_year, pause=args.pause)
