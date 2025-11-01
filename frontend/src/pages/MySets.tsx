import React, { useEffect, useState } from "react";
import { api } from "../lib/api";

type Saved = { set_num: string; name: string; year?: number; img_url?: string; num_parts?: number };

export default function MySets(){
  const [rows, setRows] = useState<Saved[]>([]);
  const [busy, setBusy] = useState(false);

  async function load(){
    setBusy(true);
    try{
      const data = await api(`/api/my-sets/`);
      const list = Array.isArray(data) ? data : (data?.sets ?? []);
      setRows(Array.isArray(list) ? list : []);
    } finally {
      setBusy(false);
    }
  }

  async function del(set_num: string){
    await api(`/api/my-sets/${encodeURIComponent(set_num)}`, { method: "DELETE" });
    load();
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{padding:16}}>
      <h3>My Sets {busy && <small style={{opacity:.6}}>(loading…)</small>}</h3>
      {!rows.length && <div style={{opacity:.7, marginTop:8}}>No sets yet. Add from Search.</div>}
      <ul style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12, listStyle:"none", padding:0, marginTop:12}}>
        {rows.map(r => (
          <li key={r.set_num} style={{border:"1px solid #ddd", borderRadius:12, padding:10, display:"flex", gap:12, alignItems:"center", background:"#fff"}}>
            <div style={{width:96, height:72, display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f5", borderRadius:8}}>
              {r.img_url ? (
                <img
                  src={r.img_url}
                  alt={r.name}
                  style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "cover" }}
                />
              ) : null}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600}}>{r.name} <span style={{opacity:.6}}>({r.set_num})</span></div>
              <div style={{opacity:.75, fontSize:13}}>{r.year ?? ""}</div>
            </div>
            <button onClick={() => del(r.set_num)} style={{padding:"8px 10px", borderRadius:8}}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
