// frontend/src/pages/Buildability.tsx
import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API = (import.meta.env.VITE_API_BASE?.trim() || "http://127.0.0.1:8000") as string;

type MySet = {
  set_num: string;
  name: string;
  year?: number;
  img_url?: string;
  in_inventory?: boolean; // optional; we no longer filter on this in the UI
};

type Compare = {
  set_num: string;
  coverage: number; // 0..1
};

export default function Buildability() {
  const [sets, setSets] = useState<MySet[]>([]);
  const [coverageMap, setCoverageMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  /** Fetch my sets */
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const r = await fetch(`${API}/api/my-sets/`);
        const data = await r.json();
        setSets(Array.isArray(data?.sets) ? data.sets : []);
      } catch (e) {
        console.error(e);
        setSets([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /** Fetch coverage for each set (best-effort, parallel) */
  useEffect(() => {
    if (!sets.length) return;
    let cancelled = false;
    (async () => {
      const entries = await Promise.all(
        sets.map(async (s) => {
          try {
            // aliases supported: set / set_num / id
            const u = new URL(`${API}/api/buildability/compare`);
            u.searchParams.set("set", s.set_num);
            const r = await fetch(u.toString());
            if (!r.ok) throw new Error(`${s.set_num}: ${r.status}`);
            const cmp: Compare = await r.json();
            return [s.set_num, Number(cmp.coverage) || 0] as const;
          } catch {
            return [s.set_num, 0] as const;
          }
        })
      );
      if (!cancelled) {
        const map: Record<string, number> = {};
        for (const [k, v] of entries) map[k] = v;
        setCoverageMap(map);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sets]);

  const cards = useMemo(() => {
    return sets.map((s) => {
      const cov = coverageMap[s.set_num] ?? 0;
      let ring = "#e5e7eb"; // default
      if (cov >= 0.95) ring = "#16a34a"; // green
      else if (cov >= 0.5) ring = "#f59e0b"; // amber
      else ring = "#ef4444"; // red
      const pct = Math.round(cov * 100);

      return (
        <div
          key={s.set_num}
          onDoubleClick={() => navigate(`/buildability/compare/${encodeURIComponent(s.set_num)}`)}
          style={{
            cursor: "pointer",
            border: `3px solid ${ring}`,         // thicker border
            borderRadius: 14,
            background: "#fff",
            padding: 12,
            display: "grid",
            gridTemplateColumns: "128px 1fr",
            gap: 12,
            position: "relative",
          }}
          title={`${s.set_num} • ${pct}%`}
        >
          <div
            style={{
              width: 128,
              height: 96,
              borderRadius: 10,
              background: "#f6f7f8",
              display: "grid",
              placeItems: "center",
              overflow: "hidden",
            }}
          >
            {s.img_url ? (
              <img src={s.img_url} alt={s.name} style={{ maxWidth: "96%", maxHeight: "96%", objectFit: "contain" }} />
            ) : (
              <span style={{ fontSize: 12, color: "#999" }}>no image</span>
            )}
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {s.name || s.set_num}
            </div>
            <div style={{ fontSize: 12, color: "#666" }}>
              {s.year ? `${s.year} • ` : ""}{s.set_num}
            </div>
          </div>

          {/* Percentage badge in bottom-right */}
          <div
            style={{
              position: "absolute",
              right: 10,
              bottom: 8,          // bottom-right per your request
              padding: "2px 8px",
              fontSize: 12,
              borderRadius: 10,
              background: "#111827",
              color: "#fff",
              opacity: 0.9,
            }}
          >
            {Math.round((coverageMap[s.set_num] ?? 0) * 100)}%
          </div>
        </div>
      );
    });
  }, [sets, coverageMap, navigate]);

  return (
    <div style={{ padding: 16 }}>
      <h3 style={{ marginBottom: 12 }}>Buildability</h3>

      {/* Checkbox removed per request — default is to show all sets */}
      {/* (If we ever re-introduce it, wire the state and filter here.) */}

      {loading && <div style={{ color: "#666", marginTop: 12 }}>Loading…</div>}

      {!loading && cards.length === 0 ? (
        <div style={{ color: "#666" }}>
          No sets yet. Add sets on <Link to="/my-sets">My Sets</Link>.
        </div>
      ) : (
        <div
          style={{
            marginTop: 8,
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(360px, 1fr))",
            gap: 14,
          }}
        >
          {cards}
        </div>
      )}
    </div>
  );
}