import React, { useCallback, useEffect, useState } from "react";
import SetTile from "../components/SetTile";
import { getMySets, SetSummary } from "../api/client";

const API =
  (import.meta as any)?.env?.VITE_API_BASE || "http://127.0.0.1:8000";

async function addSetToInventory(setNum: string) {
  console.log("Adding set to inventory:", setNum);

  // 1) Get all parts for this set
  const partsRes = await fetch(
    `${API}/api/catalog/parts?set=${encodeURIComponent(setNum)}`
  );

  if (!partsRes.ok) {
    const msg = await partsRes.text();
    throw new Error(
      `Failed to load set parts: ${msg || partsRes.statusText}`
    );
  }

  const data = await partsRes.json();
  console.log("catalog/parts response:", data);

  // We know shape is { set_num: "...", parts: [...] }
  const parts: any[] = Array.isArray((data as any).parts)
    ? (data as any).parts
    : [];

  if (!parts.length) {
    throw new Error("No parts returned from /api/catalog/parts");
  }

  // 2) Add each part into inventory using qty_total
  for (const part of parts) {
    const partNum = part.part_num;
    const colorId = part.color_id;
    const qty =
      part.quantity ??
      part.qty ??
      part.quantity_total ??
      part.qty_total ??
      0;

    if (!partNum || colorId === undefined || !qty) {
      console.warn("Skipping malformed part row", part);
      continue;
    }

    const addRes = await fetch(`${API}/api/inventory/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        part_num: partNum,
        color_id: Number(colorId),
        qty_total: Number(qty), // 👈 key fix
      }),
    });

    if (!addRes.ok) {
      const msg = await addRes.text();
      throw new Error(
        `Failed to add part ${partNum}/${colorId}: ${
          msg || addRes.statusText
        }`
      );
    }
  }

  console.log("Finished adding set to inventory:", setNum);
}
const MySetsPage: React.FC = () => {
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addedInventory, setAddedInventory] = useState<Set<string>>(
    () => new Set()
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMySets();
      setSets(data);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to load My Sets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAddInventory = useCallback(async (setNum: string) => {
    try {
      await addSetToInventory(setNum);
      setAddedInventory((prev) => {
        const next = new Set(prev);
        next.add(setNum);
        return next;
      });
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Failed to add to inventory");
    }
  }, []);

  return (
    <div className="page page-mysets">
      {/* HERO HEADER – same style as Search, just without the search box */}
      <div
        className="sets-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          marginTop: "1.5rem",
          marginRight: "2.5rem",
          marginBottom: "1.5rem",
          marginLeft: "0",
          borderRadius: "18px",
          padding: "1.75rem 1.5rem 1.5rem",
          background:
            "linear-gradient(135deg, #0b1120 0%, #1d4ed8 35%, #fbbf24 70%, #dc2626 100%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* subtle lego studs strip */}
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
          {[
            "#dc2626",
            "#f97316",
            "#fbbf24",
            "#22c55e",
            "#0ea5e9",
            "#6366f1",
          ].map((c, i) => (
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

        <h1
          style={{
            fontSize: "2.1rem",
            fontWeight: 800,
            marginTop: "1.2rem",
          }}
        >
          My Sets
        </h1>
        <p
          style={{
            opacity: 0.95,
            marginTop: "0.5rem",
            fontSize: "1rem",
          }}
        >
          Click &quot;Add to Inventory&quot; to pour all parts from a set into
          your collection.
        </p>
      </div>

      {/* BODY */}
      <div className="search-results">
        {loading && <p className="search-status">Loading…</p>}
        {error && !loading && <p className="search-error">{error}</p>}

        {!loading && !error && sets.length === 0 && (
          <p className="search-empty">
            You haven&apos;t added any sets yet. Use the Search page and click
            &quot;+ My Sets&quot; on a tile to see it here.
          </p>
        )}

        {sets.length > 0 && (
          <div className="tile-grid">
            {sets.map((s) => (
              <SetTile
                key={s.set_num}
                set={s}
                inMySets={true}
                onAddInventory={handleAddInventory}
                inInventory={addedInventory.has(s.set_num)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MySetsPage;