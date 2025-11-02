import React from "react";

type SetRow = {
  set_num: string;
  name: string;
  year?: number;
  img_url?: string;
  in_inventory?: boolean;
};

type BuildabilityResp = {
  ok: boolean;
  set_num: string;
  coverage_pct: number;
  missing_count: number;
};

const API = import.meta?.env?.VITE_API_BASE || "http://127.0.0.1:8000";

async function api<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

export default function Buildability() {
    // --- A2B: readiness helper
    const [readyOnly, setReadyOnly] = React.useState(false);
    function statusFor(
      r: { coverage_pct: number; missing_count: number }
    ): { key: "ready" | "almost" | "needs"; label: string } {
      const full = r.coverage_pct >= 100 && r.missing_count === 0;
      if (full) return { key: "ready", label: "Ready to build" };
      if (r.coverage_pct >= 80)
        return { key: "almost", label: `${Math.round(r.coverage_pct)}% · ${r.missing_count} missing` };
      return { key: "needs", label: `${Math.round(r.coverage_pct)}% · ${r.missing_count} missing` };
    }
    // --- A2B end ---

  const [rows, setRows] = React.useState<
    Array<SetRow & { coverage_pct?: number; missing_count?: number }>
  >([]);
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string>("");

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setBusy(true);
        setErr("");

        // 1) get sets, filter to ones marked "In Inventory"
        const sets: SetRow[] = await api<SetRow[]>("/api/my-sets/");
        const invSets = sets.filter((s) => s.in_inventory);

        // 2) for each, call buildability/check (sequential: minimal change, simple)
        const out: Array<SetRow & { coverage_pct?: number; missing_count?: number }> = [];
        for (const s of invSets) {
          try {
            const b = await api<BuildabilityResp>(`/api/buildability/check?set_num=${encodeURIComponent(s.set_num)}`);
            out.push({ ...s, coverage_pct: b.coverage_pct, missing_count: b.missing_count });
          } catch {
            out.push({ ...s, coverage_pct: 0, missing_count: 0 });
          }
        }

        // 3) sort by lowest coverage first
        out.sort((a, b) => (a.coverage_pct ?? 0) - (b.coverage_pct ?? 0));
        if (!cancelled) setRows(out);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "Failed to load.");
      } finally {
        if (!cancelled) setBusy(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <div style={{ padding: 12 }}>
      <h2>Buildability</h2>
<div style={{margin:'8px 0 14px 0'}}>
  <label style={{userSelect:'none'}}>
    <input type="checkbox" style={{marginRight:6}} checked={readyOnly} onChange={e=>setReadyOnly(e.target.checked)} />
    Show ready only
  </label>
</div> {/* A2B: ready-only toggle */}

      {busy && <div>Checking…</div>}
      {err && <div style={{ color: "#b91c1c" }}>{err}</div>}
      {!busy && !err && rows.length === 0 && (
        <div>No sets marked <em>In Inventory</em>. Tick some in <strong>My Sets</strong>, then rebuild inventory.</div>
      )}

      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {rows.map((s) => (
          <li key={s.set_num} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: 12 }}>
            <div style={{ display: "flex", gap: 12 }}>
              <img src={s.img_url || ""} alt={s.name} style={{ width: 96, height: 72, objectFit: "contain" }}
                   onError={(e) => { (e.currentTarget as HTMLImageElement).style.visibility = "hidden"; }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600 }}>{s.name} <span style={{ opacity: 0.6 }}>({s.set_num})</span></div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{s.year || ""}</div>
                <div style={{ marginTop: 6 }}>
                  <span style={{ fontFamily: "monospace" }}>
                    {Math.round(s.coverage_pct ?? 0)}% cover
                  </span>
                  {" · "}
                  <span>{s.missing_count ?? 0} missing</span>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}