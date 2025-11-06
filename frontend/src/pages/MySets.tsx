import React, { useEffect, useState } from "react";

const API =
  (import.meta as any)?.env?.VITE_API_BASE || "http://127.0.0.1:8000";

type SavedSet = {
  set_num: string;
  name: string;
  year?: number;
  img_url?: string;
  num_parts?: number;
  in_inventory?: boolean; // computed by backend
};

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

export default function MySets() {
  const [rows, setRows] = useState<SavedSet[]>([]);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      // backend returns { sets: [...] }
      const data = await api<{ sets: SavedSet[] }>("/api/my-sets/");
      const list = Array.isArray((data as any)?.sets) ? data.sets : [];
      setRows(list);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleInventory(row: SavedSet, on: boolean) {
    try {
      // send a REAL boolean; backend expects set_num + on
      await api("/api/inventory/toggle", {
        method: "POST",
        body: JSON.stringify({
          set_num: row.set_num,
          on,
          name: row.name,
          year: row.year,
          img_url: row.img_url,
          num_parts: row.num_parts,
        }),
      });

      // ensure Inventory page forces a refresh next visit
      sessionStorage.setItem("a2b.inventory.needsRefresh", "1");

      // hard refresh My Sets so ticks stay in sync with backend truth
      await load();
    } catch (e) {
      console.error(e);
      alert("Could not update inventory. Please try again.");
    }
  }

  async function removeSet(row: SavedSet) {
    if (!confirm(`Remove "${row.name}" (${row.set_num}) from My Sets?`)) return;
    try {
      await api(`/api/my-sets/${encodeURIComponent(row.set_num)}`, {
        method: "DELETE",
      });
      await load();
      // also nudge inventory page since removal might affect parts
      sessionStorage.setItem("a2b.inventory.needsRefresh", "1");
    } catch (e) {
      console.error(e);
      alert("Could not remove set. Please try again.");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ margin: 0 }}>My Sets</h3>
      {loading && <div style={{ opacity: 0.7, marginTop: 6 }}>Loading…</div>}
      {!loading && rows.length === 0 && (
        <div style={{ opacity: 0.75, marginTop: 8 }}>
          No sets yet. Use the Search page to add some.
        </div>
      )}

      <ul
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
          gap: 12,
          listStyle: "none",
          padding: 0,
          marginTop: 12,
        }}
      >
        {rows.map((r) => (
          <li
            key={r.set_num}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "#fff",
              padding: 10,
              display: "flex",
              gap: 12,
              alignItems: "center",
              boxShadow: "0 1px 2px rgba(0,0,0,.03)",
            }}
          >
            {/* Image box – contain, not crop */}
            <div
              style={{
                width: 120,
                height: 90,
                borderRadius: 8,
                background: "#f4f5f7",
                border: "1px solid #e5e7eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                flexShrink: 0,
              }}
            >
              {r.img_url ? (
                <img
                  src={r.img_url}
                  alt={r.name}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                    display: "block",
                  }}
                  loading="lazy"
                />
              ) : (
                <span style={{ fontSize: 11, color: "#999" }}>no image</span>
              )}
            </div>

            {/* Text + toggle */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Full name visible; falls to next line if long */}
              <div
                style={{
                  fontWeight: 600,
                  lineHeight: 1.2,
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                }}
                title={r.name}
              >
                {r.name}
              </div>
              <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>
                {r.set_num}
                {r.year ? ` • ${r.year}` : ""}
              </div>

              <label
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 8,
                  userSelect: "none",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={!!r.in_inventory}
                  onChange={(e) => toggleInventory(r, e.currentTarget.checked)}
                />
                In Inventory
              </label>
            </div>

            <button
              onClick={() => removeSet(r)}
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid #e5e7eb",
                background: "#fff",
                cursor: "pointer",
              }}
              title="Remove from My Sets"
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}