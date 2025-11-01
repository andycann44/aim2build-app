import { useEffect, useState } from "react";
import { api, img } from "../lib/api";
type Owned = { set_num: string; name?: string; year?: number; img_url?: string };

export default function OwnedSets(){
  const [rows,setRows]=useState<Owned[]>([]);
  const load=async()=> setRows(await api("/api/owned_sets"));
  useEffect(()=>{ load(); },[]);
  const del=async (sn:string)=>{ await api(`/api/owned_sets/${encodeURIComponent(sn)}`,{method:"DELETE"}); load(); };
  return <div style={{padding:16}}>
    <h3>My Sets</h3>
    <ul style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12,listStyle:"none",padding:0}}>
      {rows.map(r=>(
        <li key={r.set_num} style={{border:"1px solid #ddd",borderRadius:8,padding:10,display:"flex",gap:12}}>
          <div style={{width:96,height:72,display:"flex",alignItems:"center",justifyContent:"center",background:"#fafafa"}}>
            {r.img_url ? <img src={img(r.img_url)} alt={r.name||r.set_num} style={{maxHeight:72,maxWidth:96}}/> : null}
          </div>
          <div style={{flex:1}}>
            <div><strong>{r.set_num}</strong> — {r.name||"?"} ({r.year??"?"})</div>
            <button onClick={()=>del(r.set_num)} style={{marginTop:8}}>Remove</button>
          </div>
        </li>
      ))}
    </ul>
  </div>;
}
