/// <reference types="vite/client" />
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import RequireAuth from "../components/RequireAuth";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import { searchParts, API_BASE } from "../api/client";
import { authHeaders } from "../utils/auth";

type PartSummary = {
  part_num: string;
  part_name?: string | null;
  part_img_url?: string | null;

  // If the part has exactly one element colour, cache it here so the part tile can be actionable.
  default_color_id?: number | null;
  default_color_name?: string | null;
  default_img_url?: string | null;
};

const BRICK_SIZES: { label: string; part_num: string }[] = [
  { label: "1 × 1", part_num: "3005" },
  { label: "1 × 2", part_num: "3004" },
  { label: "1 × 3", part_num: "3622" },
  { label: "1 × 4", part_num: "3010" },
  { label: "2 × 2", part_num: "3003" },
  { label: "2 × 3", part_num: "3002" },
  { label: "2 × 4", part_num: "3001" },
];

const key = (part: string, color: number) => `${part}::${color}`;

async function fetchElementsByPart(partNum: string) {
  // NOTE: we only use this to detect single-colour parts.
  const res = await fetch(
    `${API_BASE}/api/catalog/elements/by-part?part_num=${encodeURIComponent(partNum)}`,
    { headers: { ...authHeaders() } }
  );
  if (!res.ok) throw new Error("Failed to load colours");
  return res.json();
}

async function fetchPartsByCategory(categoryId: number): Promise<PartSummary[]> {
  const res = await fetch(
    `${API_BASE}/api/catalog/parts/by-category?category_id=${encodeURIComponent(categoryId)}`,
    { headers: { ...authHeaders() } }
  );
  if (!res.ok) throw new Error("Failed to load parts for category");
  const data = await res.json();
  return (data || []).map((row: any) => ({
    part_num: String(row.part_num ?? ""),
    part_name: row.part_name ?? null,
    part_img_url: row.part_img_url ?? null,
  }));
}

async function postAddCanonical(part_num: string, color_id: number, qty: number) {
  const res = await fetch(`${API_BASE}/api/inventory/add-canonical`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ part_num, color_id, qty }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(
      msg
        ? `Error adding part: ${res.status} – ${msg}`
        : `Error adding part: ${res.status}`
    );
  }
  return res.json().catch(() => null);
}

async function postDecCanonical(part_num: string, color_id: number, qty: number) {
  // NOTE: inventory router expects "qty" (not "delta") in your other code paths.
  const res = await fetch(`${API_BASE}/api/inventory/decrement-canonical`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ part_num, color_id, qty }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(
      msg
        ? `Error decrementing part: ${res.status} – ${msg}`
        : `Error decrementing part: ${res.status}`
    );
  }
  return res.json().catch(() => null);
}

/**
 * If a part has exactly ONE element colour, cache it on the part so the part tile can show:
 * - real color_id
 * - real element image
 * - qty adjuster (since it's not ambiguous)
 */
async function hydratePartsWithSingleColour(parts: PartSummary[]): Promise<PartSummary[]> {
  const out = await Promise.all(
    parts.map(async (p) => {
      try {
        const els = await fetchElementsByPart(p.part_num);
        if (Array.isArray(els) && els.length === 1) {
          const only = els[0];
          const cid = Number(only.color_id ?? 0);
          const img = (only.part_img_url ?? only.img_url ?? null) as string | null;
          const cname = (only.color_name ?? null) as string | null;

          return {
            ...p,
            default_color_id: Number.isFinite(cid) ? cid : null,
            default_color_name: cname,
            default_img_url: img,
          };
        }
      } catch {
        // ignore per-part failures
      }
      return { ...p, default_color_id: null, default_color_name: null, default_img_url: null };
    })
  );

  return out;
}

