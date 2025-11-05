import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";

type Saved = { set_num: string; name: string; year?: number; img_url?: string; num_parts?: number };

export default function Buildability() {
  const [rows, setRows] = useState<Saved[]>([]);
  const [busy, setBusy] = useState(false);
  const [big, setBig] = useState<boolean>(() => localStorage.getItem("a2b.bigTiles")==="1");
  const [showMySets, setShowMySets] = useState<boolean>(() => {
    const v = localStorage.getItem("a2b.build.showMySets");
    return v === null ? true : v === "1";
  });
  const nav = useNavigate();
  const cardSize = useMemo(()=> big ? {w:140,h:110} : {w:96,h:72}, [big]);

  async function load(){
    if (!showMySets) { setRows([]); return; }
    setBusy(true);
    try{
      // NOTE: dash + trailing slash
      const data = await api(`/api/my-sets/`);
      const list = Array.isArray(data) ? data : (data?.sets ?? []);
      setRows(Array.isArray(list) ? list : []);
    } finally { setBusy(false); }
  }

  useEffect(()=>{ load(); }, []);
  useEffect(()=>{ localStorage.setItem("a2b.bigTiles", big ? "1" : "0"); }, [big]);
  useEffect(()=>{ localStorage.setItem("a2b.build.showMySets", showMySets ? "1" : "0"); load(); }, [showMySets]);

  return (
    <div style={{padding:16}}>
      <h3>Buildability {busy && <small style={{opacity:.6}}>(loading…)</small>}</h3>

      <div style={{display:"flex", gap:16, alignItems:"center", margin:"8px 0 4px", flexWrap:"wrap"}}>
        <label style={{display:"inline-flex", alignItems:"center", gap:6}}>
          <input type="checkbox" checked={big} onChange={e=>setBig(e.target.checked)}/> Bigger tiles
        </label>
        <label style={{display:"inline-flex", alignItems:"center", gap:6}}>
          <input type="checkbox" checked={showMySets} onChange={e=>setShowMySets(e.target.checked)}/> Show My Sets
        </label>
        <div style={{opacity:.7}}>Double-click a set to open compare.</div>
      </div>

      {showMySets && !rows.length && !busy && (
        <div style={{opacity:.7, marginTop:8}}>No sets yet. Add from Search.</div>
      )}
      {!showMySets && <div style={{opacity:.7, marginTop:8}}>My Sets hidden (toggle above).</div>}

      {showMySets && (
        <ul style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12, listStyle:"none", padding:0, marginTop:12}}>
          {rows.map(r => (
            <li key={r.set_num}
                role="button" tabIndex={0}
                onDoubleClick={()=>nav(`/buildability/compare/${encodeURIComponent(r.set_num)}`)}
                onKeyDown={(e)=>{ if(e.key==="Enter") nav(`/buildability/compare/${encodeURIComponent(r.set_num)}`); }}
                style={{border:"1px solid #ddd", borderRadius:12, padding:10, display:"flex", gap:12, alignItems:"center", background:"#fff", cursor:"pointer"}}>
              <div style={{width:cardSize.w, height:cardSize.h, display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f5", borderRadius:8}}>
                {r.img_url ? <img src={r.img_url} alt={r.name} style={{maxWidth:"100%", maxHeight:"100%", objectFit:"cover"}}/> : null}
              </div>
              <div style={{flex:1}}>
                <div style={{fontWeight:600}}>{r.name} <span style={{opacity:.6}}>({r.set_num})</span></div>
                <div style={{opacity:.75, fontSize:13}}>{r.year ?? ""}</div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
