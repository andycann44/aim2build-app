import React from "react";
import { api } from "../lib/api";

type PartRow = {
  part_num: string;
  part_name: string;
  color_id: number;
  color_name: string;
  img_url?: string;
  qty: number;
};

export default function Inventory(){
  const [rows, setRows] = React.useState<PartRow[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [minQty, setMinQty] = React.useState(1);
  const [q, setQ] = React.useState("");

  async function load(){
    setBusy(true);
    try{
      const data = await api(`/api/inventory/parts?min_qty=${minQty}&q=${encodeURIComponent(q)}`);
      setRows(Array.isArray(data) ? data : []);
    } finally {
      setBusy(false);
    }
  }

  async function rebuild(){
    setBusy(true);
    try{
      await api(`/api/inventory/rebuild`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  }

  React.useEffect(()=>{ load(); }, []); // initial

  return (
    <div style={{padding:16}}>
      <h3>Inventory Parts {busy && <small style={{opacity:.6}}>(working…)</small>}</h3>

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
              <div style={{opacity:.75, fontSize:13}}>Color: {r.color_name} · Qty: {r.qty}</div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
