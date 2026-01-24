import { useEffect, useMemo, useState } from "react";
import SafeImg from "../components/SafeImg";

const API = import.meta.env.VITE_API_BASE || "";

function getKey() {
  return localStorage.getItem("a2b_admin_key") || "";
}

export default function AdminPage() {
  const [key, setKey] = useState(getKey());
  const [stats, setStats] = useState<any>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [mode, setMode] = useState<"best" | "raw">("best");
  const [filter, setFilter] = useState<"live" | "dead" | "unchecked" | "all">("live");
  const [offset, setOffset] = useState(0);
  const [msg, setMsg] = useState("");
  const limit = 120;

  const headers = useMemo(() => ({ "X-Admin-Key": key }), [key]);

  const loadStats = async () => {
    setMsg("Loading stats...");
    const r = await fetch(`${API}/api/admin/catalog/stats`, { headers });
    const j = await r.json();
    setStats(j);
    setMsg(r.ok ? "OK" : `Error: ${j?.detail || r.status}`);
  };

  const loadSample = async () => {
    setMsg("Loading sample...");
    const qs = new URLSearchParams({
      mode,
      filter,
      limit: String(limit),
      offset: String(offset),
    });
    const r = await fetch(`${API}/api/admin/catalog/sample?${qs.toString()}`, { headers });
    const j = await r.json();
    setRows(Array.isArray(j) ? j : []);
    setMsg(r.ok ? "OK" : `Error: ${j?.detail || r.status}`);
  };

  const rebuildViews = async () => {
    if (!confirm("Rebuild catalog views now?")) return;
    setMsg("Rebuilding views...");
    const r = await fetch(`${API}/api/admin/catalog/rebuild-views`, { method: "POST", headers });
    const j = await r.json();
    setMsg(r.ok ? "OK" : `Error: ${j?.detail || r.status}`);
  };

  const audit = async (onlyUnchecked: boolean) => {
    const label = onlyUnchecked ? "Audit (unchecked only)" : "Audit (bounded, includes checked)";
    const ok = prompt(`${label}\nType RUN to confirm`, "") === "RUN";
    if (!ok) return;

    setMsg("Running audit...");
    const qs = new URLSearchParams({
      only_unchecked: String(onlyUnchecked),
      max_rows: String(500),
      parallel: String(12),
    });

    const r = await fetch(`${API}/api/admin/catalog/audit-images?${qs.toString()}`, { method: "POST", headers });
    const j = await r.json();
    setMsg(r.ok ? `OK: checked=${j.checked} dead=${j.dead} live=${j.live}` : `Error: ${j?.detail || r.status}`);
    await loadStats();
  };

  useEffect(() => {
    // do nothing until key is set
  }, []);

  return (
    <div style={{ padding: 16 }}>
      <h2 style={{ margin: "0 0 10px 0" }}>Aim2Build Admin</h2>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
        <label style={{ fontSize: 13 }}>
          Admin Key{" "}
          <input
            value={key}
            onChange={(e) => setKey(e.target.value)}
            onBlur={() => localStorage.setItem("a2b_admin_key", key)}
            placeholder="AIM2BUILD_ADMIN_KEY"
            style={{ width: 340 }}
          />
        </label>

        <button
          onClick={() => {
            localStorage.setItem("a2b_admin_key", key);
            loadStats();
          }}
        >
          Load Stats
        </button>

        <button onClick={rebuildViews}>Rebuild Views</button>

        <button onClick={() => audit(true)}>Audit Unchecked (500)</button>
        <button onClick={() => audit(false)}>Audit Bounded (500)</button>
      </div>

      {msg && <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 12 }}>{msg}</div>}

      {stats && (
        <div style={{ fontSize: 13, marginBottom: 12 }}>
          total: {stats.total} | live: {stats.live} | dead: {stats.dead} | unchecked: {stats.unchecked}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 12 }}>
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
        <button onClick={loadSample}>Load Sample</button>

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
