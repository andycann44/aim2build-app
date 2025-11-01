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

function suggestQuery(raw: string): { alt: string; changed: boolean } {
  const q = (raw || '').trim();
  if (!q) return { alt: q, changed: false };
  // Common LEGO search term fixes (extendable)
  const DICT: Record<string,string> = {
    'dail': 'daily',
    'bugel': 'bugle',
    'bugal': 'bugle',
    'castel': 'castle',
    'modulars': 'modular',
    'starwars': 'star wars',
    'star-war': 'star wars',
    'harry poter': 'harry potter',
    'harry poter': 'harry potter',
    'technic': 'technic',
  };
  const parts = q.split(/\s+/).map(p => {
    const low = p.toLowerCase();
    if (DICT[low]) return DICT[low];
    // tiny heuristic: add missing 'y' when word ends with 'dail'
    if (low.endsWith('dail')) return p + 'y';
    return p;
  });
  const alt = parts.join(' ');
  return { alt, changed: alt.toLowerCase() !== q.toLowerCase() };
}

export default function SetsSearch(){
  const [q,setQ]=useState(""); const [results,setResults]=useState<Result[]>([]);
  const [busy,setBusy]=useState(false); const [error,setError]=useState("");
  const [shownQ, setShownQ] = useState<string>('');
  const [hint, setHint] = useState<string>('');
  const [didRequest,setDidRequest]=useState(false);
  const reqToken=useRef(0); const abortRef=useRef<AbortController|null>(null);

  useEffect(()=>{ try{
    const lastQ=localStorage.getItem(LS_KEY_Q)||""; const lastR=localStorage.getItem(LS_KEY_RESULTS);
    if(lastQ) setQ(lastQ);
    if(lastR){ const p=JSON.parse(lastR); if(Array.isArray(p)) setResults(p as Result[]); }
  }catch{} },[]);

  const go=async()=>{ const query=q.trim(); if(!query) return;
    setHint('');
    setShownQ(query);
    abortRef.current?.abort(); const controller=new AbortController(); abortRef.current=controller;
    const my=++reqToken.current; setBusy(true); setError("");
    try{
      const url = `${API}/api/sets/search_sets?q=${encodeURIComponent(query)}&limit=100`;
      let r = await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      let data = await r.json();
      let items = normalize(extractItems(data));

      // If nothing found, try a gentle suggestion
      if (items.length === 0) {
        const { alt, changed } = suggestQuery(query);
        if (changed) {
          const url2 = `${API}/api/sets/search_sets?q=${encodeURIComponent(alt)}&limit=100`;
          r = await fetch(url2, { headers: { Accept: "application/json" }, signal: controller.signal });
          if (r.ok) {
            data = await r.json();
            const items2 = normalize(extractItems(data));
            if (items2.length > 0) {
              items = items2;
              setHint(`Showing results for "${alt}" (from "${query}")`);
              setShownQ(alt);
            }
          }
        }
      }

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
    {!!hint && <div style={{marginTop:6, fontSize:12, color:'#6b7280'}}>{hint}</div>}
    {busy && <p style={{marginTop:12}}>Searching…</p>}
    {error && <p style={{marginTop:12,color:'#b00'}}>Error: {error}</p>}
    <div style={{marginTop:16}}>
      {results.length>0 ? (<>
        <div style={{marginBottom:8,color:'#555'}}>{results.length} result{results.length!==1?'s':''}</div>
        <div className="results-grid" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:12}}>
          {results.map(s=>(
            <div key={s.set_num} className="set-card" style={{border:'1px solid #e5e5e5',borderRadius:8,overflow:'hidden',background:'#fff'}}>
              <div style={{padding:'10px 12px 0 12px'}}><div style={{fontWeight:600}}>{s.set_num}</div>
                <div style={{color:'#111'}}>{s.name}</div>{s.year?<div style={{color:'#666',fontSize:12}}>{s.year}</div>:null}</div>
              <div className="set-thumb" style={{marginTop:8}}>
                {s.img_url ? (
                  <img
                    src={s.img_url}
                    alt={s.name||s.set_num}
                    loading="lazy"
                  />
                ) : (
                  <div className="no-thumb">No image</div>
                )}
              </div>
              <div style={{padding:'10px 12px'}}><button title="Add to My Sets" disabled>+ Add to My Sets</button></div>
            </div>))}
        </div></>) : (!busy && !error && didRequest ? <p style={{color:'#666'}}>No results.</p> : null)}
    </div>
    <style>{`
      /* Uniform card sizing + natural thumbnails */
      .results-grid { --thumb-max: 160px; }
      .set-card { display:flex; flex-direction:column; }
      .set-thumb { width:100%; height: var(--thumb-max); display:flex; align-items:center; justify-content:center; background:#fff; }
      .set-thumb > img { max-width:100%; max-height: var(--thumb-max); width:auto; height:auto; display:block; }
      .no-thumb { color:#999; font-size:12px; padding:24px 0; }
    `}</style>
  </div>);
}
