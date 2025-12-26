# parts_helper/harvester.py

import time
import json
from pathlib import Path
from typing import Dict, Any, List, Set, Optional

import requests

from config import (
    PARTS_CACHE_DIR,
    HARVEST_QUEUE_PATH,
    REBRICKABLE_API_KEY,
    REBRICKABLE_BASE_URL,
)


SLEEP_BETWEEN_SETS = 1.0  # seconds
SLEEP_ON_EMPTY_QUEUE = 10.0  # seconds
MAX_PAGES = 100  # safety cap


def load_queue() -> List[str]:
    if not HARVEST_QUEUE_PATH.exists():
        return []
    lines = [line.strip() for line in HARVEST_QUEUE_PATH.read_text().splitlines()]
    return [line for line in lines if line]


def save_queue(set_nums: List[str]) -> None:
    content = "\n".join(set_nums) + ("\n" if set_nums else "")
    HARVEST_QUEUE_PATH.write_text(content)


def parts_cache_path_for_set(set_num: str) -> Path:
    return PARTS_CACHE_DIR / f"{set_num}.json"


def has_parts_cache(set_num: str) -> bool:
    return parts_cache_path_for_set(set_num).exists()


def fetch_parts_from_rebrickable(set_num: str) -> Optional[List[Dict[str, Any]]]:
    if not REBRICKABLE_API_KEY:
        print("[harvester] REBRICKABLE_API_KEY not set; cannot fetch.")
        return None

    print(f"[harvester] Fetching parts for set {set_num} from Rebrickable")

    endpoint = f"{REBRICKABLE_BASE_URL}/sets/{set_num}/parts/"
    all_results: List[Dict[str, Any]] = []
    page = 1

    while True:
        params = {
            "key": REBRICKABLE_API_KEY,
            "page": page,
            "page_size": 1000,
        }
        resp = requests.get(endpoint, params=params, timeout=30)
        if resp.status_code != 200:
            print(f"[harvester] Error {resp.status_code} for {set_num}: {resp.text}")
            return None

        data = resp.json()
        results = data.get("results", [])
        all_results.extend(results)

        next_url = data.get("next")
        if not next_url:
            break

        page += 1
        if page > MAX_PAGES:
            print(f"[harvester] Too many pages for {set_num}, aborting.")
            break

        time.sleep(0.3)

    parts: List[Dict[str, Any]] = []

    for item in all_results:
        # Rebrickable part structure (simplified):
        # THIS IS JSON
        # {
        #   "id": 123,
        #   "inv_part_id": 456,
        #   "part": {
        #     "part_num": "3001",
        #     "name": "Brick 2 x 4",
        #     "part_img_url": "https://..."
        #   },
        #   "color": {
        #     "id": 5,
        #     "name": "Red"
        #   },
        #   "quantity": 2,
        #   "is_spare": false
        # }
        is_spare = item.get("is_spare", False)
        if is_spare:
            continue

        part = item.get("part") or {}
        color = item.get("color") or {}

        part_num = part.get("part_num")
        color_id = color.get("id")
        quantity = item.get("quantity", 0)
        img_url = part.get("part_img_url")

        if not part_num or color_id is None or quantity <= 0:
            continue

        parts.append(
            {
                "part_num": str(part_num),
                "color_id": int(color_id),
                "quantity": int(quantity),
                "part_img_url": img_url,
            }
        )

    print(f"[harvester] Set {set_num}: {len(parts)} non-spare parts")
    return parts


def save_parts_cache(set_num: str, parts: List[Dict[str, Any]]) -> None:
    path = parts_cache_path_for_set(set_num)
    # THIS IS JSON
    # [
    #   {
    #     "part_num": "3001",
    #     "color_id": 5,
    #     "quantity": 2,
    #     "part_img_url": "https://..."
    #   }
    # ]
    path.write_text(json.dumps(parts, indent=2))
    print(f"[harvester] Wrote cache: {path}")


def process_one(set_num: str) -> bool:
    """Process a single set. Returns True if done (success or already cached)."""
    if has_parts_cache(set_num):
        print(f"[harvester] Cache exists for {set_num}, skipping.")
        return True

    parts = fetch_parts_from_rebrickable(set_num)
    if parts is None:
        print(f"[harvester] Failed to fetch parts for {set_num}")
        return False

    save_parts_cache(set_num, parts)
    return True


def main_loop() -> None:
    print("[harvester] Starting main loop")

    while True:
        queue = load_queue()
        if not queue:
            print(f"[harvester] Queue empty; sleeping {SLEEP_ON_EMPTY_QUEUE} s")
            time.sleep(SLEEP_ON_EMPTY_QUEUE)
            continue

        print(f"[harvester] Queue size: {len(queue)}")
        remaining: List[str] = []

        for set_num in queue:
            ok = process_one(set_num)
            if not ok:
                # Leave in queue for retry later
                remaining.append(set_num)
            time.sleep(SLEEP_BETWEEN_SETS)

        save_queue(remaining)


if __name__ == "__main__":
    main_loop()