const InventoryAddBrickInner: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const categoryIdParam = qs.get("category_id");
  const categoryId = categoryIdParam ? Number(categoryIdParam) : undefined;

  const [term, setTerm] = useState("");
  const [categoryParts, setCategoryParts] = useState<PartSummary[]>([]);
  const [searchPartsList, setSearchPartsList] = useState<PartSummary[]>([]);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [owned, setOwned] = useState<Record<string, number>>({});

  const orderParts = useCallback((parts: PartSummary[]) => {
    const withImg = parts.filter((p) => !!(p.part_img_url ?? "").toString().trim());
    const noImg = parts.filter((p) => !(p.part_img_url ?? "").toString().trim());
    return [...withImg, ...noImg];
  }, []);

  const loadInventory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/canonical-parts`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const k = key(String(row.part_num), Number(row.color_id));
        map[k] = Number(row.qty ?? row.qty_total ?? 0);
      });
      setOwned(map);
    } catch {
      // ignore; start at 0
    }
  }, []);

  // NEW FLOW: open dedicated colour picker page
  const openPickColour = useCallback(
    (partNum: string) => {
      setSelectedPart(partNum);
      const q = categoryId ? `?category_id=${encodeURIComponent(categoryId)}` : "";
      navigate(`/inventory/add/bricks/part/${encodeURIComponent(partNum)}${q}`);
    },
    [navigate, categoryId]
  );

  const runSearch = useCallback(
    async (value: string) => {
      setTerm(value);
      setSelectedPart(null);
      setError("");

      const v = value.trim();
      if (!v) {
        setSearchPartsList([]);
        return;
      }

      setLoading(true);
      try {
        const result = await searchParts(v, categoryId, undefined);
        const parts: PartSummary[] =
          (result || []).map((r: any) => ({
            part_num: r.part_num,
            part_name: r.name ?? null,
            part_img_url: r.part_img_url ?? r.img_url ?? null,
          })) ?? [];

        const ordered = orderParts(parts);
        const hydrated = await hydratePartsWithSingleColour(ordered);
        setSearchPartsList(hydrated);
      } catch (e: any) {
        setError(e?.message ?? "Search failed");
        setSearchPartsList([]);
      } finally {
        setLoading(false);
      }
    },
    [categoryId, orderParts]
  );

  const loadCategoryParts = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    setError("");
    setTerm("");
    setSearchPartsList([]);

    try {
      const parts = await fetchPartsByCategory(categoryId);
      const ordered = orderParts(parts);
      const hydrated = await hydratePartsWithSingleColour(ordered);

      setCategoryParts(hydrated);

      // No auto-open of colours; user clicks a part to pick colour
      setSelectedPart("");
    } catch (e: any) {
      setError(e?.message ?? "Failed to load category parts");
      setCategoryParts([]);
    } finally {
      setLoading(false);
    }
  }, [categoryId, orderParts]);

  const changeQty = useCallback(
    async (part_num: string, color_id: number, delta: number) => {
      const k = key(part_num, color_id);
      const prev = owned[k] ?? 0;
      const optimistic = Math.max(prev + delta, 0);
      setOwned((m) => ({ ...m, [k]: optimistic }));

      try {
        if (delta > 0) {
          const resp = await postAddCanonical(part_num, color_id, delta);
          const serverQty =
            resp && typeof resp.qty === "number"
              ? resp.qty
              : resp && typeof resp.qty_total === "number"
              ? resp.qty_total
              : optimistic;
          setOwned((m) => ({ ...m, [k]: serverQty }));
        } else if (delta < 0) {
          const resp = await postDecCanonical(part_num, color_id, Math.abs(delta));
          const serverQty =
            resp && typeof resp.qty === "number"
              ? resp.qty
              : resp && typeof resp.qty_total === "number"
              ? resp.qty_total
              : Math.max(optimistic, 0);
          setOwned((m) => ({ ...m, [k]: serverQty }));
        }
      } catch (err: any) {
        setOwned((m) => ({ ...m, [k]: prev }));
        setError(err?.message || "Failed to update inventory.");
      }
    },
    [owned]
  );

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    void loadCategoryParts();
  }, [loadCategoryParts]);

  const visibleParts = term.trim() ? searchPartsList : categoryParts;

  return (
    <div className="a2b-page a2b-page-inventory-add-brick">
      {/* HERO */}
      <div
        className="search-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          marginTop: "1.5rem",
          marginBottom: "1.5rem",
          borderRadius: "18px",
          padding: "1.75rem 1.5rem",
          background: "linear-gradient(135deg,#0b1120,#1d4ed8,#fbbf24,#dc2626)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "0 0 auto 0",
            height: "10px",
            display: "flex",
            gap: "2px",
            padding: "0 8px",
          }}
        >
          {["#dc2626", "#f97316", "#fbbf24", "#22c55e", "#0ea5e9", "#6366f1"].map((c, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                borderRadius: "99px",
                background: c,
                opacity: 0.9,
              }}
            />
          ))}
        </div>

        <h1 style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800 }}>Add Bricks</h1>
        <p style={{ marginTop: "0.4rem", fontSize: "0.92rem", opacity: 0.9 }}>
          Search a brick, then choose a colour.
        </p>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "0.6rem" }}>
          <button
            type="button"
            className="a2b-hero-button a2b-cta-dark"
            onClick={() => navigate("/inventory/add")}
            style={{ padding: "0.45rem 1rem", fontSize: "0.92rem" }}
          >
            ← Back to categories
          </button>

          <button
            type="button"
            className="a2b-hero-button a2b-cta-green"
            onClick={() => void loadInventory()}
            style={{ padding: "0.45rem 1rem", fontSize: "0.92rem" }}
            title="Refresh your inventory counts"
          >
            Update inventory
          </button>
        </div>

        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1rem" }}>
          {BRICK_SIZES.map((b) => (
            <button
              key={b.part_num}
              type="button"
              onClick={() => openPickColour(b.part_num)}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: 999,
                border: selectedPart === b.part_num ? "2px solid #2563eb" : "1px solid #cbd5f5",
                background: selectedPart === b.part_num ? "#2563eb" : "#ffffff",
                color: selectedPart === b.part_num ? "#ffffff" : "#0f172a",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: "1rem", maxWidth: 720 }}>
          <input
            value={term}
            onChange={(e) => void runSearch(e.target.value)}
            placeholder="3001 or brick 2 x 4"
            style={{
              width: "100%",
              borderRadius: 14,
              padding: "0.8rem 1rem",
              border: "1px solid rgba(255,255,255,0.35)",
              outline: "none",
              fontSize: "1rem",
            }}
          />
        </div>
      </div>

      {/* Part selection tiles */}
      <div
        style={{
          marginTop: "0.75rem",
          marginBottom: "1rem",
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "1.1rem",
        }}
      >
        {visibleParts.map((p) => {
          const hasSingleColour =
            typeof p.default_color_id === "number" && Number.isFinite(p.default_color_id as number);

          const colorId = hasSingleColour ? (p.default_color_id as number) : -1;
          const ownedQty = hasSingleColour ? owned[key(p.part_num, colorId)] ?? 0 : 0;

          const onClickTile = () => {
            void openPickColour(p.part_num);
          };

          return (
            <div
              key={p.part_num}
              onClick={onClickTile}
              style={{
                cursor: "pointer",
                transform: selectedPart === p.part_num ? "translateY(-3px)" : "translateY(0)",
                transition: "transform 120ms ease",
              }}
              title={p.part_name || p.part_num}
            >
              <BuildabilityPartsTile
                part={{
                  part_num: p.part_num,
                  color_id: colorId, // real colour if single-colour; otherwise -1 (unknown)
                  part_img_url: (p.default_img_url ?? p.part_img_url ?? null) as any,
                }}
                need={0}
                have={ownedQty}
                mode="inventory"
                editableQty={hasSingleColour}
                onChangeQty={hasSingleColour ? (delta) => changeQty(p.part_num, colorId, delta) : undefined}
                showBottomLine={false}
                showInfoButton={true}
                infoText={p.default_color_name || p.part_name || p.part_num}
              />
            </div>
          );
        })}
      </div>

      {loading && <div style={{ padding: "0.75rem" }}>Loading…</div>}
      {error && <div style={{ padding: "0.75rem", color: "#dc2626" }}>{error}</div>}
    </div>
  );
};

const InventoryAddBrickPage: React.FC = () => (
  <RequireAuth pageName="inventory-add-brick">
    <InventoryAddBrickInner />
  </RequireAuth>
);

export default InventoryAddBrickPage;