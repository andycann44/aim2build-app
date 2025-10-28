import { useState } from "react";
import { api } from "../lib/api";

type MissingRow = { part_num:string; color_id:number; need:number };
type Result = { set_num:string; coverage_pct:number; buildable:boolean; missing:MissingRow[] };
type Resp = { results: Result[] };

function normalizeSetNum(s: string) {
  const t = s.trim();
  if (!t) return "";
  return /-/.test(t) ? t : `${t}-1`; // auto add suffix if user typed just the number
}

export default function Buildability(){
  const [rawTargets,setRawTargets]=useState("");
  const [data,setData]=useState<Resp|null>(null);
  const [msg,setMsg]=useState("");
  const [busy,setBusy]=useState(false);
  const [expanded,setExpanded]=useState<Record<string,boolean>>({});
  const [limit]=useState(25);

  async function go(){
    setBusy(true); setMsg(""); setData(null);
    try{
      const tokens = rawTargets.split(",").map(t=>normalizeSetNum(t)).filter(Boolean);
      if (tokens.length===0) { setMsg("Enter at least one set, e.g. 21330 or 21330-1"); return; }
      const q = tokens.map(t=>`targets=${encodeURIComponent(t)}`).join("&");
      const r: Resp = await api(`/api/v1/buildability/sets?${q}`);
      setData(r);
    }catch(e:any){
      setMsg(e?.message || String(e));
    }finally{ setBusy(false); }
  }

  function toggle(setNum:string){ setExpanded(x=>({ ...x, [setNum]: !x[setNum] })); }

  return (
    <div style={{padding:16}}>
      <h3>Buildability</h3>
      <div style={{display:"flex", gap:8, alignItems:"center", marginBottom:8}}>
        <input
          style={{minWidth:360}}
          placeholder="e.g. 21330,31120-1,75257-1"
          value={rawTargets}
          onChange={e=>setRawTargets(e.target.value)}
          onKeyDown={e=>{ if(e.key==="Enter") go(); }}
        />
        <button onClick={go} disabled={busy}>Check</button>
        {busy && <span>Checking…</span>}
      </div>

      {msg && <div style={{border:"1px solid #f5c2c7", background:"#f8d7da", color:"#842029", padding:8, borderRadius:6, maxWidth:650}}>
        {msg}
      </div>}

      {data?.results?.length ? (
        <div style={{display:"grid", gap:12, maxWidth:900}}>
          {data.results.map(res=>{
            const missingCount = res.missing?.length || 0;
            const pct = res.coverage_pct ?? 0;
            const buildable = res.buildable;
            const open = !!expanded[res.set_num];
            const rows = res.missing?.slice(0, open ? undefined : limit) || [];
            return (
              <div key={res.set_num} style={{border:"1px solid #ddd", borderRadius:10, padding:12}}>
                <div style={{display:"flex", justifyContent:"space-between", alignItems:"center", gap:12}}>
                  <div style={{fontWeight:700}}>{res.set_num}</div>
                  <div title={`${pct}%`}>
                    <div style={{width:240, height:10, background:"#eee", borderRadius:6, overflow:"hidden"}}>
                      <div style={{width:`${Math.min(100,pct)}%`, height:"100%", background: buildable ? "#16a34a" : "#f59e0b"}}/>
                    </div>
                  </div>
                  <div style={{minWidth:80, textAlign:"right"}}>{pct}%</div>
                  <div style={{opacity:.8}}>{buildable ? "✅ Buildable" : `❌ Missing ${missingCount} parts`}</div>
                  {missingCount>0 && (
                    <button onClick={()=>toggle(res.set_num)} style={{marginLeft:"auto"}}>
                      {open ? "Hide missing" : `Show missing (${rows.length} of ${missingCount})`}
                    </button>
                  )}
                </div>
                {missingCount>0 && open && (
                  <div style={{marginTop:10}}>
                    <table style={{width:"100%", borderCollapse:"collapse"}}>
                      <thead>
                        <tr>
                          <th style={{textAlign:"left", borderBottom:"1px solid #ddd", padding:"6px 4px"}}>Part</th>
                          <th style={{textAlign:"left", borderBottom:"1px solid #ddd", padding:"6px 4px"}}>Color ID</th>
                          <th style={{textAlign:"right", borderBottom:"1px solid #ddd", padding:"6px 4px"}}>Need</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((m, i)=>(
                          <tr key={i}>
                            <td style={{padding:"4px"}}>{m.part_num}</td>
                            <td style={{padding:"4px"}}>{m.color_id}</td>
                            <td style={{padding:"4px", textAlign:"right"}}>{m.need}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {missingCount>limit && (
                      <div style={{marginTop:6, opacity:.8}}>Showing {limit} of {missingCount}</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
