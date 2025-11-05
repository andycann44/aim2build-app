import React, { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api";

type PartRow = {
  part_num: string;
  color_id: number;
  need: number;
  have: number;
  short: number;
  img_url?: string;
};
type CompareResp = {
  set_num: string;
  total_needed: number;
  total_have: number;
  coverage: number; // 0..1
  missing_parts: PartRow[];
};

export default function BuildabilityCompare(){
  const params = useParams();
  const sid = useMemo(() => String((params.set_id || params.id || params.setNum || "")).trim(), [params]);

  const [data, setData] = useState<CompareResp | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    (async () => {
      if (!sid) { setError("No set id in URL"); return; }
      try {
        const res = await api(`/api/buildability/compare?set_num=${encodeURIComponent(sid)}`);
        setData(res);
        setError("");
      } catch (e: any) {
        setError(String(e?.message || e));
      }
    })();
  }, [sid]);

  if (error) {
    return (
      <div style={{padding:16}}>
        <Link to="/buildability">← Back</Link>
        <h3>Buildability Compare</h3>
        <div style={{color:"#b91c1c", marginTop:8}}>Error: {error}</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{padding:16}}>
        <Link to="/buildability">← Back</Link>
        <h3>Buildability Compare</h3>
        <div style={{opacity:.7, marginTop:8}}>Loading buildability…</div>
      </div>
    );
  }

  const pct = Math.round((data.coverage || 0) * 100);

  return (
    <div style={{padding:16}}>
      <Link to="/buildability">← Back</Link>
      <h3 style={{marginTop:8}}>Buildability for {data.set_num}</h3>
      <div style={{margin:"8px 0 16px"}}>
        <strong>{pct}%</strong> complete · Have {data.total_have} of {data.total_needed}
      </div>

      <div style={{display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(320px,1fr))", gap:12}}>
        {(data.missing_parts || []).map((p, i) => (
          <div key={i} style={{border:"1px solid #e5e7eb", borderRadius:12, padding:10, display:"flex", gap:12, alignItems:"center", background:"#fff"}}>
            <div style={{width:96, height:72, display:"flex", alignItems:"center", justifyContent:"center", background:"#f5f5f5", borderRadius:8}}>
              {p.img_url ? <img src={p.img_url} alt={p.part_num} style={{maxWidth:"100%", maxHeight:"100%", objectFit:"contain"}} /> : <span style={{opacity:.5}}>no img</span>}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600}}>{p.part_num} · color {p.color_id}</div>
              <div style={{opacity:.75, fontSize:13}}>
                Need {p.need}, Have {p.have}, Short {p.short}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
