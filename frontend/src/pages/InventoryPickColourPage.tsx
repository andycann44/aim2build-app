/// <reference types="vite/client" />
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import RequireAuth from "../components/RequireAuth";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import { API_BASE } from "../api/client";
import { authHeaders } from "../utils/auth";

type ElementRow = {
  part_num: string;
  color_id: number;
  color_name?: string | null;
  part_img_url?: string | null;
  img_url?: string | null;
};

type InventoryRow = {
  part_num: string;
  color_id: number;
  qty?: number;
  qty_total?: number;
};

const API = API_BASE;
const key = (p: string, c: number) => `${p}::${c}`;

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

async function fetchElementsByPart(part_num: string): Promise<ElementRow[]> {
  const res = await fetch(
    `${API}/api/catalog/elements/by-part?part_num=${encodeURIComponent(part_num)}`,
    { headers: { ...authHeaders() } }
  );
  if (!res.ok) throw new Error(`Failed to load colours (${res.status})`);
  return (await res.json()) as ElementRow[];
}

async function fetchCanonicalInventory(): Promise<InventoryRow[]> {
  const res = await fetch(`${API}/api/inventory/canonical-parts`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to load inventory (${res.status})`);
  return (await res.json()) as InventoryRow[];
}

async function postAddCanonical(part_num: string, color_id: number, qty: number) {
  const res = await fetch(`${API}/api/inventory/add-canonical`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ part_num, color_id, qty }),
  });
  if (!res.ok) throw new Error(`Add failed (${res.status})`);
  return await res.json().catch(() => null);
}

async function postDecCanonical(part_num: string, color_id: number, qty: number) {
  const res = await fetch(`${API}/api/inventory/decrement-canonical`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ part_num, color_id, qty }),
  });
  if (!res.ok) throw new Error(`Decrement failed (${res.status})`);
  return await res.json().catch(() => null);
}

const InventoryPickColourInner: React.FC = () => {
  const { partNum } = useParams();
  const navigate = useNavigate();
  const q = useQuery();

  const categoryId = q.get("category_id") || "";
  const backTo =
    categoryId && categoryId.trim()
      ? `/inventory/add/bricks?category_id=${encodeURIComponent(categoryId)}`
      : "/inventory/add/bricks";

  const [elements, setElements] = useState<ElementRow[]>([]);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const loadInventory = useCallback(async () => {
    try {
      const rows = await fetchCanonicalInventory();
      const map: Record<string, number> = {};
      (rows || []).forEach((r) => {
        const pn = String(r.part_num);
        const cid = Number(r.color_id);
        const qty =
          typeof r.qty_total === "number"
            ? r.qty_total
            : typeof r.qty === "number"
              ? r.qty
              : 0;
        map[key(pn, cid)] = qty;
      });
      setOwned(map);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load inventory.");
    }
  }, []);

  const loadElements = useCallback(async () => {
    if (!partNum) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchElementsByPart(partNum);
      setElements(data || []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load colours.");
      setElements([]);
    } finally {
      setLoading(false);
    }
  }, [partNum]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    void loadElements();
  }, [loadElements]);

  const changeQty = useCallback(
    async (pn: string, cid: number, delta: number) => {
      const k = key(pn, cid);
      const prev = owned[k] ?? 0;
      const optimistic = Math.max(prev + delta, 0);
      setOwned((m) => ({ ...m, [k]: optimistic }));

      try {
        if (delta > 0) {
          const resp = await postAddCanonical(pn, cid, delta);
          const serverQty =
            resp && typeof resp.qty === "number"
              ? resp.qty
              : resp && typeof resp.qty_total === "number"
                ? resp.qty_total
                : optimistic;
          setOwned((m) => ({ ...m, [k]: serverQty }));
        } else if (delta < 0) {
          const resp = await postDecCanonical(pn, cid, Math.abs(delta));
          const serverQty =
            resp && typeof resp.qty === "number"
              ? resp.qty
              : resp && typeof resp.qty_total === "number"
                ? resp.qty_total
                : optimistic;
          setOwned((m) => ({ ...m, [k]: serverQty }));
        }
      } catch (e: any) {
        setOwned((m) => ({ ...m, [k]: prev }));
        setError(e?.message ?? "Failed to update inventory.");
      }
    },
    [owned]
  );

  return (
    <div className="a2b-page a2b-page-inventory-pick-colour">
      <div
        className="search-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          marginTop: "1.5rem",
          marginRight: "2.5rem",
          marginBottom: "1.5rem",
          marginLeft: 0,
          borderRadius: "18px",
          padding: "1.75rem 1.5rem",
          background:
            "linear-gradient(135deg,#0b1120,#1d4ed8,#fbbf24,#dc2626)",
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
          {["#dc2626", "#f97316", "#fbbf24", "#22c55e", "#0ea5e9", "#6366f1"].map(
            (c, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderRadius: "99px",
                  background: c,
                  opacity: 0.9,
                }}
              />
            )
          )}
        </div>
        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{ margin: 0, fontSize: "1.9rem", fontWeight: 800 }}>
            Pick a colour
          </h1>
          <div style={{ opacity: 0.9, marginTop: "0.35rem", fontSize: "0.95rem" }}>
            Part: <strong>{partNum || "—"}</strong>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.6rem",
              flexWrap: "wrap",
              marginTop: "0.8rem",
            }}
          >
            <button
              className="a2b-hero-button a2b-cta-dark"
              onClick={() => navigate(backTo)}
              style={{ padding: "0.45rem 1rem", fontSize: "0.92rem" }}
            >
              ← Back
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div style={{ padding: "0.75rem 1rem", color: "#b91c1c" }}>{error}</div>
      )}
      {loading && <div style={{ padding: "0.75rem 1rem" }}>Loading…</div>}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "1.1rem",
          paddingBottom: "2.5rem",
        }}
      >
        {elements.map((e) => {
          const pn = String(e.part_num);
          const cid = Number(e.color_id);
          const have = owned[key(pn, cid)] ?? 0;

          return (
            <BuildabilityPartsTile
              key={`${pn}-${cid}`}
              part={{
                part_num: pn,
                color_id: cid,
                part_img_url: e.part_img_url ?? e.img_url ?? null,
              }}
              mode="inventory"
              have={have}
              need={0}
              editableQty={true}
              onChangeQty={(delta) => changeQty(pn, cid, delta)}
              showBottomLine={false}
              showInfoButton={true}
              infoText={e.color_name || `${pn} / ${cid}`}
            />
          );
        })}
      </div>

      {!loading && elements.length === 0 && !error && (
        <div style={{ padding: "0.75rem 1rem", opacity: 0.8 }}>
          No colours found for this part.
        </div>
      )}
    </div>
  );
};

const InventoryPickColourPage: React.FC = () => (
  <RequireAuth pageName="inventory-pick-colour">
    <InventoryPickColourInner />
  </RequireAuth>
);

export default InventoryPickColourPage;
