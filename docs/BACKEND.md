# Backend

## Entry Point and Server Wiring
- FastAPI app: `backend/app/main.py`.
- Static files: `/static` is mounted from `backend/app/static` via `StaticFiles`.
- CORS: wide-open for local dev in `backend/app/main.py`.
- DB initialization: `init_db()` in `backend/app/db.py` runs on startup.

## Auth
- JWT auth in `backend/app/routers/auth.py`.
- Secret and algorithm:
  - `AIM2BUILD_SECRET_KEY` (default `dev-secret-change-me`).
  - HS256 (`ALGORITHM = "HS256"`).
- Token payload includes `sub` and `exp` (see `backend/app/routers/auth.py`).
- `get_current_user()` is the shared dependency for protected routes.

## Routers (Source of Truth)
Wired in `backend/app/main.py`:
- Public:
  - `/api/auth/*` (`backend/app/routers/auth.py`).
  - `/api/search/*` (`backend/app/routers/search.py`).
  - `/api/catalog/*` (`backend/app/routers/catalog.py`).
  - `/api/top_common_parts*` and `/api/top_common_parts_by_color*` (see `backend/app/routers/top_common_parts.py` and `backend/app/routers/top_common_parts_by_color.py`).
  - `/api/health` (`backend/app/main.py`).
- Auth required (via `Depends(get_current_user)` in `backend/app/main.py`):
  - `/api/inventory/*` (`backend/app/routers/inventory.py`).
  - `/api/mysets/*` (`backend/app/routers/mysets.py`).
  - `/api/wishlist/*` (`backend/app/routers/wishlist.py`).
  - `/api/buildability/*` and `/api/buildability/discover` (`backend/app/routers/buildability.py`, `backend/app/routers/buildability_discover.py`).
- Admin key required:
  - `/api/admin/*` (`backend/app/routers/admin_tools.py`) uses `X-Admin-Key` and `AIM2BUILD_ADMIN_KEY`.

## Data Access Modules
- User DB:
  - `backend/app/db.py` (primary DB helpers + init).
  - `backend/app/user_db.py` (same DB path, used by inventory/mysets).
- Catalog DB:
  - `backend/app/catalog_db.py` provides `db()`, `get_catalog_parts_for_set`, and `get_set_num_parts`.

## Image URL Resolution
- Central resolver: `backend/app/core/image_resolver.py`.
- Used by catalog, buildability, search, mysets, inventory, and catalog DB helpers to qualify `/static/...` URLs into absolute URLs.

## Inventory Data Model
- Inventory tables are created/ensured in `backend/app/routers/inventory.py`:
  - `user_inventory_parts`, `user_inventory_sets`, `user_set_pour_lines`.
- Inventory images are resolved via `element_images` in the catalog DB with strict `(part_num, color_id)` matching.

## Wishlist
- Wishlist is stored as JSON files at `backend/app/data/wishlist_user_<id>.json` and managed in `backend/app/routers/wishlist.py`.

