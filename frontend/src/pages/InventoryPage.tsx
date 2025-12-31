import React, { useCallback, useEffect, useMemo, useState } from "react";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import SortMenu, { SortMode } from "../components/SortMenu";
import { authHeaders } from "../utils/auth";
import RequireAuth from "../components/RequireAuth";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/client";

type InventoryPart = {
  part_num: string;
  color_id: number;
  qty_total: number;
  part_img_url?: string;
};


const API = API_BASE;
const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");
  const [stats, setStats] = useState({ unique: 0, total: 0 });

  const loadParts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/inventory/parts_with_images`, {
        headers: {
          ...authHeaders(),
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data: InventoryPart[] = await res.json();

      // De-dupe: same part_num + color_id (DO NOT sum — backend should be the truth)
      const mergedMap = new Map<string, InventoryPart>();
      for (const p of data) {
        const key = `${p.part_num}-${p.color_id}`;
        const existing = mergedMap.get(key);

        if (!existing) {
          mergedMap.set(key, { ...p });
        } else {
          // keep image if existing is missing it
          if (!existing.part_img_url && p.part_img_url) {
            existing.part_img_url = p.part_img_url;
          }
          // keep qty_total as-is (no summing)
        }
      }

      const mergedParts = Array.from(mergedMap.values());
      setParts(mergedParts);

      const unique = mergedParts.length;
      const total = mergedParts.reduce((sum, p) => sum + (Number(p.qty ?? p.qty_total) || 0), 0);
      setStats({ unique, total });
    } catch (err: any) {
      console.error("Failed to load inventory parts", err);
      setError(err?.message ?? "Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  const clearInventory = async () => {
    if (!window.confirm("Clear ALL inventory parts?")) return;

    try {
      const res = await fetch(`${API}/api/inventory/clear-canonical`, {
        method: "POST",
        headers: {
          ...authHeaders(),
          Accept: "application/json",
        },
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // safest: reload from backend truth
      await loadParts();
    } catch (err) {
      console.error("Failed to clear inventory", err);
      alert("Failed to clear inventory, see console for details.");
    }
  };

  const sortedParts = useMemo(() => {
    const byPartThenColor = (a: InventoryPart, b: InventoryPart) => {
      const byPart = a.part_num.localeCompare(b.part_num);
      if (byPart !== 0) return byPart;
      return a.color_id - b.color_id;
    };

    switch (sortMode) {
      case "qty_desc":
        return [...parts].sort((a, b) => {
          const diff = (b.qty_total ?? 0) - (a.qty_total ?? 0);
          if (diff !== 0) return diff;
          return byPartThenColor(a, b);
        });
      case "qty_asc":
        return [...parts].sort((a, b) => {
          const diff = (a.qty_total ?? 0) - (b.qty_total ?? 0);
          if (diff !== 0) return diff;
          return byPartThenColor(a, b);
        });
      case "color_asc":
        return [...parts].sort((a, b) => {
          if (a.color_id !== b.color_id) return a.color_id - b.color_id;
          return byPartThenColor(a, b);
        });
      default:
        return [...parts].sort(byPartThenColor);
    }
  }, [parts, sortMode]);

  useEffect(() => {
    loadParts();
  }, [loadParts]);

  return (
    <div className="page page-inventory">
      <div
        className="inventory-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          marginTop: "1.5rem",
          marginRight: "2.5rem",
          marginBottom: "1.5rem",
          marginLeft: 0,
          borderRadius: "18px",
          padding: "1.75rem 1.5rem 1.5rem",
          background:
            "linear-gradient(135deg, #0b1120 0%, #1d4ed8 35%, #fbbf24 70%, #dc2626 100%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "#fff",
          position: "relative",
          overflow: "visible",
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
          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: 800,
              letterSpacing: "0.03em",
              marginBottom: "0.4rem",
              textShadow: "0 2px 6px rgba(0,0,0,0.45)",
            }}
          >
            Inventory
          </h1>
          <p
            style={{
              margin: "0.5rem 0 1rem",
              maxWidth: "520px",
              fontSize: "0.9rem",
              lineHeight: 1.45,
              opacity: 0.9,
            }}
          >
            Every unique part–colour combination you currently own, ready for
            buildability checks.
          </p>
        </div>

        <div
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            justifyContent: "space-between",
            gap: "0.5rem",
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <div
              style={{
                borderRadius: "999px",
                background: "rgba(15,23,42,0.8)",
                padding: "0.25rem 0.85rem",
                fontSize: "0.8rem",
                border: "1px solid rgba(148,163,184,0.5)",
              }}
            >
              {stats.unique.toLocaleString()} unique parts ·{" "}
              {stats.total.toLocaleString()} pieces
            </div>

            <SortMenu sortMode={sortMode} onChange={setSortMode} />

            <button
              type="button"
              onClick={loadParts}
              style={{
                borderRadius: "6px",
                padding: "0.25rem 0.75rem",
                fontSize: "0.8rem",
                cursor: "pointer",
                background: "rgba(15,23,42,0.35)",
                color: "#e5e7eb",
                border: "1px solid rgba(148,163,184,0.35)",
              }}
            >
              Refresh
            </button>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
            <button
              type="button"
              className="a2b-hero-button a2b-cta-dark"
              onClick={() => navigate("/inventory/add")}
              title="Add loose bricks to your inventory (no sets required)."
            >
              + Add bricks
            </button>

            <button
              type="button"
              className="a2b-hero-button a2b-cta-green"
              onClick={() => navigate("/inventory/edit")}
            >
              Edit inventory
            </button>

            <button
              type="button"
              onClick={clearInventory}
              className="a2b-btn-glass-danger"
            >
              Clear Inventory
            </button>
          </div>
        </div>
      </div>

      {error && (
        <p style={{ color: "red", maxWidth: "960px", margin: "0 auto" }}>
          {error}
        </p>
      )}

      {/* GRID: 4–5 tiles wide on desktop */}
      <div
        style={{
          maxWidth: "1600px",
          margin: "0 auto 2.5rem",
          padding: "0 1.5rem",
        }}
      >
        {loading ? (
          <p>Loading inventory…</p>
        ) : (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: "1.1rem",
              alignItems: "flex-start",
            }}
          >
            {sortedParts.map((p) => {
              const qty = Number(p.qty_total ?? 0);
              return (
                <BuildabilityPartsTile
                  key={`${p.part_num}-${p.color_id}`}
                  part={p}
                  need={qty}
                  have={qty}
                  mode="inventory"
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const InventoryPageWrapper: React.FC = () => (
  <RequireAuth pageName="inventory">
    <InventoryPage />
  </RequireAuth>
);

export default InventoryPageWrapper;
