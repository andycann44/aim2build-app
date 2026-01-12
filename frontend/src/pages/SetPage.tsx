/// <reference types="vite/client" />
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import InstructionsTile from "../components/InstructionsTile";
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

const normSetNum = (raw: string) => (raw.includes("-") ? raw : `${raw}-1`);

async function fetchSetMeta(setNum: string): Promise<SetSummary | null> {
  const res = await fetch(
    `${API_BASE}/api/search?q=${encodeURIComponent(setNum)}`
  );
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
  const res = await fetch(
    `${API_BASE}/api/catalog/parts?set=${encodeURIComponent(setNum)}`
  );
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

      const m = await fetchSetMeta(setNum);
      if (!alive) return;
      setMeta(m);

      if (isGuest) {
        const gm = await fetchGuestMissing(setNum);
        if (!alive) return;
        setGuestMissing(gm);
      } else {
        const c = await fetchCompare(setNum);
        if (!alive) return;
        setCompare(c);
      }

      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [setNum, isGuest]);

  const missing = isGuest ? guestMissing : compare?.missing_parts ?? [];

  return (
    <div className="page buildability-missing">
      {/* ===== CSS FIXED (NO JSX INSIDE) ===== */}
      <style>{`
        .demo-banner {
          position: relative;
          border-radius: 16px;
          padding: 12px 16px;
          margin: 14px auto 0;
          max-width: 1600px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: #f8fafc;
          background: linear-gradient(135deg, #0b1120 0%, #1d4ed8 35%, #fbbf24 70%, #dc2626 100%);
          box-shadow:
            0 18px 40px rgba(0, 0, 0, 0.45),
            inset 0 0 0 1px rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(8px);
          -webkit-backdrop-filter: blur(8px);
          overflow: visible;
        }

        .demo-banner strong {
          color: #f8fafc;
        }

        .demo-banner::before {
          content: "";
          position: absolute;
          inset: -3px;
          border-radius: calc(16px + 3px);
          border: 2px solid #22c55e;
          box-shadow: 0 0 0 rgba(34, 197, 94, 0);
          animation: xmasFlash 1.2s linear infinite;
          pointer-events: none;
        }

        .demo-banner button {
          border-radius: 10px;
          border: 1px solid rgba(255, 255, 255, 0.55);
          background: rgba(15, 23, 42, 0.55);
          color: #f8fafc;
          font-weight: 700;
          font-size: 0.82rem;
          padding: 0.3rem 0.75rem;
          cursor: pointer;
          box-shadow: 0 10px 22px rgba(0, 0, 0, 0.25);
          transition:
            background 0.12s ease,
            border-color 0.12s ease,
            transform 0.12s ease;
        }

        .demo-banner button:hover {
          background: rgba(15, 23, 42, 0.7);
          border-color: rgba(255, 255, 255, 0.7);
          transform: translateY(-1px);
        }

        .demo-banner button:focus-visible {
          outline: 2px solid rgba(255, 255, 255, 0.7);
          outline-offset: 2px;
        }

        @keyframes xmasFlash {
          0%   { border-color: #22c55e; box-shadow: 0 0 0 rgba(34,197,94,0); }
          25%  { border-color: #ef4444; box-shadow: 0 0 18px rgba(239,68,68,0.45); }
          50%  { border-color: #facc15; box-shadow: 0 0 18px rgba(250,204,21,0.45); }
          75%  { border-color: #3b82f6; box-shadow: 0 0 18px rgba(59,130,246,0.45); }
          100% { border-color: #22c55e; box-shadow: 0 0 0 rgba(34,197,94,0); }
        }

        @media (prefers-reduced-motion: reduce) {
          .demo-banner::before { animation: none; }
        }

        .tile-grid--5 {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 18px;
        }
      `}</style>

      {/* HERO + overlay tile */}
      <div style={{ position: "relative" }}>
        <PageHero
          title={meta?.name ?? "Set"}
          subtitle={
            meta
              ? `${meta.set_num} • ${meta.year} • ${meta.num_parts?.toLocaleString()} parts`
              : setNum
          }
        />

        <div
          className="heroTwoCol"
          style={{
            position: "absolute",
            left: 22,
            right: 22,
            bottom: 18,
            zIndex: 5,
            display: "grid",
            gridTemplateColumns: "1fr auto",
            alignItems: "center",
            columnGap: 16,
            pointerEvents: "none",
          }}
        >
          <div style={{ pointerEvents: "auto" }} />

          <div
            className="heroRight"
            style={{
              justifySelf: "end",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "flex-end",
              pointerEvents: "auto",
            }}
          >
            <div style={{ width: 220, height: 140 }}>
              <InstructionsTile
                setNum={meta?.set_num ?? setNum}
                imgUrl={meta?.img_url ?? null}
              />
            </div>
          </div>
        </div>
      </div>

      {/* DEMO BANNER */}
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

      {/* GRID */}
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