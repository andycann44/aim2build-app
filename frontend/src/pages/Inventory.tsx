import { useEffect, useState } from "react";
import { api } from "../lib/api";
type Inv = { part_num: string; color_id: number|null; qty_total: number; notes?: string|null };

export default function Inventory(){
  const [rows,setRows]=useState<Inv[]>([]);
  const [f,setF]=useState({part_num:"",color_id:"",qty:"1",notes:""});
  const load=async()=> setRows(await api("/api/inventory"));
  useEffect(()=>{ load(); },[]);
  const save=async()=>{
    await api("/api/inventory",{method:"POST",body:JSON.stringify({
      part_num:f.part_num, color_id:f.color_id?Number(f.color_id):null, qty:Number(f.qty||0), notes:f.notes||null
    })});
    setF({part_num:"",color_id:"",qty:"1",notes:""}); load();
  };
  return <div style={{padding:16}}>
    <h3>Inventory</h3>
    <div style={{display:"flex",gap:8,marginBottom:8}}>
      <input placeholder="part num" value={f.part_num} onChange={e=>setF(s=>({...s,part_num:e.target.value}))}/>
      <input placeholder="color id" value={f.color_id} onChange={e=>setF(s=>({...s,color_id:e.target.value}))}/>
      <input placeholder="qty" value={f.qty} onChange={e=>setF(s=>({...s,qty:e.target.value}))}/>
      <input placeholder="notes" value={f.notes} onChange={e=>setF(s=>({...s,notes:e.target.value}))}/>
      <button onClick={save} disabled={!f.part_num}>Save</button>
    </div>
    <ul>{rows.map((r,i)=> <li key={i}>{r.part_num} C{r.color_id??"-"} × {r.qty_total} {r.notes?`— ${r.notes}`:""}</li>)}</ul>
  </div>;
}
