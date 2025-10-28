import { useEffect, useState } from "react";
import { api } from "../lib/api";
import PartThumb from "../components/PartThumb";

function Qty(r){ return r.qty_total ?? r.qty ?? r.quantity ?? 0; }

export default function Inventory(){
  const [rows,setRows]=useState([]);
  const [form,setForm]=useState({part_num:"",color_id:"",qty:"1",notes:""});
  const [view,setView]=useState("grid"); // grid | list
  const [size,setSize]=useState(110);    // thumb size

  const load=async()=> setRows(await api("/api/inventory"));
  useEffect(()=>{ load(); },[]);

  const upsert=async()=>{
    await api("/api/inventory",{method:"POST",body:JSON.stringify({
      part_num:form.part_num,
      color_id:form.color_id?Number(form.color_id):null,
      qty:Number(form.qty||0),
      notes:form.notes||null
    })});
    setForm({part_num:"",color_id:"",qty:"1",notes:""});
    load();
  };

  return (
    <div style={{padding:16}}>
      <h3>Inventory</h3>

      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center",marginBottom:10}}>
        <input placeholder="part num" value={form.part_num} onChange={e=>setForm(f=>({...f,part_num:e.target.value}))}/>
        <input placeholder="color id" value={form.color_id} onChange={e=>setForm(f=>({...f,color_id:e.target.value}))}/>
        <input placeholder="qty" value={form.qty} onChange={e=>setForm(f=>({...f,qty:e.target.value}))}/>
        <input placeholder="notes" value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))}/>
        <button onClick={upsert} disabled={!form.part_num}>Save</button>
        <span style={{marginLeft:16,opacity:.7}}>View:</span>
        <button onClick={()=>setView("grid")} disabled={view==="grid"}>Grid</button>
        <button onClick={()=>setView("list")} disabled={view==="list"}>List</button>
        {view==="grid" && (
          <>
            <span style={{marginLeft:12,opacity:.7}}>Size:</span>
            <input type="range" min="80" max="160" step="10" value={size} onChange={e=>setSize(Number(e.target.value))}/>
          </>
        )}
      </div>

      {view==="list" ? (
        <ul>
          {rows.map((r,i)=>(
            <li key={i}>{r.part_num} C{r.color_id??"–"} × {Qty(r)} {r.notes?`— ${r.notes}`:""}</li>
          ))}
        </ul>
      ) : (
        <div style={{
          display:"grid",
          gridTemplateColumns:"repeat(auto-fill, minmax(160px, 1fr))",
          gap:12
        }}>
          {rows.map((r,i)=>(
            <div key={i} style={{
              border:"1px solid #e6e6e6",
              borderRadius:8,
              padding:10,
              display:"flex",
              flexDirection:"column",
              alignItems:"center",
              justifyContent:"center"
            }}>
              <div style={{width:size,height:size,display:"flex",alignItems:"center",justifyContent:"center",background:"#fafafa",borderRadius:6,marginBottom:8}}>
                <PartThumb part_num={r.part_num} color_id={r.color_id || 0} size={size}/>
              </div>
              <div style={{fontWeight:600, fontSize:12, textAlign:"center"}}>
                {r.part_num} <span style={{opacity:.7}}>C{r.color_id||"–"}</span>
              </div>
              <div style={{fontSize:12,opacity:.8}}>× {Qty(r)}</div>
              {r.notes ? <div style={{fontSize:11,opacity:.7,marginTop:4,textAlign:"center"}}>{r.notes}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
