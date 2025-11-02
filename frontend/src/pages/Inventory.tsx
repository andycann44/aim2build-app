import React from "react";
import { api } from "../lib/api";

type PartRow = {
  part_num: string;
  part_name: string;
  color_id: number;
  color_name: string
  img_url?: string;
  qty: number;
};

export default function Inventory(){

  // A2B: inventory summary
  const [invSummary,setInvSummary]=React.useState<{have_total:number;reserved_total:number;free_total:number;distinct_parts_free:number}|null>(null);
  const [freeRows,setFreeRows]=React.useState<any[]|null>(null);
  const [showFree,setShowFree]=React.useState(false);

  React.useEffect(()=>{(async()=>{
  try{
    const data = await api(`/api/inventory/summary`);
    const t = (data?.totals) ?? null;
    setInvSummary(t);
  }catch(e){ console.error(e); }
})()},[]);

  async function loadFree(){
  try{
    const j = await api(`/api/inventory/free?limit=1000`);
    if (j && j.ok){ setFreeRows(j.rows||[]); setShowFree(true); }
  }catch(e){ console.error(e); }
}

  const [rows, setRows] = React.useState<PartRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [minQty, setMinQty] = React.useState(1);
  const [q, setQ] = React.useState("");

  async function load(){
    setBusy(true);
    try{
      const data = await api(`/api/inventory/parts?min_qty=${minQty}&q=${encodeURIComponent(q)}`);
      const arr = Array.isArray(data) ? data : (data?.rows ?? []);
      setRows(arr as PartRow[]);
    } finally {
      setBusy(false);
    }
  }

  async function rebuild(){
    setBusy(true);
    try{
      await api(`/api/inventory/rebuild`, { method: "POST" });
      await load();
      try{
        const data = await api(`/api/inventory/summary`);
        setInvSummary(data?.totals ?? null);
      }catch{}
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(()=>{ load(); }, []); // initial

  return (
    <div style={{padding:16}}>
      <h3>Inventory Parts {busy && <small style={{opacity:.6}}>(working…)</small>}</h3>

      <div style={{ margin:"8px 0 10px 0", fontSize:13, opacity:.85, display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
        {invSummary ? (
          <>
            <span>{`Have ${invSummary.have_total}`}</span>
            <span>• {`Reserved ${invSummary.reserved_total}`}</span>
            <span>• {`Free ${invSummary.free_total}`}</span>
            <span>• {`Distinct ${invSummary.distinct_parts_free}`}</span>
          </>
        ) : (
          <span>Loading totals…</span>
        )}
        <label style={{ display:"inline-flex", alignItems:"center", gap:6 }}>
          <input
            type="checkbox"
            checked={showFree}
            onChange={e=>{ if(e.currentTarget.checked){ loadFree(); } else { setShowFree(false); setFreeRows(null); } }}
          />
          Show free-only summary
        </label>
        {showFree && (
          <span>{`Free bins loaded: ${freeRows?.length ?? 0}`}</span>
        )}
      </div>

      <div style={{display:"flex", gap:8, alignItems:"center", margin:"8px 0"}}>
        <button onClick={rebuild} style={{padding:"8px 12px", borderRadius:8}}>Rebuild from My Sets</button>
        <label> Min qty&nbsp;
          <input type="number" min={1} value={minQty} onChange={e=>setMinQty(parseInt(e.target.value||"1"))} style={{width:64}}/>
        </label>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="filter part name/num" style={{flex:1, padding:"8px 10px", borderRadius:8, border:"1px solid #ddd"}}/>
        <button onClick={load} style={{padding:"8px 12px", borderRadius:8}}>Apply</button>
      </div>

      {!rows.length && <div style={{opacity:.7}}>No parts yet. Click “Rebuild from My Sets”.</div>}

      <ul style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12, listStyle:"none", padding:0, marginTop:12}}>
        {rows.map((r, i) => (
          <li key={r.part_num + ":" + r.color_id + ":" + i}
              style={{border:"1px solid #ddd", borderRadius:12, padding:10, display:"flex", gap:12, alignItems:"center", background:"#fff"}}>
            <div style={{width:96, height:72, display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f5", borderRadius:8}}>
              {r.img_url ? <img src={r.img_url} alt={r.part_name} style={{maxWidth:"100%", maxHeight:"100%", objectFit:"cover"}}/> : null}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600}}>{r.part_name} <span style={{opacity:.6}}>({r.part_num})</span></div>
              <div style={{opacity:.75, fontSize:13}}>Color: {r.color_name} · Qty: {(r as any).qty ?? (r as any).quantity ?? (r as any).qty_free ?? 0}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
