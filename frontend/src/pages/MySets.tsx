// TARGET PATH: frontend/src/pages/MySets.tsx
import React, { useEffect, useMemo, useState } from "react";

const API = (import.meta as any)?.env?.VITE_API_BASE || "http://127.0.0.1:8000";

type Saved = { set_num: string; name: string; year?: number; img_url?: string; num_parts?: number; in_inventory?: boolean };

export default function MySets(){
  const [rows, setRows] = useState<Saved[]>([]);
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState<boolean>(() => localStorage.getItem("a2b.bigTiles")==="1");

  const cardSize = useMemo(()=> big ? {w:140,h:110} : {w:96,h:72}, [big]);

  async function load(){
    setBusy(true);
    try{
      const res = await fetch(`${API}/api/my-sets/`);
      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : (raw?.sets ?? []);
      setRows(Array.isArray(list) ? list : []);
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => { localStorage.setItem("a2b.bigTiles", big ? "1" : "0"); }, [big]);

  async function onChangeTick(s: Saved, next: boolean){
    const r = await fetch(`${API}/api/inventory/toggle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        set_num: s.set_num,
        on: next,
        name: s.name,
        year: s.year,
        img_url: s.img_url,
        num_parts: s.num_parts,
      }),
    });
    if (!r.ok){
      alert("Could not update inventory. Please try again.");
      return;
    }
    setRows(prev => prev.map(x => x.set_num === s.set_num ? { ...x, in_inventory: next } : x));
  }

  async function remove(set_num: string){
    await fetch(`${API}/api/my-sets/${encodeURIComponent(set_num)}`, { method: "DELETE" });
    setRows(prev => prev.filter(x => x.set_num !== set_num));
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
                  checked={!!r.in_inventory}
                  onChange={e=>onChangeTick(r, e.target.checked)}
                />
                In Inventory
              </label>
            </div>
            <button onClick={()=>remove(r.set_num)} style={{padding:"8px 10px", borderRadius:8}}>
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
