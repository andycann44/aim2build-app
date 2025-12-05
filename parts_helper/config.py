# parts_helper/config.py

import os
from pathlib import Path

# Base project root (assumes this folder sits inside aim2build-app/)
PROJECT_ROOT = Path(__file__).resolve().parents[1]

# Paths to your DBs (adjust if different)
USER_DB_PATH = PROJECT_ROOT / "backend" / "app" / "data" / "aim2build_app.db"
CATALOG_DB_PATH = PROJECT_ROOT / "backend" / "app" / "data" / "lego_core_v2.db"

# Where we store per-set parts JSON
PARTS_CACHE_DIR = PROJECT_ROOT / "backend" / "app" / "data" / "parts_cache"

# Queue file for sets to harvest
HARVEST_QUEUE_PATH = PROJECT_ROOT / "backend" / "app" / "data" / "harvest_queue.txt"

# Optional wishlist JSON (existing backend file)
WISHLIST_JSON_PATH = PROJECT_ROOT / "backend" / "app" / "data" / "wishlist.json"

# Rebrickable API settings
REBRICKABLE_API_KEY = os.environ.get("REBRICKABLE_API_KEY", "")
REBRICKABLE_BASE_URL = "https://rebrickable.com/api/v3/lego"

# Safety: ensure cache dir exists
PARTS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
