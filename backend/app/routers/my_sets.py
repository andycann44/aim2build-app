import json
from pathlib import Path
from typing import List, Dict, Any
from fastapi import APIRouter

router = APIRouter()

DATA_DIR = (Path(__file__).resolve().parents[1] / "data").resolve()
MY_SETS_PATH = (DATA_DIR / "my_sets.json").resolve()
INV_SETS_PATH = (DATA_DIR / "inventory.json").resolve()


def _read_json(path: Path):
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None


def _load_my_sets() -> List[Dict[str, Any]]:
    data = _read_json(MY_SETS_PATH)
    if not data:
        return []
    if isinstance(data, dict) and "sets" in data:
        return list(data["sets"] or [])
    if isinstance(data, list):
        return data
    return []


def _load_inventory_set_nums() -> set:
    data = _read_json(INV_SETS_PATH)
    rows: List[Dict[str, Any]] = []
    if isinstance(data, dict) and "sets" in data:
        rows = data.get("sets") or []
    elif isinstance(data, list):
        rows = data
    return {str(r.get("set_num", "")).strip() for r in rows if r.get("set_num")}


@router.get("/")
def list_my_sets():
    my = _load_my_sets()
    inv = _load_inventory_set_nums()
    # annotate each row with in_inventory based on inventory.json
    out = []
    for r in my:
        row = dict(r)
        row["in_inventory"] = str(r.get("set_num", "")).strip() in inv
        out.append(row)
    return {"sets": out}