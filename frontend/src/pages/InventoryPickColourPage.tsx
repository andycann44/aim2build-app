/// <reference types="vite/client" />
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import RequireAuth from "../components/RequireAuth";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import { API_BASE } from "../api/client";
import { authHeaders } from "../utils/auth";
import PageHero from "../components/PageHero";

type ElementColor = {
  part_num: string;
  color_id: number;
  color_name?: string | null;
  img_url?: string | null;
  element_id?: string | number | null;
};

const partKey = (partNum: string, colorId: number) => `${partNum}::${colorId}`;

const InventoryPickColourInner: React.FC = () => {
  const { partNum: rawPartNum } = useParams();
  const partNum = typeof rawPartNum === "string" ? rawPartNum : "";
  const location = useLocation();
  const navigate = useNavigate();

  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const parentKeyParam = qs.get("parent_key") || qs.get("cat") || "";
  const childParam = qs.get("child") || "";
  const themeParam = qs.get("theme_id") || "";
  const filterParam = qs.get("filter") || "";
  const queryParam = qs.get("q") || "";

  const [colors, setColors] = useState<ElementColor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [term, setTerm] = useState("");

  const backHref = useMemo(() => {
    const params = new URLSearchParams();
    if (parentKeyParam) {
      params.set("parent_key", parentKeyParam);
      params.set("cat", parentKeyParam);
    }
    if (childParam) params.set("child", childParam);
    if (themeParam) params.set("theme_id", themeParam);
    if (filterParam) params.set("filter", filterParam);
    if (queryParam) params.set("q", queryParam);
    const s = params.toString();
    return `/inventory/add/bricks${s ? `?${s}` : ""}`;
  }, [parentKeyParam, childParam, filterParam, queryParam]);

  const loadColors = useCallback(async () => {
    if (!partNum) {
      setColors([]);
      setError("Missing part number.");
      return;
    }

    setLoading(true);
    setError("");
    try {
      const res = await fetch(
        `${API_BASE}/api/catalog/elements/by-part?part_num=${encodeURIComponent(partNum)}`,
        { headers: { ...authHeaders() } }
      );
      if (!res.ok) throw new Error(`Failed to load colours (${res.status})`);
      const data = (await res.json()) as ElementColor[];
      setColors(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load colours.");
      setColors([]);
    } finally {
      setLoading(false);
    }
  }, [partNum]);

  const loadInventory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inventory/canonical-parts`, {
        headers: { ...authHeaders() },
      });
      if (!res.ok) return;
      const data = await res.json();
      const map: Record<string, number> = {};
      (data || []).forEach((row: any) => {
        const k = partKey(String(row.part_num), Number(row.color_id));
        map[k] = Number(row.qty ?? row.qty_total ?? 0);
      });
      setOwned(map);
    } catch {
      // ignore
    }
  }, []);

  const changeQty = useCallback(
    async (part_num: string, color_id: number, delta: number) => {
      const k = partKey(part_num, color_id);
      const prev = owned[k] ?? 0;
      const optimistic = Math.max(prev + delta, 0);
      setOwned((m) => ({ ...m, [k]: optimistic }));

      try {
        if (delta > 0) {
          await fetch(`${API_BASE}/api/inventory/add-canonical`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ part_num, color_id, qty: delta }),
          });
        } else if (delta < 0) {
          await fetch(`${API_BASE}/api/inventory/decrement-canonical`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...authHeaders() },
            body: JSON.stringify({ part_num, color_id, qty: Math.abs(delta) }),
          });
        }
      } catch (err: any) {
        setOwned((m) => ({ ...m, [k]: prev }));
        setError(err?.message || "Failed to update inventory.");
      }
    },
    [owned]
  );

  useEffect(() => {
    void loadColors();
  }, [loadColors]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    if (!q) return colors;
    return colors.filter((c) => {
      const name = String(c.color_name || "").toLowerCase();
      const id = String(c.color_id ?? "");
      return name.includes(q) || id.includes(q);
    });
  }, [colors, term]);

  return (
    <div className="a2b-page a2b-page-inventory-pick-colour">
      <PageHero
        title="Pick Colours"
        subtitle={partNum ? `Part ${partNum}` : "Missing part number"}
        left={
          <button type="button" className="a2b-hero-button a2b-cta-dark" onClick={() => navigate(backHref)}>
            ← Back to parts
          </button>
        }
      >
        <div style={{ marginTop: "0.65rem", maxWidth: 520 }}>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Filter by colour name or id"
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
      </PageHero>

      {loading && <div style={{ padding: "0.75rem" }}>Loading…</div>}
      {error && <div style={{ padding: "0.75rem", color: "#dc2626" }}>{error}</div>}

      {!loading && !error && (
        <div style={{ marginTop: "0.75rem" }}>
          {filtered.length === 0 ? (
            <div style={{ padding: "0.75rem", color: "#64748b" }}>No colours found.</div>
          ) : (
            <div className="parts-grid" style={{ marginBottom: "1rem" }}>
              {filtered.map((c) => {
                const cid = Number(c.color_id ?? 0);
                const ownedQty = owned[partKey(partNum, cid)] ?? 0;
                return (
                  <BuildabilityPartsTile
                    key={`${partNum}-${cid}`}
                    part={{
                      part_num: partNum,
                      color_id: cid,
                      part_img_url: (c.img_url ?? null) as any,
                    }}
                    partName={c.color_name ?? null}
                    need={0}
                    have={ownedQty}
                    mode="inventory"
                    editableQty
                    onChangeQty={(delta) => changeQty(partNum, cid, delta)}
                    showBottomLine={false}
                    showInfoButton={false}
                  />
                );
              })}
            </div>
          )}
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
