# Aim2Build State of Union

Last updated: based on current repository state and runtime wiring in `backend/app/main.py`.

## Architecture Snapshot
- Backend: FastAPI app in `backend/app/main.py` with router wiring for auth, inventory, mysets, wishlist, buildability, buildability_discover, catalog, search, and admin tools. Static assets are mounted at `/static` from `backend/app/static`.
- Frontend: React + Vite app in `frontend/src/main.tsx` and `frontend/src/App.tsx` using React Router. API calls are centralized in `frontend/src/api/client.ts`.
- Databases:
  - Catalog DB: `backend/app/data/lego_catalog.db`, opened via `backend/app/catalog_db.py` and used across catalog, search, buildability, and inventory.
  - User DB: `backend/app/data/aim2build_app.db`, opened via `backend/app/db.py` and `backend/app/user_db.py` for auth, inventory, and mysets. Wishlist is file-backed JSON in `backend/app/data/wishlist_user_<id>.json`.

## Source-of-Truth Wiring (Backend)
- Router wiring and auth enforcement live in `backend/app/main.py`:
  - `/api/auth` is public.
  - `/api/inventory`, `/api/mysets`, `/api/wishlist`, `/api/buildability`, and `/api/buildability/discover` require auth via `Depends(get_current_user)`.
  - `/api/catalog` and `/api/search` are public.
  - `/api/admin/*` is key-gated via `X-Admin-Key` in `backend/app/routers/admin_tools.py`.

## Buildability (Strict Part Matching)
- Buildability compare uses strict `(part_num, color_id)` matching with catalog parts from `backend/app/catalog_db.py:get_catalog_parts_for_set` and inventory from `backend/app/routers/inventory.py`.
- Missing part images are enriched from `element_images` in `backend/app/routers/buildability.py` and then wrapped with `resolve_image_url`.
- Frontend buildability details (`frontend/src/pages/BuildabilityDetailsPage.tsx`) currently loads parts via `/api/catalog/parts-v2` and displays them using `frontend/src/components/BuildabilityPartsTile.tsx`.

## Image Pipeline (Single Contract)
- Backend normalizes image URLs with `resolve_image_url` in `backend/app/core/image_resolver.py`.
- Static local images are served from `backend/app/static/element_images/<part_num>/<color_id>.*` and exposed under `/static/...`.
- Frontend image fallback is handled by `frontend/src/components/SafeImg.tsx`, which defaults to `/branding/missing.png` if the URL is missing or broken.

## Known Inconsistencies (Evidence-based)
- `backend/requirements.txt` does not list `fastapi` or `PyJWT`, but the backend imports them in `backend/app/main.py` and `backend/app/routers/auth.py`.
- There are multiple catalog DB backups in `backend/app/data`, but the active code path uses only `backend/app/data/lego_catalog.db` via `backend/app/catalog_db.py`.
- Some endpoints use `element_images` for part images, while `/api/catalog/parts-v2` performs a filesystem check in `backend/app/routers/catalog.py` (no DB lookup in that path).

