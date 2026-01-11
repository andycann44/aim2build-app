/// <reference types="vite/client" />
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import PageHero from "../components/PageHero";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import { API_BASE } from "../api/client";
import { authHeaders, getToken } from "../utils/auth";

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
  coverage: number; // 0..1
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

function normSetNum(raw: string): string {
  if (!raw) return "";
  return raw.includes("-") ? raw : `${raw}-1`;
}

function pct(v01: number): string {
  const v = Number.isFinite(v01) ? Math.max(0, Math.min(1, v01)) : 0;
  return `${Math.round(v * 100)}%`;
}

async function fetchSetMeta(setNum: string): Promise<SetSummary | null> {
  const res = await fetch(`${API_BASE}/api/search?q=${encodeURIComponent(setNum)}`);
  if (!res.ok) return null;
  const list = (await res.json()) as SetSummary[];
  const exact = Array.isArray(list) ? list.find((s) => s.set_num === setNum) : null;
  return exact || (Array.isArray(list) ? list[0] : null) || null;
}

async function fetchCompare(setNum: string): Promise<CompareResult> {
  const res = await fetch(`${API_BASE}/api/buildability/compare?set=${encodeURIComponent(setNum)}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to load buildability (${res.status})`);
  }
  return (await res.json()) as CompareResult;
}

async function fetchGuestMissing(setNum: string): Promise<MissingPart[]> {
  // Guest demo uses catalog parts list and assumes have=0
  const res = await fetch(`${API_BASE}/api/catalog/parts?set=${encodeURIComponent(setNum)}`);
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(txt || `Failed to load set parts (${res.status})`);
  }
  const rows = (await res.json()) as CatalogPartRow[];
  return (rows || [])
    .map((r) => {
      const need = Number(r.quantity) || 0;
      const part_img_url = (r.part_img_url ?? r.img_url ?? null) as string | null;
      return {
        part_num: r.part_num,
        color_id: r.color_id,
        need,
        have: 0,
        short: need,
        part_img_url,
      };
    })
    .filter((m) => m.need > 0);
}

