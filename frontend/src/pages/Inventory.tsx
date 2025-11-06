// frontend/src/pages/Inventory.tsx
import React, { useEffect, useMemo, useState } from "react";

// Resolve API base without depending on other helpers
const API = (import.meta.env.VITE_API_BASE?.trim() || "http://127.0.0.1:8000") as string;

type PartRow = {
  part_num: string;
  color_id: number;
  qty_total: number;
  img_url?: string;
  name?: string;
};

type SortKey = "qty_desc" | "qty_asc" | "color" | "part_num";

export default function Inventory() {
  const [rows, setRows] = useState<PartRow[]>([]);
  const [minQty, setMinQty] = useState<number>(1);
  const [query, setQuery] = useState<string>("");
  const [sortBy, setSortBy] = useState<SortKey>("qty_desc");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const u = new URL(`${API}/api/inventory/parts`);
      u.searchParams.set("min_qty", String(minQty || 0));
      u.searchParams.set("q", query);
      const r = await fetch(u.toString(), { headers: { "Content-Type": "application/json" } });
      if (!r.ok) throw new Error(`/api/inventory/parts ${r.status} ${r.statusText}`);
      const data = await r.json();
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  async function clearInventoryFiles() {
    // Prefer canonical endpoint; fall back if needed
    const tryEndpoints = ["/api/inventory/clear_inventory_files", "/api/inventory/clear"];
    let ok = false, detail: any = null;

    for (const path of tryEndpoints) {
      try {
        const r = await fetch(`${API}${path}`, { method: "POST" });
        if (r.ok) {
          detail = await r.json().catch(() => ({}));
          ok = true;
          break;
        }
      } catch (err) {
        detail = String(err || "");
      }
    }
    console.log("clear_state:", { ok, ...detail });
    await load();
  }

  useEffect(() => {
    load().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shown = useMemo(() => {
    const copy = [...rows];
    switch (sortBy) {
      case "qty_desc":
        copy.sort((a, b) => (b.qty_total ?? 0) - (a.qty_total ?? 0));
        break;
      case "qty_asc":
        copy.sort((a, b) => (a.qty_total ?? 0) - (b.qty_total ?? 0));
        break;
      case "color":
        copy.sort((a, b) => (a.color_id ?? 0) - (b.color_id ?? 0) || a.part_num.localeCompare(b.part_num));
        break;
      case "part_num":
        copy.sort((a, b) => a.part_num.localeCompare(b.part_num) || (a.color_id ?? 0) - (b.color_id ?? 0));
        break;
    }
    return copy;
  }, [rows, sortBy]);

  return (
    <div style={{ padding: 16 }}>
      <h3>Inventory</h3>

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <label>
          <span style={{ marginRight: 6 }}>Search</span>
          <input
            placeholder="part number…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
          />
        </label>

        <label>
          <span style={{ marginRight: 6 }}>Min qty</span>
          <input
            type="number"
            min={0}
            value={minQty}
            onChange={(e) => setMinQty(Number(e.target.value || 0))}
            style={{ width: 70, padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
          />
        </label>

        <label>
          <span style={{ marginRight: 6 }}>Sort</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            style={{ padding: "8px 10px", borderRadius: 6, border: "1px solid #ccc" }}
          >
            <option value="qty_desc">Qty (high→low)</option>
            <option value="qty_asc">Qty (low→high)</option>
            <option value="color">Color</option>
            <option value="part_num">Part number</option>
          </select>
        </label>

        <button
          onClick={load}
          disabled={loading}
          style={{ padding: "8px 12px", border: "1px solid #bbb", borderRadius: 8, background: "#fff", cursor: "pointer" }}
        >
          {loading ? "Loading…" : "Refresh"}
        </button>

        <button
          onClick={clearInventoryFiles}
          style={{ padding: "8px 12px", border: "1px solid #bbb", borderRadius: 8, background: "#fff", cursor: "pointer" }}
        >
          Clear inventory files
        </button>

        <span style={{ color: "#666" }}>
          {shown.length} unique • {rows.reduce((a, r) => a + (r.qty_total ?? 0), 0)} total
        </span>
      </div>

      {shown.length === 0 ? (
        <div style={{ color: "#666" }}>No parts match your filters. Try lowering Min qty or clearing Search.</div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: 16,
          }}
        >
          {shown.map((p) => (
            <div
              key={`${p.part_num}:${p.color_id}`}
              style={{
                display: "grid",
                gridTemplateColumns: "112px 1fr",
                gap: 12,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #e5e7eb",
                background: "#fff",
              }}
              title={`${p.part_num} • color ${p.color_id}`}
            >
              <div
                style={{
                  width: 112,
                  height: 112,
                  borderRadius: 10,
                  background: "#f7f7f7",
                  display: "grid",
                  placeItems: "center",
                  overflow: "hidden",
                }}
              >
                {p.img_url ? (
                  <img src={p.img_url} alt={p.part_num} style={{ maxWidth: "92%", maxHeight: "92%", objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 12, color: "#999" }}>no image</span>
                )}
              </div>

              <div>
                <div style={{ fontWeight: 600 }}>
                  {p.name?.trim() || `${p.part_num} • color ${p.color_id}`}
                </div>
                <div style={{ fontSize: 12, color: "#666", marginTop: 4 }}>
                  Qty: {p.qty_total ?? 0}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}