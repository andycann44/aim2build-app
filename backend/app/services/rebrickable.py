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