export default function SetPage() {
  const { setNum: raw } = useParams<{ setNum: string }>();
  const navigate = useNavigate();

  const setNum = useMemo(() => normSetNum(raw || ""), [raw]);
  const token = getToken();
  const isGuest = !token;

  const [meta, setMeta] = useState<SetSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [compare, setCompare] = useState<CompareResult | null>(null);
  const [guestMissing, setGuestMissing] = useState<MissingPart[] | null>(null);

  useEffect(() => {
    if (!setNum) {
      setError("No set selected");
      setLoading(false);
      return;
    }

    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);
        setMeta(null);
        setCompare(null);
        setGuestMissing(null);

        const m = await fetchSetMeta(setNum);
        if (!alive) return;
        setMeta(m);

        if (isGuest) {
          const missing = await fetchGuestMissing(setNum);
          if (!alive) return;
          setGuestMissing(missing);
        } else {
          const c = await fetchCompare(setNum);
          if (!alive) return;
          setCompare(c);
        }
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || "Failed to load set");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [setNum, isGuest]);

  const title = meta?.name || "Set";
  const subtitle = meta
    ? `${meta.set_num} • ${meta.year}${meta.num_parts ? ` • ${meta.num_parts.toLocaleString()} parts` : ""}`
    : setNum;

  const missing = isGuest ? guestMissing || [] : compare?.missing_parts || [];
  const totalNeeded = isGuest
    ? missing.reduce((a, b) => a + (b.need || 0), 0)
    : compare?.total_needed ?? 0;
  const missingCount = useMemo(() => {
    if (!missing.length) return 0;
    return missing.reduce((acc, m) => {
      const short =
        typeof m.short === "number"
          ? m.short
          : Math.max((m.need ?? 0) - (m.have ?? 0), 0);
      return acc + (Number.isFinite(short) ? short : 0);
    }, 0);
  }, [missing]);
  const coverageLabel = isGuest
    ? guestMissing
      ? "0%"
      : "—"
    : typeof compare?.coverage === "number"
    ? pct(compare.coverage)
    : "—";
  const needLabel = isGuest
    ? guestMissing
      ? totalNeeded.toLocaleString()
      : "—"
    : compare?.total_needed !== undefined
    ? compare.total_needed.toLocaleString()
    : "—";

  return (
    <div className="page buildability-missing">
      {/* Local responsive grid rules: 5-wide desktop */}
      <style>{`
        .tile-grid.tile-grid--5 {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 18px;
        }
        @media (max-width: 1400px) {
          .tile-grid.tile-grid--5 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
        }
        @media (max-width: 1100px) {
          .tile-grid.tile-grid--5 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
        }
        @media (max-width: 820px) {
          .tile-grid.tile-grid--5 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 520px) {
          .tile-grid.tile-grid--5 { grid-template-columns: repeat(1, minmax(0, 1fr)); }
        }
      `}</style>

      <PageHero title={title} subtitle={subtitle}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.55rem",
            alignItems: "center",
          }}
        >
          <span
            className="hero-pill hero-pill--sort"
            style={{
              background: "rgba(15,23,42,0.55)",
              borderColor: "rgba(255,255,255,0.75)",
              color: "#f8fafc",
              fontWeight: 700,
            }}
          >
            Coverage: {coverageLabel}
          </span>

          <span
            className="hero-pill hero-pill--sort"
            style={{
              background: "rgba(15,23,42,0.48)",
              borderColor: "rgba(255,255,255,0.55)",
              color: "#f8fafc",
              fontWeight: 700,
            }}
          >
            Need: {needLabel}
          </span>

          <span
            className="hero-pill hero-pill--sort"
            style={{
              background: "rgba(220,38,38,0.22)",
              borderColor: "rgba(252,165,165,0.75)",
              color: "#fef2f2",
              fontWeight: 700,
            }}
          >
            Missing pieces: {missingCount.toLocaleString()}
          </span>

          {isGuest ? (
            <span
              className="hero-pill hero-pill--sort"
              style={{
                background: "rgba(15,23,42,0.35)",
                borderColor: "rgba(255,255,255,0.4)",
                color: "#e2e8f0",
                fontWeight: 600,
              }}
            >
              Guest demo: sign in to track real buildability
            </span>
          ) : null}

          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              borderRadius: 999,
              border: "1px solid rgba(255,255,255,0.55)",
              background: "rgba(255,255,255,0.12)",
              color: "#fff",
              padding: "0.35rem 0.85rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ← Back
          </button>
          {isGuest ? (
            <button
              type="button"
              onClick={() => navigate("/login")}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(34,197,94,0.7)",
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                color: "#fff",
                padding: "0.35rem 0.85rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Sign in
            </button>
          ) : (
            <button
              type="button"
              onClick={() => navigate(`/buildability/${setNum}/missing`)}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(34,197,94,0.7)",
                background: "linear-gradient(135deg,#22c55e,#16a34a)",
                color: "#fff",
                padding: "0.35rem 0.85rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Open Missing Parts
            </button>
          )}
        </div>
      </PageHero>

      <div
        style={{
          maxWidth: "1600px",
          margin: "0 auto 2.5rem",
          padding: "0 1.5rem",
        }}
      >
        {loading && (
          <p style={{ fontSize: "0.92rem", color: "#94a3b8" }}>
            Loading missing parts…
          </p>
        )}

        {error && <p style={{ color: "#ef4444", fontSize: "0.92rem" }}>{error}</p>}

        {!loading && !error && (
          <p style={{ fontSize: "0.92rem", color: "#94a3b8" }}>
            Missing parts ({missing.length})
          </p>
        )}

        {!loading && !error && missing.length === 0 && (
          <p style={{ fontSize: "0.92rem", color: "#94a3b8" }}>
            No missing parts for this set.
          </p>
        )}

        {!loading && !error && missing.length > 0 ? (
          <div className="tile-grid tile-grid--5" style={{ marginTop: "0.5rem" }}>
            {missing.map((m, idx) => (
              <BuildabilityPartsTile
                key={`${m.part_num}-${m.color_id}-${idx}`}
                part={{
                  part_num: m.part_num,
                  color_id: m.color_id,
                  part_img_url: (m.part_img_url ?? undefined) as any,
                }}
                need={m.need}
                have={m.have}
                editableQty={false}
              />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
