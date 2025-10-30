import { useEffect, useState } from "react";
import { api } from "../lib/api";

type InvRow = {
  part_num: string;
  color_id: number | null;
  qty: number;
  notes?: string | null;
  name?: string | null;
  img_url?: string | null;
  color_rgb?: string | null;
};

function thumbUrl(row: InvRow): string | undefined {
  // Prefer backend-provided image; otherwise show nothing (UI has fallback tile)
  return row.img_url ?? undefined;
}

export default function Inventory(){
  const [rows,setRows] = useState<InvRow[]>([]);
  const [msg,setMsg]   = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const data = await api<InvRow[]>("/api/inventory");
        setRows(data);
      } catch (e:any) {
        setMsg(String(e?.message || e));
      }
    })();
  }, []);

  return (
    <div style={{padding:16}}>
      <h3>Inventory</h3>
      {msg && <div style={{color:"#b00", marginBottom:8}}>{msg}</div>}
      {rows.length === 0 ? <p>No parts yet. Add some via the Inventory page.</p> : null}
      <div style={{
        display:"grid",
        gridTemplateColumns:"repeat(auto-fill, minmax(140px, 1fr))",
        gap:12
      }}>
        {rows.map((r,idx) => (
          <div key={`${r.part_num}-${r.color_id ?? "x"}-${idx}`} style={{
            border:"1px solid #e5e7eb",
            borderRadius:8,
            padding:10,
            background:"#fff"
          }}>
            <div style={{
              height:110, display:"flex", alignItems:"center", justifyContent:"center",
              background:"#fafafa", borderRadius:6, marginBottom:8, overflow:"hidden"
            }}>
              {thumbUrl(r)
                ? <img src={thumbUrl(r)} alt={r.part_num}
                       style={{maxWidth:"100%", maxHeight:"100%", objectFit:"contain"}}
                       onError={(e)=>{(e.currentTarget as HTMLImageElement).style.display="none";}}/>
                : <div style={{
                    width:64,height:40,background:"#ff2d2d",
                    border:"3px solid #b81b1b",borderRadius:6
                  }}/>}
            </div>
            <div style={{fontWeight:600}}>{r.part_num} × {r.qty}</div>
            <div style={{fontSize:12, opacity:.75}}>
              C{r.color_id ?? "-"} {r.name ? `· ${r.name}` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
