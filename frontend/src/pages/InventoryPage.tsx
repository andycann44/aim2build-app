import React, { useCallback, useEffect, useMemo, useState } from "react";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import SortMenu, { SortMode } from "../components/SortMenu";
import { authHeaders } from "../utils/auth";
import RequireAuth from "../components/RequireAuth";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "../api/client";
import PageHero from "../components/PageHero";

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
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearError, setShowClearError] = useState(false);
  const [clearErrorText, setClearErrorText] = useState("");
  const [isClearing, setIsClearing] = useState(false);

  const loadParts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API}/api/inventory/parts_with_images`, {
        headers: {
          ...authHeaders(),
        },
      });

      if (res.status === 401) {
        localStorage.removeItem("a2b_token");
        window.location.href = "/login";
        return;
      }
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
    setShowClearConfirm(true);
  };

  const runClear = async () => {
    setIsClearing(true);
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
      setShowClearConfirm(false);
    } catch (err) {
      console.error("Failed to clear inventory", err);
      let msg = "Failed to clear inventory.";
      if (err instanceof Error && err.message) {
        msg = err.message;
      } else if (typeof err === "string" && err.trim()) {
        msg = err;
      } else if ((err as any)?.detail) {
        const d = (err as any).detail;
        if (typeof d === "string" && d.trim()) {
          msg = d;
        } else if (typeof d?.message === "string" && d.message.trim()) {
          msg = d.message;
        }
      }
      setClearErrorText(msg);
      setShowClearConfirm(false);
      setShowClearError(true);
    } finally {
      setIsClearing(false);
    }
  };

  const closeError = () => setShowClearError(false);

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

  const handleKeyDownModal = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        if (isClearing) return;
        if (showClearConfirm) setShowClearConfirm(false);
        if (showClearError) setShowClearError(false);
      }
    },
    [isClearing, showClearConfirm, showClearError]
  );

  return (
    <div className="page page-inventory" onKeyDown={handleKeyDownModal} tabIndex={-1}>
      <PageHero
        title="Inventory"
        subtitle="Every unique part–colour combination you currently own, ready for buildability checks."
      >
        <div
          style={{
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
      </PageHero>

      {error && (
        <p style={{ color: "red", maxWidth: "960px", margin: "0 auto" }}>
          {error}
        </p>
      )}

      {/* Confirm modal */}
      {showClearConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            if (isClearing) return;
            setShowClearConfirm(false);
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "92vw",
              maxWidth: 480,
              background: "#fff",
              color: "#0f172a",
              borderRadius: 16,
              boxShadow: "0 22px 60px rgba(0,0,0,0.28)",
              padding: "1.25rem 1.25rem 1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <span aria-hidden="true" style={{ fontSize: "1.4rem" }}>
                ⚠️
              </span>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>Clear Inventory?</h2>
            </div>
            <p style={{ marginTop: "0.75rem", marginBottom: "1rem", lineHeight: 1.45 }}>
              This will remove ALL inventory parts for your account. This cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
              <button
                type="button"
                onClick={() => setShowClearConfirm(false)}
                disabled={isClearing}
                style={{
                  borderRadius: 12,
                  padding: "0.5rem 0.95rem",
                  border: "1px solid rgba(15,23,42,0.15)",
                  background: "#f8fafc",
                  cursor: isClearing ? "default" : "pointer",
                  opacity: isClearing ? 0.7 : 1,
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void runClear()}
                disabled={isClearing}
                style={{
                  borderRadius: 12,
                  padding: "0.5rem 1rem",
                  border: "1px solid rgba(220,38,38,0.4)",
                  background: "linear-gradient(135deg, #ef4444, #dc2626)",
                  color: "#fff",
                  fontWeight: 800,
                  cursor: isClearing ? "default" : "pointer",
                  boxShadow: "0 12px 28px rgba(220,38,38,0.25)",
                  opacity: isClearing ? 0.8 : 1,
                }}
              >
                {isClearing ? "Clearing…" : "Clear Inventory"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error modal */}
      {showClearError && (
        <div
          role="alertdialog"
          aria-modal="true"
          onClick={() => setShowClearError(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.45)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1rem",
            zIndex: 9999,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "92vw",
              maxWidth: 420,
              background: "#fff",
              color: "#0f172a",
              borderRadius: 16,
              boxShadow: "0 22px 60px rgba(0,0,0,0.28)",
              padding: "1.1rem 1.2rem 1rem",
            }}
          >
            <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, display: "flex", gap: 8 }}>
              <span aria-hidden="true">⚠️</span>
              <span>Could not clear inventory</span>
            </h2>
            <p style={{ marginTop: "0.75rem", marginBottom: "1rem", lineHeight: 1.45 }}>
              {clearErrorText || "Failed to clear inventory."}
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={closeError}
                style={{
                  borderRadius: 12,
                  padding: "0.5rem 0.9rem",
                  border: "1px solid rgba(15,23,42,0.15)",
                  background: "#f8fafc",
                  cursor: "pointer",
                }}
              >
                OK
              </button>
            </div>
          </div>
        </div>
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
