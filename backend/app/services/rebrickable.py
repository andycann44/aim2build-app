from __future__ import annotations
import os, time, json
from pathlib import Path
from typing import Dict, Any, List, Optional
import urllib.request, urllib.parse

API = "https://rebrickable.com/api/v3/lego"
PARTS_PER_PAGE = 1000
CACHE_DIR = Path(__file__).resolve().parents[1] / "data" / "parts_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)

def _key() -> str:
    k = os.getenv("REBRICKABLE_KEY") or os.getenv("A2B_REBRICKABLE_KEY") or ""
    if not k:
        raise RuntimeError("REBRICKABLE_KEY not set in environment")
    return k

def _get(url: str) -> Dict[str, Any]:
    req = urllib.request.Request(url, headers={"Authorization": f"key {_key()}"})
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))

def fetch_set_parts(set_num: str, use_cache: bool = True) -> Dict[str, Any]:
    set_num = str(set_num).strip()
    cache_file = CACHE_DIR / f"{set_num}.json"
    if use_cache and cache_file.exists():
        try:
            return json.loads(cache_file.read_text())
        except Exception:
            pass
    # fetch all pages of parts
    page = 1
    all_results: List[Dict[str, Any]] = []
    while True:
        url = f"{API}/sets/{urllib.parse.quote(set_num)}/parts/?page={page}&page_size={PARTS_PER_PAGE}"
        data = _get(url)
        results = data.get("results") or []
        all_results.extend(results)
        if not data.get("next"):
            break
        page += 1
        time.sleep(0.2)
    payload = {"set_num": set_num, "results": all_results}
    cache_file.write_text(json.dumps(payload, indent=2))
    return payload
from pathlib import Path
import os, json, urllib.request, urllib.parse

DATA_DIR  = Path(__file__).resolve().parents[2] / "data"
CACHE_DIR = DATA_DIR / "parts_cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
API_KEY   = os.getenv("REBRICKABLE_API_KEY", "")

def _canon_set_id(s: str) -> str:
    s = str(s).strip()
    return s if "-" in s else f"{s}-1"

def _http_get(url: str) -> dict:
    if not API_KEY:
        raise RuntimeError("REBRICKABLE_API_KEY missing")
    req = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Authorization": f"key {API_KEY}",   # ✅ primary
            "X-Api-Key": API_KEY,                # (kept as fallback; harmless)
        },
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode("utf-8"))
    
def fetch_set_parts_all_pages(set_id: str) -> list[dict]:
    sid = _canon_set_id(set_id)
    url = f"https://rebrickable.com/api/v3/lego/sets/{urllib.parse.quote(sid)}/parts/"
    out: list[dict] = []
    while url:
        data = _http_get(url)
        results = data.get("results") or data.get("parts") or []
        for it in results:
            if not isinstance(it, dict): 
                continue
            pn  = it.get("part_num") or (it.get("part") or {}).get("part_num")
            cid = it.get("color_id") or (it.get("color") or {}).get("id")
            qty = it.get("quantity", it.get("qty", 0))
            img = it.get("part_img_url") or (it.get("part") or {}).get("part_img_url")
            if pn and cid:
                row = {"part_num": str(pn), "color_id": int(cid), "quantity": int(qty)}
                if img: row["part_img_url"] = img
                out.append(row)
        url = data.get("next")
    return out

def ensure_cached_parts(set_id: str) -> list[dict]:
    """Read cached parts or auto-fetch + cache if missing."""
    sid = _canon_set_id(set_id)
    p = CACHE_DIR / f"{sid}.json"
    if p.exists() and p.stat().st_size > 5:
        with p.open("r", encoding="utf-8") as f:
            try:
                j = json.load(f)
                if isinstance(j, list):
                    return j
                if isinstance(j, dict):
                    return j.get("results") or j.get("parts") or []
            except Exception:
                pass
    parts = fetch_set_parts_all_pages(sid)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(parts, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(p)
    return parts