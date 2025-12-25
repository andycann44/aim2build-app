// frontend/src/pages/InventoryAddBrickPage.tsx
import React, { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import RequireAuth from "../components/RequireAuth";
import { searchParts, API_BASE } from "../api/client";
import { addCanonical, decCanonical } from "../api/inventoryCanonical";
import { authHeaders } from "../utils/auth";

type ElementRow = {
  part_num: string;
  color_id: number;
  color_name?: string | null;
  img_url?: string | null;
};

async function fetchElementsByPart(partNum: string): Promise<ElementRow[]> {
  const res = await fetch(
    `${API_BASE}/api/catalog/elements/by-part?part_num=${encodeURIComponent(partNum)}`
  );
  if (!res.ok) throw new Error("Failed to load colours");
  return res.json();
}

const InventoryAddBrickInner: React.FC = () => {
  const location = useLocation();

  const qs = new URLSearchParams(location.search);
  const categoryIdParam = qs.get("category_id");
  const categoryId = categoryIdParam ? Number(categoryIdParam) : undefined;

  const [term, setTerm] = useState("");
  const [parts, setParts] = useState<ElementRow[]>([]);
  const [elements, setElements] = useState<ElementRow[]>([]);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [owned, setOwned] = useState<Record<string, number>>({});
  const key = (part: string, color: number) => `${part}::${color}`;

  const BRICK_SIZES: { label: string; part_num: string }[] = [
    { label: "1 × 1", part_num: "3005" },
    { label: "1 × 2", part_num: "3004" },
    { label: "1 × 3", part_num: "3622" },
    { label: "1 × 4", part_num: "3010" },
    { label: "2 × 2", part_num: "3003" },
    { label: "2 × 3", part_num: "3002" },
    { label: "2 × 4", part_num: "3001" },
  ];

  async function runSearch(value: string) {
    setTerm(value);
    setSelectedPart(null);
    setElements([]);
    setError("");

    const v = value.trim();
    if (!v) {
      setParts([]);
      return;
    }

    setLoading(true);
    try {
      const result = await searchParts(v, categoryId, undefined);
      setParts(
        (result || []).map((r) => ({
          part_num: r.part_num,
          color_id: r.color_id,
          img_url: r.part_img_url ?? undefined,
        }))
      );
    } catch (e: any) {
      setError(e?.message ?? "Search failed");
      setParts([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const loadInventory = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/inventory/canonical-parts`, {
          headers: { ...authHeaders() },
        });
        if (!res.ok) return;
        const data = await res.json();
        const map: Record<string, number> = {};
        (data || []).forEach((row: any) => {
          const k = key(String(row.part_num), Number(row.color_id));
          map[k] = Number(row.qty_total ?? 0);
        });
        setOwned(map);
      } catch {
        // ignore
      }
    };
    void loadInventory();
  }, []);

  const changeQty = async (part_num: string, color_id: number, delta: number) => {
    const k = key(part_num, color_id);
    const prev = owned[k] ?? 0;
    const optimistic = Math.max(prev + delta, 0);
    setOwned((m) => ({ ...m, [k]: optimistic }));
    try {
      const resp =
        delta > 0
          ? await addCanonical(part_num, color_id, delta)
          : await decCanonical(part_num, color_id, Math.abs(delta));
      const serverQty =
        resp && typeof resp.qty === "number" ? resp.qty : optimistic;
      setOwned((m) => ({ ...m, [k]: serverQty }));
    } catch (err: any) {
      setOwned((m) => ({ ...m, [k]: prev }));
      setError(err?.message || "Failed to update inventory.");
    }
  };
  async function loadElementsByPart(partNum: string) {
    setSelectedPart(partNum);
    setElements([]);
    setLoading(true);
    setError("");

    try {
      const res = await fetch(
        `${API_BASE}/api/catalog/elements/by-part?part_num=${partNum}`
      );
      if (!res.ok) throw new Error("Failed to load colours");
      const data = await res.json();
      setElements(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load colours");
    } finally {
      setLoading(false);
    }
  }

  async function selectPart(partNum: string) {
    setSelectedPart(partNum);
    setParts([]);
    setLoading(true);
    setError("");

    try {
      const rows = await fetchElementsByPart(partNum);
      setElements(rows);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load colours");
      setElements([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="a2b-page a2b-page-inventory-add-brick">
      {/* HERO */}
      <div
        className="search-hero"
        style={{
          width: "100%",
          marginTop: "1.5rem",
          marginBottom: "1.5rem",
          borderRadius: "18px",
          padding: "1.75rem 1.5rem",
          background:
            "linear-gradient(135deg,#0b1120,#1d4ed8,#fbbf24,#dc2626)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "#fff",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800 }}>
          Add Bricks
        </h1>
        <p style={{ marginTop: "0.4rem", fontSize: "0.92rem", opacity: 0.9 }}>
          Search a brick, then choose a colour.
        </p>
        <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap", marginTop: "1rem" }}>
          {BRICK_SIZES.map((b) => (
            <button
              key={`${b.part_num}-${b.label}`}
              onClick={() => loadElementsByPart(b.part_num)}
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
            onChange={(e) => runSearch(e.target.value)}
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

      {loading && <div style={{ padding: "0.75rem" }}>Loading…</div>}
      {error && (
        <div style={{ padding: "0.75rem", color: "#dc2626" }}>{error}</div>
      )}

      {/* PART SEARCH RESULTS */}
      {elements.length > 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: "1.1rem",
            paddingBottom: "2.5rem",
          }}
        >
          {elements.map((e) => {
            const ownedQty = owned[key(e.part_num, e.color_id)] ?? 0;
            return (
              <div key={`${e.part_num}-${e.color_id}`} style={{ borderRadius: 22, padding: 2, background: "#e5e7eb" }}>
                <div
                  style={{
                    borderRadius: 20,
                    background: "#fff",
                    padding: "0.9rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <div
                    style={{
                      minHeight: 110,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {e.img_url ? (
                      <img
                        src={e.img_url}
                        alt={e.color_name}
                        style={{ maxHeight: 110, objectFit: "contain" }}
                      />
                    ) : (
                      <div style={{ opacity: 0.6 }}>No image</div>
                    )}
                  </div>

                  <div style={{ fontWeight: 800 }}>{e.color_name ?? `Color ${e.color_id}`}</div>
                  <div
                    style={{
                      marginTop: "0.25rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <button
                      type="button"
                      disabled={ownedQty <= 0}
                      onClick={() => changeQty(e.part_num, e.color_id, -1)}
                      style={{
                        borderRadius: 999,
                        width: 32,
                        height: 32,
                        border: "1px solid rgba(148,163,184,0.7)",
                        background: ownedQty <= 0 ? "#e5e7eb" : "#f1f5f9",
                        cursor: ownedQty <= 0 ? "not-allowed" : "pointer",
                        fontWeight: 800,
                        color: "#0f172a",
                      }}
                    >
                      −
                    </button>
                    <div
                      style={{
                        minWidth: 46,
                        textAlign: "center",
                        borderRadius: 999,
                        padding: "0.2rem 0.65rem",
                        background: "rgba(15,23,42,0.08)",
                        fontWeight: 700,
                        color: "#0f172a",
                      }}
                    >
                      {ownedQty}
                    </div>
                    <button
                      type="button"
                      onClick={() => changeQty(e.part_num, e.color_id, 1)}
                      style={{
                        borderRadius: 999,
                        width: 32,
                        height: 32,
                        border: "1px solid rgba(34,197,94,0.8)",
                        background: "linear-gradient(135deg,#22c55e,#16a34a)",
                        color: "#fff",
                        fontWeight: 800,
                        cursor: "pointer",
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* COLOUR VARIANTS */}
      {selectedPart && (
        <>
          <h3 style={{ marginBottom: "0.8rem" }}>
            Colours for part {selectedPart}
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0,1fr))",
              gap: "1.1rem",
              paddingBottom: "2rem",
            }}
          >
            {elements.map((e) => (
              <div
                key={`${e.part_num}-${e.color_id}`}
                style={{
                  borderRadius: 20,
                  padding: "1rem",
                  background: "#fff",
                  border: "1px solid rgba(148,163,184,0.4)",
                }}
              >
                <div
                  style={{
                    height: 110,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {e.img_url ? (
                    <img
                      src={e.img_url}
                      style={{ maxHeight: 110, maxWidth: "100%" }}
                    />
                  ) : (
                    <div style={{ opacity: 0.6 }}>No image</div>
                  )}
                </div>
                <div style={{ fontWeight: 800 }}>
                  {e.color_name ?? `Color ${e.color_id}`}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

const InventoryAddBrickPage: React.FC = () => (
  <RequireAuth pageName="inventory-add-brick">
    <InventoryAddBrickInner />
  </RequireAuth>
);

export default InventoryAddBrickPage;
