/// <reference types="vite/client" />
import React, { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import RequireAuth from "../components/RequireAuth";
import PartsTile from "../components/PartsTile";
import { searchParts, API_BASE } from "../api/client";
import { authHeaders } from "../utils/auth";

type ElementRow = {
  part_num: string;
  color_id: number;
  color_name?: string | null;
  part_img_url?: string | null;
  img_url?: string | null;
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

async function fetchElementsByPart(partNum: string): Promise<ElementRow[]> {
  const res = await fetch(
    `${API_BASE}/api/catalog/elements/by-part?part_num=${encodeURIComponent(partNum)}`
  );
  if (!res.ok) throw new Error("Failed to load colours");
  return res.json();
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

async function postDecCanonical(part_num: string, color_id: number, delta: number) {
  const res = await fetch(`${API_BASE}/api/inventory/decrement-canonical`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ part_num, color_id, delta }),
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

const InventoryAddBrickInner: React.FC = () => {
  const location = useLocation();

  const qs = new URLSearchParams(location.search);
  const categoryIdParam = qs.get("category_id");
  const categoryId = categoryIdParam ? Number(categoryIdParam) : undefined;

  const [term, setTerm] = useState("");
  const [elements, setElements] = useState<ElementRow[]>([]);
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [owned, setOwned] = useState<Record<string, number>>({});

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
      // ignore inventory load failures; start at 0
    }
  }, []);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const runSearch = useCallback(
    async (value: string) => {
      setTerm(value);
      setSelectedPart(null);
      setElements([]);
      setError("");

      const v = value.trim();
      if (!v) return;

      setLoading(true);
      try {
        const result = await searchParts(v, categoryId, undefined);
        setElements(
          (result || []).map((r) => ({
            part_num: r.part_num,
            color_id: Number(r.color_id ?? 0),
            part_img_url: r.part_img_url ?? r.img_url ?? null,
          }))
        );
      } catch (e: any) {
        setError(e?.message ?? "Search failed");
        setElements([]);
      } finally {
        setLoading(false);
      }
    },
    [categoryId]
  );

  const loadElementsByPart = useCallback(async (partNum: string) => {
    setSelectedPart(partNum);
    setElements([]);
    setLoading(true);
    setError("");

    try {
      const data = await fetchElementsByPart(partNum);
      setElements(
        (data || []).map((row) => ({
          part_num: String(row.part_num),
          color_id: Number(row.color_id ?? 0),
          color_name: row.color_name,
          part_img_url: row.part_img_url ?? row.img_url ?? null,
        }))
      );
    } catch (e: any) {
      setError(e?.message ?? "Failed to load colours");
      setElements([]);
    } finally {
      setLoading(false);
    }
  }, []);

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
              key={b.part_num}
              onClick={() => loadElementsByPart(b.part_num)}
              style={{
                padding: "0.45rem 0.9rem",
                borderRadius: 999,
                border:
                  selectedPart === b.part_num
                    ? "2px solid #2563eb"
                    : "1px solid #cbd5f5",
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

      {/* PART TILE GRID */}
      {elements.length > 0 && (
        <div className="tile-grid" style={{ paddingBottom: "2.5rem" }}>
          {elements.map((e) => {
            const colorId = Number(e.color_id ?? 0);
            const ownedQty = owned[key(e.part_num, colorId)] ?? 0;
            return (
              <PartsTile
                key={`${e.part_num}-${colorId}`}
                mode="addBricks"
                part={{
                  part_num: e.part_num,
                  color_id: colorId,
                  part_img_url: e.part_img_url ?? e.img_url ?? null,
                }}
                qty={ownedQty}
                onChangeQty={(delta) => changeQty(e.part_num, colorId, delta)}
              />
            );
          })}
        </div>
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
