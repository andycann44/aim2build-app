import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/api";

type Missing = {
  part_num: string;
  color_id: number;
  need: number;
  have: number;
  short: number;
  img_url?: string;
  part_img_url?: string;
};

type CompareResp = {
  set_num: string;
  coverage: number;
  total_needed: number;
  total_have: number;
  missing_parts: Missing[];
};

function trafficColor(c?: number) {
  if (c == null) return "#d1d5db";
  if (c >= 0.9) return "#10b981";
  if (c >= 0.5) return "#f59e0b";
  return "#ef4444";
}

function resolveSetId(paramId: string | undefined): string | null {
  if (paramId && paramId !== "undefined") return paramId;
  // try query string ?set= or ?id=
  const sp = new URLSearchParams(window.location.search);
  const qs = sp.get("set") || sp.get("set_num") || sp.get("id");
  if (qs) return qs;
  // fallback: last path segment
  const segs = window.location.pathname.split("/").filter(Boolean);
  return segs.length ? segs[segs.length - 1] : null;
}

export default function BuildabilityCompare() {
  const { set_id } = useParams();
  const [data, setData] = useState<CompareResp | null>(null);
  const [err, setErr] = useState<string>("");

  useEffect(() => {
    (async () => {
      setErr("");
      setData(null);
      const sid = resolveSetId(set_id || undefined);
      if (!sid) { setErr("No set id provided"); return; }
      try {
        const r = await api(`/api/buildability/compare?set=${encodeURIComponent(sid)}`);
        setData(r as CompareResp);
      } catch (e: any) {
        setErr(e?.message || "Failed to load compare");
      }
    })();
  }, [set_id]);

  const pct = useMemo(() => data ? Math.round((data.coverage || 0) * 100) : 0, [data]);
  const border = trafficColor(data?.coverage);

  return (
    <div style={{ padding: 16 }}>
      <div style={{marginBottom:10}}>
        <Link to="/buildability">← Back</Link>
      </div>

      {!!err && <div style={{ color: "#b91c1c" }}>Error: {err}</div>}
      {!err && !data && <div>Loading…</div>}

      {data && (
        <div style={{ position:"relative", border:`5px solid ${border}`, borderRadius:12, background:"#fff", padding:14 }}>
          <div
            style={{
              position:"absolute",
              right:12,
              bottom:12,
              background:"#111827",
              color:"#fff",
              padding:"4px 8px",
              borderRadius:6,
              fontSize:12
            }}
          >
            {pct}%
          </div>

          <div style={{fontWeight:700, marginBottom:6}}>{data.set_num}</div>
          <div style={{opacity:.8, fontSize:13, marginBottom:12}}>
            Have {data.total_have} / {data.total_needed}
          </div>

          <h4 style={{marginTop:8}}>Missing parts</h4>
          {!data.missing_parts?.length ? (
            <div>Nothing missing 🎉</div>
          ) : (
            <div style={{display:"grid", gap:10, gridTemplateColumns:"repeat(auto-fill, minmax(260px, 1fr))"}}>
              {data.missing_parts.map((m) => {
                const img = (m.part_img_url || m.img_url || "");
                return (
                  <div key={m.part_num + "|" + m.color_id} style={{display:"flex", gap:10, border:"1px solid #e5e7eb", borderRadius:10, padding:10}}>
                    <div style={{width:76, height:76, display:"flex", alignItems:"center", justifyContent:"center", background:"#fff", borderRadius:8, overflow:"hidden"}}>
                      {img
                        ? <img src={img} alt={m.part_num} style={{maxWidth:"100%", maxHeight:"100%", objectFit:"contain"}}/>
                        : <div style={{fontSize:12, opacity:.6}}>no image</div>}
                    </div>
                    <div style={{fontSize:13}}>
                      <div><strong>{m.part_num}</strong> • color {m.color_id}</div>
                      <div>Need {m.need}, have {m.have}, short {m.short}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
