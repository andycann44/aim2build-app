import React, { useCallback, useEffect, useState } from "react";
import PartsTile from "../components/PartsTile";

type InventoryPart = {
  part_num: string;
  color_id: number;
  qty_total: number;
  part_img_url?: string;
};

const API = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const InventoryPage: React.FC = () => {
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({ unique: 0, total: 0 });

  const loadParts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API}/api/inventory/parts_with_images`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: InventoryPart[] = await res.json();

      // Merge duplicates: same part_num + color_id
      const mergedMap = new Map<string, InventoryPart>();
      for (const p of data) {
        const key = `${p.part_num}-${p.color_id}`;
        const existing = mergedMap.get(key);
        if (existing) {
          existing.qty_total =
            (existing.qty_total ?? 0) + (p.qty_total ?? 0);
          if (!existing.part_img_url && p.part_img_url) {
            existing.part_img_url = p.part_img_url;
          }
        } else {
          mergedMap.set(key, { ...p });
        }
      }

      const mergedParts = Array.from(mergedMap.values());
      setParts(mergedParts);

      const unique = mergedParts.length;
      const total = mergedParts.reduce(
        (sum, p) => sum + (p.qty_total ?? 0),
        0
      );
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
      const res = await fetch(
        `${API}/api/inventory/clear?confirm=YES`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setParts([]);
      setStats({ unique: 0, total: 0 });
    } catch (err) {
      console.error("Failed to clear inventory", err);
      alert("Failed to clear inventory, see console for details.");
    }
  };

  useEffect(() => {
    loadParts();
  }, [loadParts]);

  return (
    <div className="page page-inventory">
      {/* HERO HEADER – same style family as Search/My Sets */}
      <div
        className="search-hero"
        style={{
          width:"100%",
          maxWidth: "100%",
          borderRadius: "18px",
          padding: "1.75rem 1.5rem 1.5rem",
          background:
            "linear-gradient(135deg, #0b1120 0%, #1d4ed8 35%, #f97316 70%, #22c55e 100%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* studs strip */}
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

        <div style={{ marginTop: "1.75rem" }}>
          <div
            style={{
              fontSize: "0.75rem",
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              opacity: 0.85,
              marginBottom: "0.25rem",
            }}
          >
            Your LEGO drawer
          </div>
          <h1
            style={{
              fontSize: "2rem",
              fontWeight: 800,
              margin: 0,
              textShadow: "0 4px 18px rgba(0,0,0,0.6)",
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
            display: "flex",
            flexWrap: "wrap",
            gap: "0.5rem",
            alignItems: "center",
          }}
        >
          <div
            style={{
              borderRadius: "999px",
              background: "rgba(15,23,42,0.8)",
              padding: "0.25rem 0.85rem",
              fontSize: "0.8rem",
            }}
          >
            {stats.unique.toLocaleString()} unique parts ·{" "}
            {stats.total.toLocaleString()} pieces
          </div>

          <button
            type="button"
            onClick={loadParts}
            style={{
              borderRadius: "6px",
              border: "none",
              padding: "0.25rem 0.75rem",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Refresh
          </button>

          <button
            type="button"
            onClick={clearInventory}
            style={{
              borderRadius: "6px",
              border: "none",
              padding: "0.25rem 0.75rem",
              fontSize: "0.8rem",
              cursor: "pointer",
              background: "rgba(15,23,42,0.18)",
              color: "#fff",
            }}
          >
            Clear Inventory
          </button>
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
            {parts.map((p) => (
              <PartsTile
                key={`${p.part_num}-${p.color_id}`}
                part={p}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryPage;
