import React, { useEffect, useMemo, useState } from "react";

type PartRow = {
  part_num: string;
  color_id: number;
  qty_total: number;
  img_url?: string;
  name?: string;
};

async function api(path: string, opts: RequestInit = {}) {
  const base = (import.meta as any)?.env?.VITE_API_BASE || "http://127.0.0.1:8000";
  const r = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

export default function Inventory() {
  const [rows, setRows] = useState<PartRow[]>([]);
  const [minQty, setMinQty] = useState<number>(1);
  const [term, setTerm] = useState<string>("");
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const q = encodeURIComponent(term);
      const data: PartRow[] = await api(`/api/inventory/parts?min_qty=${minQty}&q=${q}`);
      setRows(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  async function refresh() {
    await load();
  }

  async function clearInventoryFiles() {
    setLoading(true);
    try {
      await api("/api/inventory/clear_files", { method: "POST" });
      await load();
      alert("Inventory files cleared (backups created).");
    } finally {
      setLoading(false);
    }
  }

  const totalQty = useMemo(() => rows.reduce((a, r) => a + (r.qty_total || 0), 0), [rows]);

  return (
    <div style={{ padding: 16 }}>
      <h3>Inventory</h3>

      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <label>
          Search{" "}
          <input
            placeholder="part number…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            style={{ padding: 6 }}
          />
        </label>

        <label>
          Min qty{" "}
          <input
            type="number"
            min={0}
            value={minQty}
            onChange={(e) => setMinQty(parseInt(e.target.value || "0", 10))}
            style={{ width: 72, padding: 6 }}
          />
        </label>

        <button onClick={refresh} disabled={loading} style={{ padding: "8px 12px", border: "1px solid #ccc" }}>
          Refresh
        </button>

        <button onClick={clearInventoryFiles} disabled={loading} style={{ padding: "8px 12px", border: "1px solid #ccc" }}>
          Clear inventory files
        </button>
      </div>

      <div style={{ marginTop: 8, color: "#666" }}>
        {loading ? "Loading…" : `${rows.length} unique • ${totalQty} total`}
      </div>

      {rows.length === 0 ? (
        <p style={{ marginTop: 16 }}>No parts match your filters. Try lowering Min qty or clearing Search.</p>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12, marginTop: 16 }}>
          {rows.map((p) => (
            <div key={`${p.part_num}-${p.color_id}`} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12, display: "flex", gap: 12 }}>
              <div style={{ width: 72, height: 72, display: "flex", alignItems: "center", justifyContent: "center", background: "#f8fafc", borderRadius: 8 }}>
                {p.img_url ? (
                  <img src={p.img_url} alt={p.part_num} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }} />
                ) : (
                  <span style={{ fontSize: 12, color: "#94a3b8" }}>no image</span>
                )}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>
                  {p.name || "Unnamed part"} ({p.part_num})
                </div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>Color: {p.color_id} • Qty: {p.qty_total}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}