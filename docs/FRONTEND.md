# Frontend

## Entry and Routing
- Entry point: `frontend/src/main.tsx` renders `<App />` inside `BrowserRouter`.
- App layout and routes: `frontend/src/App.tsx`.
- Sidebar navigation uses `NavLink` with routes defined in `frontend/src/App.tsx`.

## Key Routes (UI)
Defined in `frontend/src/App.tsx`:
- `/` -> `HomePage`.
- `/search` -> `SearchPage`.
- `/my-sets` -> `MySetsPage`.
- `/inventory` -> `InventoryPage`.
- `/inventory/add` -> `InventoryAddCategoriesPage`.
- `/inventory/add/bricks` and `/inventory/add/brick` -> `InventoryAddBrickPage`.
- `/inventory/pick-colour/:partNum` -> `InventoryPickColourPage`.
- `/inventory/edit` -> `InventoryEditPage`.
- `/buildability` -> `BuildabilityOverviewPage`.
- `/buildability/discover` -> `BuildabilityDiscoverPage`.
- `/buildability/:setNum` -> `BuildabilityDetailsPage`.
- `/buildability/:setNum/missing` -> `MissingPartsPage`.
- `/wishlist` -> `WishlistPage`.
- `/instructions` -> `InstructionsSearchPage`.
- `/instructions/:setNum/parts` -> `SetPartsPage`.
- `/account` -> `AccountPage`.
- `/settings` -> `SettingsPage`.
- `/reset-password` -> `ResetPasswordPage`.
- `/admin` -> `AdminPage`.
- `/debug/catalog-images` -> `DebugCatalogImagesPage` (DEV only).

## API Base and Auth
- API base is controlled in `frontend/src/api/client.ts`:
  - `API_BASE` comes from `VITE_API_BASE` but is ignored for non-local hostnames when it points to localhost.
  - All requests use `authHeaders()` from `frontend/src/utils/auth.ts`.
  - On `401`, `clearToken()` and redirect to `/login` in `frontend/src/api/client.ts`.
- Token storage and headers:
  - `frontend/src/utils/auth.ts` uses localStorage key `a2b_token` with legacy key fallbacks.

## Component Responsibilities (Selected)
- `frontend/src/components/SetTile.tsx`: set tile with add-to-inventory/wishlist/my-sets actions.
- `frontend/src/components/PartsTile.tsx`: generic part tile for inventory/buildability/missing contexts.
- `frontend/src/components/BuildabilityPartsTile.tsx`: buildability-style part tile with optional qty controls.
- `frontend/src/components/SafeImg.tsx`: image wrapper with fallback to `/branding/missing.png`.
- `frontend/src/components/PageHero.tsx`: hero component used across pages.
- `frontend/src/components/InstructionsTile.tsx`: instructions overlay tile linking to LEGO instructions.

## Buildability Details Data Flow
- `frontend/src/pages/BuildabilityDetailsPage.tsx` loads:
  - Compare data from `/api/buildability/compare`.
  - Parts grid from `/api/catalog/parts-v2`.
  - Set metadata from `/api/search?q=<setNum>`.

## Vite Dev Proxy
- `frontend/vite.config.ts` proxies:
  - `/api` -> `http://127.0.0.1:8000`.
  - `/static` -> `http://127.0.0.1:8000`.

