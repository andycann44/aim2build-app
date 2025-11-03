import React, { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../lib/api";

type Saved = {
  set_num: string;
  name: string;
  year?: number;
  img_url?: string;
  num_parts?: number;
};

export default function MySets() {
  // Per‑item pending state to prevent double toggles + enable optimistic UI rollback
  const [pending, setPending] = useState<Record<string, boolean>>({});

  // A2B: plan-build handler (uses shared api() helper + rollback on error)
  async function togglePlanBuild(set_num: string, on: boolean) {
    // optimistic
    setPlan((prev) => ({ ...prev, [set_num]: on }));
    setPending((p) => ({ ...p, [set_num]: true }));
    try {
      const method = on ? "POST" : "DELETE";
      await api(`/api/reservations/plan_build?set_num=${encodeURIComponent(set_num)}`, {
        method,
      });
      console.log(on ? `Reserved parts for ${set_num}` : `Released reservation for ${set_num}`);
    } catch (e: any) {
      console.error("plan_build failed", e);
      // rollback
      setPlan((prev) => ({ ...prev, [set_num]: !on }));
      alert("Plan build failed: " + (e?.message ?? String(e)));
    } finally {
      setPending((p) => ({ ...p, [set_num]: false }));
    }
  }

  const [rows, setRows] = useState<Saved[]>([]);
  const [busy, setBusy] = useState(false);
  const [inv, setInv] = useState<Record<string, boolean>>({});
  const [plan, setPlan] = useState<Record<string, boolean>>({});
  const [big, setBig] = useState<boolean>(() => localStorage.getItem("a2b.bigTiles") === "1");

  const cardSize = useMemo(() => (big ? { w: 140, h: 110 } : { w: 96, h: 72 }), [big]);

  // Guard against stale responses / rapid reloads
  const loadSeq = useRef(0);

  async function load() {
    const seq = ++loadSeq.current;
    setBusy(true);
    try {
      // 1) load saved sets
      const data = await api(`/api/my-sets/`);
      const list = Array.isArray(data) ? data : data?.sets ?? [];
      const safe: Saved[] = Array.isArray(list) ? list : [];
      if (seq !== loadSeq.current) return; // ignore stale response
      setRows(safe);

      // 2) pre-mark inventory toggles (tolerant to different backend shapes)
      // Prefer a dedicated list endpoint if available.
      let invIds = new Set<string>();
      try {
        const invSets: any = await api(`/api/my-sets/`).catch(() => null);
        if (Array.isArray(invSets)) {
          for (const s of invSets) invIds.add(typeof s === "string" ? s : s?.set_num);
        } else if (invSets?.set_nums && Array.isArray(invSets.set_nums)) {
          for (const sn of invSets.set_nums) invIds.add(sn);
        } else if (invSets?.rows && Array.isArray(invSets.rows)) {
          for (const s of invSets.rows) invIds.add(s?.set_num);
        }
      } catch {
        // As a fallback, try summary (no ids) — we keep all off unless user toggles.
        // await api(`/api/inventory/summary`).catch(() => null);
      }

      const map: Record<string, boolean> = {};
      for (const r of safe) {
        if (r?.set_num) map[r.set_num] = invIds.has(r.set_num);
      }
      if (seq !== loadSeq.current) return;
      setInv(map);
    } finally {
      if (seq === loadSeq.current) setBusy(false);
    }
  }

  async function toggleInv(item: Saved, on: boolean) {
    // optimistic update + per-item pending
    setInv((prev) => ({ ...prev, [item.set_num]: on }));
    setPending((p) => ({ ...p, [item.set_num]: true }));
    try {
      await api("/api/inventory/toggle", {
        method: "POST",
        body: JSON.stringify({ ...item, on }),
      });
    } catch (e: any) {
      // rollback on failure
      console.error("inventory toggle failed", e);
      setInv((prev) => ({ ...prev, [item.set_num]: !on }));
      alert("Inventory toggle failed: " + (e?.message ?? String(e)));
    } finally {
      setPending((p) => ({ ...p, [item.set_num]: false }));
    }
  }

  useEffect(() => {
    load();
  }, []);
  useEffect(() => {
    localStorage.setItem("a2b.bigTiles", big ? "1" : "0");
  }, [big]);

  return (
    <div style={{ padding: 16 }}>
      <h3>
        My Sets {busy && <small style={{ opacity: 0.6 }}>(loading…)</small>}
      </h3>

      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "8px 0 4px" }}>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <input type="checkbox" checked={big} onChange={(e) => setBig(e.target.checked)} /> Bigger
          tiles
        </label>
      </div>

      {!rows.length && <div style={{ opacity: 0.7, marginTop: 8 }}>No sets yet. Add from Search.</div>}

      <ul
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill,minmax(320px,1fr))",
          gap: 12,
          listStyle: "none",
          padding: 0,
          marginTop: 12,
        }}
      >
        {rows.map((r) => (
          <li
            key={r.set_num}
            style={{
              border: "1px solid #ddd",
              borderRadius: 12,
              padding: 10,
              display: "flex",
              gap: 12,
              alignItems: "center",
              background: "#fff",
              opacity: pending[r.set_num] ? 0.6 : 1,
            }}
          >
            <div
              style={{
                width: cardSize.w,
                height: cardSize.h,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "#f5f5f5",
                borderRadius: 8,
              }}
            >
              {r.img_url ? (
                <img src={r.img_url} alt={r.name} style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "cover" }} />
              ) : null}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>
                {r.name} <span style={{ opacity: 0.6 }}>({r.set_num})</span>
              </div>
              <div style={{ opacity: 0.75, fontSize: 13 }}>{r.year ?? ""}</div>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                <input
                  type="checkbox"
                  checked={!!inv[r.set_num]}
                  disabled={pending[r.set_num] || busy}
                  onChange={(e) => toggleInv(r, e.target.checked)}
                />
                In Inventory
              </label>
              <label style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 6 }}>
                <input
                  type="checkbox"
                  checked={!!plan[r.set_num]}
                  disabled={pending[r.set_num] || busy}
                  onChange={(e) => togglePlanBuild(r.set_num, e.currentTarget.checked)}
                />
                Plan build (reserve parts)
              </label>
            </div>
            <button
              onClick={async () => {
                setPending((p) => ({ ...p, [r.set_num]: true }));
                try {
                  await api(`/api/my-sets/${encodeURIComponent(r.set_num)}`, { method: "DELETE" });
                  await load();
                } finally {
                  setPending((p) => ({ ...p, [r.set_num]: false }));
                }
              }}
              style={{ padding: "8px 10px", borderRadius: 8 }}
              disabled={pending[r.set_num] || busy}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
