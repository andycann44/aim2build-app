import React, { useEffect, useRef, useState } from "react";

type RawItem = { set_num: string; name?: string; year?: number; img_url?: string; set_img_url?: string; [k:string]:any };
type Result  = { set_num: string; name?: string; year?: number; img_url?: string };

const API = (import.meta as any)?.env?.VITE_API_BASE || "http://127.0.0.1:8000";
const LS_KEY_Q = "a2b:lastSearchQ";
const LS_KEY_RESULTS = "a2b:lastSearchResults";

function extractItems(data:any): RawItem[] {
  if (Array.isArray(data)) return data;
  if (data?.items && Array.isArray(data.items)) return data.items;
  if (data?.results && Array.isArray(data.results)) return data.results;
  if (data?.sets && Array.isArray(data.sets)) return data.sets;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [];
}
function normalize(items: RawItem[]): Result[] {
  return (items||[]).map(s=>({ set_num: s.set_num, name: s.name, year: s.year, img_url: s.img_url || s.set_img_url || "" }));
}

export default function SetsSearch(){
  const [q,setQ]=useState(""); const [results,setResults]=useState<Result[]>([]);
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const [didRequest,setDidRequest]=useState(false);
  const reqToken=useRef(0); const abortRef=useRef<AbortController|null>(null);

  useEffect(()=>{ try{
    const lastQ=localStorage.getItem(LS_KEY_Q)||""; const lastR=localStorage.getItem(LS_KEY_RESULTS);
    if(lastQ) setQ(lastQ);
    if(lastR){ const p=JSON.parse(lastR); if(Array.isArray(p)) setResults(p as Result[]); }
  }catch{} },[]);

  const go=async()=>{ const query=q.trim(); if(!query) return;
    abortRef.current?.abort(); const controller=new AbortController(); abortRef.current=controller;
    const my=++reqToken.current; setBusy(true); setError("");
    try{
      const url=`${API}/api/sets/search_sets?q=${encodeURIComponent(query)}&limit=100`;
      const r=await fetch(url,{headers:{Accept:"application/json"},signal:controller.signal});
      if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      const data=await r.json(); const items=normalize(extractItems(data));
      if(my!==reqToken.current) return;
      setResults(items); setDidRequest(true);
      try{ localStorage.setItem(LS_KEY_Q,query); localStorage.setItem(LS_KEY_RESULTS,JSON.stringify(items)); }catch{}
    }catch(e:any){ if(e?.name==="AbortError") return; setError(e?.message||String(e)); setDidRequest(true);
    }finally{ if(my===reqToken.current) setBusy(false); }
  };

  return (<div style={{padding:16}}>
    <h3 style={{marginTop:0}}>Search Sets</h3>
    <div style={{display:'flex',gap:8,alignItems:'center'}}>
      <input value={q} onChange={e=>setQ(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()}
             placeholder="e.g. train, castle, 10220" style={{padding:'6px 8px',width:320}} />
      <button onClick={go} disabled={!q.trim()||busy}>Search</button>
      <button onClick={()=>{setQ('');setResults([]);setError('');setDidRequest(false);abortRef.current?.abort();
        try{localStorage.removeItem(LS_KEY_Q);localStorage.removeItem(LS_KEY_RESULTS);}catch{} }} disabled={busy}>Clear</button>
    </div>
    {busy && <p style={{marginTop:12}}>Searching…</p>}
    {error && <p style={{marginTop:12,color:'#b00'}}>Error: {error}</p>}
    <div style={{marginTop:16}}>
      {results.length>0 ? (<>
        <div style={{marginBottom:8,color:'#555'}}>{results.length} result{results.length!==1?'s':''}</div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
          {results.map(s=>(
            <div key={s.set_num} style={{border:'1px solid #e5e5e5',borderRadius:8,overflow:'hidden',background:'#fff'}}>
              <div style={{padding:'10px 12px 0 12px'}}><div style={{fontWeight:600}}>{s.set_num}</div>
                <div style={{color:'#111'}}>{s.name}</div>{s.year?<div style={{color:'#666',fontSize:12}}>{s.year}</div>:null}</div>
              {s.img_url ? <img src={s.img_url} alt={s.name||s.set_num} loading="lazy"
                style={{width:'100%',height:120,objectFit:'cover',display:'block',marginTop:8}}/> :
                <div style={{width:'100%',height:120,background:'#f2f2f2',display:'flex',alignItems:'center',justifyContent:'center',marginTop:8,color:'#999',fontSize:12}}>No image</div>}
              <div style={{padding:'10px 12px'}}><button title="Add to My Sets" disabled>+ Add to My Sets</button></div>
            </div>))}
        </div></>) : (!busy && !error && didRequest ? <p style={{color:'#666'}}>No results.</p> : null)}
    </div>
  </div>);
}
