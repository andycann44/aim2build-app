import { useEffect, useMemo, useState } from "react";
import SafeImg from "../components/SafeImg";

const API = import.meta.env.VITE_API_BASE || "";

type Stats = { total: number; live: number; dead: number; unchecked: number };

export default function DebugCatalogImagesPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [mode, setMode] = useState<"best" | "raw">("best");
  const [filter, setFilter] = useState<"live" | "dead" | "unchecked" | "all">("live");
  const [offset, setOffset] = useState(0);
  const limit = 120;

  const url = useMemo(() => {
    const qs = new URLSearchParams({
      mode,
      filter,
      limit: String(limit),
      offset: String(offset),
    });
    return `${API}/api/catalog/images/sample?${qs.toString()}`;
  }, [mode, filter, offset]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    fetch(`${API}/api/catalog/images/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => setStats(null));
  }, []);

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    fetch(url)
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setRows([]));
  }, [url]);

  if (!import.meta.env.DEV) {
    return <div style={{ padding: 16 }}>Not available</div>;
  }

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: "0 0 8px 0" }}>Catalog Images (Debug)</h2>

      {stats && (
        <div style={{ marginBottom: 12, fontSize: 13 }}>
          total: {stats.total} | live: {stats.live} | dead: {stats.dead} | unchecked: {stats.unchecked}
        </div>
      )}

      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
        <label style={{ fontSize: 13 }}>
          mode{" "}
          <select value={mode} onChange={(e) => { setMode(e.target.value as any); setOffset(0); }}>
            <option value="best">best (element_best_image)</option>
            <option value="raw">raw (element_images)</option>
          </select>
        </label>

        <label style={{ fontSize: 13 }}>
          filter{" "}
          <select value={filter} onChange={(e) => { setFilter(e.target.value as any); setOffset(0); }}>
            <option value="live">live</option>
            <option value="dead">dead</option>
            <option value="unchecked">unchecked</option>
            <option value="all">all</option>
          </select>
        </label>

        <button onClick={() => setOffset((o) => Math.max(0, o - limit))}>Prev</button>
        <button onClick={() => setOffset((o) => o + limit)}>Next</button>

        <div style={{ fontSize: 12, opacity: 0.8 }}>offset: {offset}</div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, 110px)", gap: 10 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ fontSize: 10, textAlign: "center" }}>
            <div style={{ width: 100, height: 100, margin: "0 auto" }}>
              <SafeImg src={r.img_url} alt="" />
            </div>
            <div>{r.part_num}</div>
            <div>{r.color_id}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
