import os, json
from pathlib import Path
from datetime import datetime
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter()

def _store_path() -> Path:
    # Default: backend/app/data/my_sets.json  (override with env A2B_MYSETS_PATH)
    env = os.getenv("A2B_MYSETS_PATH")
    p = Path(env) if env else Path(__file__).resolve().parents[1] / "data" / "my_sets.json"
    p.parent.mkdir(parents=True, exist_ok=True)
    return p

def _backup_dir() -> Path:
    d = _store_path().parent / "backups"
    d.mkdir(parents=True, exist_ok=True)
    return d

def _load_sets():
    """Load all saved sets from durable file storage."""
    p = _store_path()
    if not p.exists():
        return []
    try:
        with p.open("r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, dict) and "sets" in data:
            return list(data.get("sets") or [])
        if isinstance(data, list):
            return data
        return []
    except Exception:
        return []

def _save_sets(sets: list):
    """Save all sets to durable file storage (with backup)."""
    p = _store_path()
    if p.exists():
        ts = datetime.now().strftime("%Y%m%d-%H%M%S")
        try:
            prev = p.read_text(encoding="utf-8")
            (_backup_dir() / f"my_sets-{ts}.json").write_text(prev, encoding="utf-8")
        except Exception:
            pass
    tmp = p.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as f:
        json.dump({"sets": sets}, f, ensure_ascii=False, indent=2)
    tmp.replace(p)



@router.get("/")
def list_my_sets():
    return _load_sets()

@router.post("/")
def add_set(payload: dict):
    row = _normalize_set(payload)
    rows = _load_sets()
    if any(r.get("set_num") == row["set_num"] for r in rows):
        raise HTTPException(status_code=400, detail="Set already exists")
    rows.append(row)
    _save_sets(rows)
    return {"message": "Set added", "set": row}

@router.delete("/{set_num}")
def remove_set(set_num: str):
    rows = _load_sets()
    new_rows = [r for r in rows if r.get("set_num") != set_num]
    if len(new_rows) == len(rows):
        raise HTTPException(status_code=404, detail="Set not found")
    _save_sets(new_rows)
    return {"message": "Set removed", "set_num": set_num}

@router.get("/export")
def export_my_sets():
    """Return all saved sets for backup/export."""
    return {"sets": _load_sets()}

@router.post("/import")
def import_my_sets(payload: dict):
    """Import (restore) sets from a previous export."""
    rows = payload.get("sets")
    if not isinstance(rows, list):
        raise HTTPException(status_code=422, detail="Invalid payload")
    _save_sets(rows)
    return {"ok": True, "count": len(rows)}

def _normalize_set(payload: dict) -> dict:
    """Accept raw search JSON and map it to canonical fields."""
    if not isinstance(payload, dict):
        raise HTTPException(status_code=422, detail="Invalid payload")
    set_num   = payload.get("set_num") or payload.get("set") or payload.get("id")
    name      = payload.get("name") or payload.get("set_name") or ""
    year      = payload.get("year") or payload.get("release_year") or 0
    img_url   = (payload.get("img_url")
                 or payload.get("set_img_url")
                 or payload.get("img")
                 or payload.get("image")
                 or "")
    num_parts = payload.get("num_parts") or payload.get("parts") or payload.get("total_parts")
    if not set_num:
        raise HTTPException(status_code=422, detail="set_num required")
    return {
        "set_num": str(set_num),
        "name": str(name),
        "year": int(year) if isinstance(year, int) or (isinstance(year, str) and year.isdigit()) else 0,
        "img_url": str(img_url),
        "num_parts": int(num_parts) if isinstance(num_parts, int) or (isinstance(num_parts, str) and num_parts.isdigit()) else None,
    }
