/// <reference types="vite/client" />
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHero from "../components/PageHero";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import { API_BASE } from "../api/client";
import { authHeaders, getToken } from "../utils/auth";

/* ---------- types ---------- */
type SetSummary = {
  set_num: string;
  name: string;
  year: number;
  img_url?: string | null;
  num_parts?: number | null;
};

type MissingPart = {
  part_num: string;
  color_id: number;
  need: number;
  have: number;
  short: number;
  part_img_url?: string | null;
};

type CompareResult = {
  set_num: string;
  coverage: number;
  total_needed: number;
  total_have: number;
  missing_parts: MissingPart[];
};

type CatalogPartRow = {
  part_num: string;
  color_id: number;
  quantity: number;
  part_img_url?: string | null;
  img_url?: string | null;
};

/* ---------- helpers ---------- */
const FALLBACK_IMG = "/branding/missing.png";

const normSetNum = (raw: string) =>
  raw.includes("-") ? raw : `${raw}-1`;

const pct = (v: number) =>
  `${Math.round(Math.max(0, Math.min(1, v)) * 100)}%`;

async function fetchSetMeta(setNum: string): Promise<SetSummary | null> {
  const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(setNum)}`);
  if (!res.ok) return null;
  const list = (await res.json()) as SetSummary[];
  return list.find((s) => s.set_num === setNum) ?? list[0] ?? null;
}

async function fetchCompare(setNum: string): Promise<CompareResult> {
  const res = await fetch(
    `${API_BASE}/api/buildability/compare?set=${encodeURIComponent(setNum)}`,
    { headers: authHeaders() }
  );
  if (!res.ok) throw new Error("Buildability failed");
  return res.json();
}

async function fetchGuestMissing(setNum: string): Promise<MissingPart[]> {
  const res = await fetch(`${API_BASE}/api/catalog/parts?set=${encodeURIComponent(setNum)}`);
  if (!res.ok) throw new Error("Catalog load failed");

  const rows = (await res.json()) as CatalogPartRow[];
  return rows.map((r) => ({
    part_num: r.part_num,
    color_id: r.color_id,
    need: r.quantity,
    have: 0,
    short: r.quantity,
    part_img_url: r.part_img_url ?? r.img_url ?? FALLBACK_IMG,
  }));
}

/* ============================== */

export default function SetPage() {
  const { setNum: raw } = useParams<{ setNum: string }>();
  const navigate = useNavigate();

  const setNum = useMemo(() => normSetNum(raw || ""), [raw]);
  const isGuest = !getToken();

  const [meta, setMeta] = useState<SetSummary | null>(null);
  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [guestMissing, setGuestMissing] = useState<MissingPart[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setMeta(await fetchSetMeta(setNum));
      if (!alive) return;

      if (isGuest) {
        setGuestMissing(await fetchGuestMissing(setNum));
      } else {
        setCompare(await fetchCompare(setNum));
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [setNum, isGuest]);

  const missing = isGuest ? guestMissing : compare?.missing_parts ?? [];
  const missingCount = missing.reduce((a, b) => a + (b.short ?? 0), 0);

  /* ---------- render ---------- */
  return (
    <div className="page buildability-missing">
      {/* ===== CSS FIXED (NO JSX INSIDE) ===== */}
      <style>{`
        .demo-banner {
          border: 2px solid;
          border-radius: 14px;
          padding: 12px 16px;
          margin: 14px auto 0;
          max-width: 1600px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          animation: xmasFlash 1.2s linear infinite;
          background: linear-gradient(135deg, rgba(34,197,94,0.18), rgba(15,23,42,0.6));
        }

        @keyframes xmasFlash {
          0%   { border-color: #22c55e; box-shadow: 0 0 0; }
          25%  { border-color: #ef4444; box-shadow: 0 0 18px rgba(239,68,68,.4); }
          50%  { border-color: #facc15; box-shadow: 0 0 18px rgba(250,204,21,.4); }
          75%  { border-color: #3b82f6; box-shadow: 0 0 18px rgba(59,130,246,.4); }
          100% { border-color: #22c55e; box-shadow: 0 0 0; }
        }

        @media (prefers-reduced-motion: reduce) {
          .demo-banner { animation: none; }
        }

        .tile-grid--5 {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 18px;
        }
      `}</style>

      <PageHero
        title={meta?.name ?? "Set"}
        subtitle={
          meta
            ? `${meta.set_num} • ${meta.year} • ${meta.num_parts?.toLocaleString()} parts`
            : setNum
        }
      />

      {/* ===== FLASHING DEMO BANNER (FIXED) ===== */}
      {isGuest && (
        <div className="demo-banner">
          <div>
            <strong>Demo mode</strong>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Viewing this set with zero inventory.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => navigate("/login")}>Sign in</button>
            <button onClick={() => navigate("/account")}>Create account</button>
          </div>
        </div>
      )}

      {/* ===== GRID ===== */}
      <div style={{ maxWidth: 1600, margin: "20px auto", padding: "0 1.5rem" }}>
        {!loading && missing.length > 0 && (
          <div className="tile-grid--5">
            {missing.map((m, i) => (
              <BuildabilityPartsTile
                key={`${m.part_num}-${m.color_id}-${i}`}
                part={{
                  part_num: m.part_num,
                  color_id: m.color_id,
                  part_img_url: m.part_img_url || FALLBACK_IMG,
                }}
                need={m.need}
                have={m.have}
                editableQty={false}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}