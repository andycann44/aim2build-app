import { useState } from "react";
import { api, img } from "../lib/api";
type Result = { set_num: string; name?: string; year?: number; img_url?: string };

export default function SetsSearch(){
  const [q,setQ]=useState(""); 
  const [results,setResults]=useState<Result[]>([]);
  const [busy,setBusy]=useState(false); 
  const [toast,setToast]=useState("");

  const go=async()=>{
    if(!q.trim()) return;
    setBusy(true);
    try{
      const data = await api(`/api/rebrickable/search_sets?q=${encodeURIComponent(q)}`);
      setResults(data?.results ?? []);
    } finally { setBusy(false); }
  };

  const add=async (r: Result)=>{
    await api("/api/owned_sets",{method:"POST",body:JSON.stringify(r)});
    const b = await api(`/api/v1/buildability/sets?targets=${encodeURIComponent(r.set_num)}`);
    const pct = b?.results?.[0]?.coverage_pct ?? 0;
    setToast(`Added ${r.set_num} — buildability now ${pct}%`); setTimeout(()=>setToast(""),2500);
  };

  return <div style={{padding:16}}>
    <h3>Search Sets</h3>
    <input value={q} onChange={e=>setQ(e.target.value)} placeholder="e.g. train" /> 
    <button onClick={go} disabled={!q||busy}>Search</button>
    {toast && <div style={{marginTop:8, padding:8, border:"1px solid #ccc"}}>{toast}</div>}
    <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:12,marginTop:12}}>
      {results.map(r=>(
        <div key={r.set_num} style={{border:"1px solid #ddd",borderRadius:8,padding:10}}>
          <div style={{height:140,display:"flex",alignItems:"center",justifyContent:"center",background:"#fafafa"}}>
            {r.img_url ? <img src={img(r.img_url)} alt={r.name||r.set_num} style={{maxHeight:140,maxWidth:"100%"}}/> : <div style={{width:80,height:50,background:"#ff2d2d"}}/>}
          </div>
          <div style={{marginTop:8}}><strong>{r.set_num}</strong></div>
          <div>{r.name}</div>
          <div>{r.year??"—"}</div>
          <button onClick={()=>add(r)} style={{marginTop:8}}>Add to Owned</button>
        </div>
      ))}
    </div>
  </div>;
}
