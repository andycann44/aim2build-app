import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

type Saved = { set_num: string; name: string; year?: number; img_url?: string; num_parts?: number };

export default function MySets(){
  const [rows, setRows] = useState<Saved[]>([]);
  const [busy, setBusy] = useState(false);
  const [inv,  setInv ] = useState<Record<string, boolean>>({});
  const [big, setBig]   = useState<boolean>(() => localStorage.getItem("a2b.bigTiles")==="1");
  const cardSize = useMemo(()=> big ? {w:140,h:110} : {w:96,h:72}, [big]);

  async function load(){
    setBusy(true);
    try{
      // 1) my sets
      const data = await api(`/api/my-sets/`);
      const list = Array.isArray(data) ? data : (data?.sets ?? []);
      const safe = Array.isArray(list) ? list : [];
      setRows(safe);

      // 2) inventory sets (ticks)
      const invData = await api(`/api/inventory/`);
      const ids = new Set<string>((Array.isArray(invData) ? invData : []).map((r:any)=> String(r.set_num)));
      const map: Record<string, boolean> = {};
      safe.forEach(r => { map[r.set_num] = ids.has(r.set_num); });
      setInv(map);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { localStorage.setItem("a2b.bigTiles", big ? "1" : "0"); }, [big]);

  async function toggleInv(item: Saved, on: boolean){
    // optimistic update
    setInv(prev => ({ ...prev, [item.set_num]: on }));
    try{
      const res = await api("/api/inventory/toggle", {
        method: "POST",
        body: JSON.stringify({ ...item, on }),
      });
      if (!res?.ok) throw new Error("toggle failed");

      // harden: re-read server truth to avoid drift
      const invData = await api(`/api/inventory/`);
      const ids = new Set<string>((Array.isArray(invData) ? invData : []).map((r:any)=> String(r.set_num)));
      setInv(prev => ({ ...prev, [item.set_num]: ids.has(item.set_num) }));
      // optional: broadcast so Inventory page refreshes live
      window.dispatchEvent(new CustomEvent("a2p-inventory-updated"));
    } catch {
      // revert on error
      setInv(prev => ({ ...prev, [item.set_num]: !on }));
      alert("Could not update inventory; please try again.");
    }
  }

  return (
    <div style={{padding:16}}>
      <h3>My Sets {busy && <small style={{opacity:.6}}>(loading…)</small>}</h3>

      <div style={{display:"flex", gap:12, alignItems:"center", margin:"8px 0 4px"}}>
        <label style={{display:"inline-flex", alignItems:"center", gap:6}}>
          <input type="checkbox" checked={big} onChange={e=>setBig(e.target.checked)}/> Bigger tiles
        </label>
      </div>

      {!rows.length && <div style={{opacity:.7, marginTop:8}}>No sets yet. Add from Search.</div>}

      <ul style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12, listStyle:"none", padding:0, marginTop:12}}>
        {rows.map(r => (
          <li key={r.set_num} style={{border:"1px solid #ddd", borderRadius:12, padding:10, display:"flex", gap:12, alignItems:"center", background:"#fff"}}>
            <div style={{width:cardSize.w, height:cardSize.h, display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f5", borderRadius:8}}>
              {r.img_url ? <img src={r.img_url} alt={r.name} style={{maxWidth:"100%", maxHeight:"100%", objectFit:"cover"}} /> : null}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600}}>{r.name} <span style={{opacity:.6}}>({r.set_num})</span></div>
              <div style={{opacity:.75, fontSize:13}}>{r.year ?? ""}</div>
              <label style={{display:"inline-flex", alignItems:"center", gap:6, marginTop:8}}>
                <input
                  type="checkbox"
                  checked={!!inv[r.set_num]}
                  onChange={e=>toggleInv(r, e.target.checked)}
                />
                In Inventory
              </label>
            </div>
            <button
              onClick={async ()=>{
                await api(`/api/my-sets/${encodeURIComponent(r.set_num)}`, { method: "DELETE" });
                await load();
              }}
              style={{padding:"8px 10px", borderRadius:8}}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}