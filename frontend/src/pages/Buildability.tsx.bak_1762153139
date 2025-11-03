import React from "react";
import { API } from "../lib/api";

type CompareTotals = {
  need_total: number;
  have_total: number;
  missing_total: number;
  cover_pct: number;
};

type CompareRow = {
  part_num: string;
  part_name?: string;
  color_id: number;
  color_name?: string;
  need: number;
  have: number;
  missing: number;
  img_url?: string;
};

export default function Buildability() {
  const [setNum, setSetNum] = React.useState("21330-1");
  const [busy, setBusy] = React.useState(false);
  const [totals, setTotals] = React.useState<CompareTotals | null>(null);
  const [rows, setRows] = React.useState<CompareRow[]>([]);
  const [showMissingOnly, setShowMissingOnly] = React.useState(false);

  // Use shared API base (defaults to http://127.0.0.1:8000 if not provided)
  const base = API;

  async function runCompare(num = setNum) {
    setBusy(true);
    try {
      const set = (num || "").trim();
      if (!set) throw new Error("No set number provided.");

      const url = `${base}/api/buildability/compare?set_num=${encodeURIComponent(set)}`;
      const res = await fetch(url);
      const ct = res.headers.get("content-type") || "";
      const text = await res.text();

      if (!res.ok) {
        throw new Error(`HTTP ${res.status} — ${text.slice(0, 300)}`);
      }
      if (!ct.includes("application/json")) {
        throw new Error(`Non-JSON response: ${text.slice(0, 300)}`);
      }

      const j = JSON.parse(text);
      const nextTotals = (j && j.totals) ? (j.totals as CompareTotals) : null;
      const nextRows = Array.isArray(j?.rows) ? (j.rows as CompareRow[]) : [];

      setTotals(nextTotals);
      setRows(nextRows);
    } catch (e: any) {
      console.error(e);
      alert(`Could not run compare. ${e?.message || e}`);
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(() => {
    // auto-run once with default
    runCompare().catch(()=>{});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = showMissingOnly ? rows.filter(r => r.missing > 0) : rows;
  const cover = totals?.cover_pct ?? 0;

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ marginBottom: 8 }}>Buildability {busy && <small style={{opacity:.6}}>(working…)</small>}</h3>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
        <label>Set&nbsp;
          <input value={setNum} onChange={e=>setSetNum(e.target.value)} placeholder="e.g. 21330-1"
                 style={{ padding:"8px 10px", border:"1px solid #ddd", borderRadius:8, width:160 }}/>
        </label>
        <button onClick={()=>runCompare()} disabled={busy}
                style={{ padding:"8px 12px", borderRadius:8 }}>Compare</button>
        <label style={{ display:"inline-flex", alignItems:"center", gap:6, marginLeft:12 }}>
          <input type="checkbox" checked={showMissingOnly} onChange={e=>setShowMissingOnly(e.currentTarget.checked)} />
          Show missing only
        </label>
        {totals && (
          <span style={{ marginLeft: 8, opacity:.8 }}>
            Need {totals.need_total} • Have {totals.have_total} • Missing {totals.missing_total}
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ margin:"8px 0 16px 0" }}>
        <div style={{ height: 14, background:"#eee", borderRadius: 999, overflow:"hidden" }}>
          <div style={{
            height: "100%",
            width: `${cover}%`,
            background: cover >= 100 ? "#16a34a" : (cover >= 50 ? "#f59e0b" : "#ef4444")
          }} />
        </div>
        <div style={{ fontSize: 13, marginTop: 6, opacity:.8 }}>
          Coverage: {cover.toFixed(1)}%
        </div>
      </div>

      {/* Legend */}
      <div style={{ display:"flex", gap:16, fontSize:13, marginBottom:8 }}>
        <span><span style={{display:"inline-block", width:10, height:10, background:"#16a34a", marginRight:6}}/> covered</span>
        <span><span style={{display:"inline-block", width:10, height:10, background:"#f59e0b", marginRight:6}}/> partial</span>
        <span><span style={{display:"inline-block", width:10, height:10, background:"#ef4444", marginRight:6}}/> missing</span>
      </div>

      {/* Grid */}
      <ul style={{
        listStyle:"none", padding:0, margin:0,
        display:"grid", gap:12, gridTemplateColumns:"repeat(auto-fill, minmax(360px, 1fr))"
      }}>
        {filtered.map((r, i) => {
          const pct = r.need ? Math.min(100, Math.max(0, (Math.min(r.have, r.need) / r.need) * 100)) : 0;
          const bar = pct >= 100 ? "#16a34a" : (pct >= 50 ? "#f59e0b" : "#ef4444");
          return (
            <li key={r.part_num + ":" + r.color_id + ":" + i}
                style={{ border:"1px solid #e5e7eb", borderRadius:12, background:"#fff", padding:12, display:"flex", gap:12 }}>
              <div style={{ width:96, height:72, background:"#f5f5f5", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center" }}>
                {r.img_url ? <img src={r.img_url} alt={r.part_name||r.part_num} style={{maxWidth:"100%", maxHeight:"100%", objectFit:"contain"}}/> : null}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                  {r.part_name || "Part"} <span style={{ opacity:.6 }}>({r.part_num})</span>
                </div>
                <div style={{ fontSize:12, opacity:.75, margin:"2px 0 6px 0" }}>
                  Color: {r.color_name || r.color_id}
                </div>
                <div style={{ fontSize:13, marginBottom:6 }}>
                  Need <b>{r.need}</b> • Have <b>{r.have}</b> • Missing <b style={{color: r.missing>0 ? "#ef4444" : "#16a34a"}}>{r.missing}</b>
                </div>
                <div style={{ height: 8, background:"#eee", borderRadius:999, overflow:"hidden" }}>
                  <div style={{ height:"100%", width:`${pct}%`, background: bar }} />
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {!filtered.length && (
        <div style={{ opacity:.7, marginTop:8 }}>
          {busy ? "Working…" : "No rows. Try a different set number or uncheck “missing only”."}
        </div>
      )}
    </div>
  );
}
