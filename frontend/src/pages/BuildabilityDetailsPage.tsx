import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api/client";
import { useNavigate, useParams } from "react-router-dom";
import { authHeaders } from "../utils/auth";
import RequireAuth from "../components/RequireAuth";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import PageHero from "../components/PageHero";

const API = API_BASE;

type MissingPart = {
  part_num: string;
  color_id: number;
  need: number;
  have: number;
  short: number;
};

type CompareResult = {
  set_num: string;
  coverage: number;
  total_needed: number;
  total_have: number;
  missing_parts: MissingPart[];
  name?: string | null;
  set_name?: string | null;
  year?: number | string | null;
  set_year?: number | string | null;
};

type CatalogPart = {
  set_num: string;
  part_num: string;
  color_id: number;
  quantity: number;
  part_img_url?: string | null;
  part_name?: string | null;
};

// INNER IMPLEMENTATION
const BuildabilityDetailsInner: React.FC = () => {
  // match App.tsx: path="/buildability/:setNum"
  const { setNum } = useParams<{ setNum: string }>();
  const setId = setNum;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CompareResult | null>(null);
  const [parts, setParts] = useState<CatalogPart[]>([]);

  useEffect(() => {
    console.log("BuildabilityDetails route param:", setId);
    if (!setId) {
      setError("No set selected.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const headers = authHeaders();

    async function load() {
      try {
        setLoading(true);
        setError(null);

        const compareUrl = `${API_BASE}/api/buildability/compare?set=${encodeURIComponent(
          setId
        )}`;
        const partsUrl = `${API_BASE}/api/catalog/parts?set=${encodeURIComponent(
          setId
        )}`;

        const [compareRes, partsRes] = await Promise.all([
          fetch(compareUrl, { headers, signal: controller.signal }),
          fetch(partsUrl, { headers, signal: controller.signal }),
        ]);

        if (!compareRes.ok) {
          const txt = await compareRes.text();
          throw new Error(
            `Compare failed (${compareRes.status}): ${
              txt || compareRes.statusText
            }`
          );
        }
        if (!partsRes.ok) {
          const txt = await partsRes.text();
          throw new Error(
            `Parts lookup failed (${partsRes.status}): ${
              txt || partsRes.statusText
            }`
          );
        }

        const compareJson = (await compareRes.json()) as CompareResult;
        const partsJson = (await partsRes.json()) as CatalogPart[];

        setSummary(compareJson);
        setParts(partsJson);
      } catch (err: any) {
        if (err.name === "AbortError") return;
        console.error("Failed to load buildability details:", err);
        setError(err.message || "Failed to load buildability details.");
      } finally {
        setLoading(false);
      }
    }

    load();
    return () => controller.abort();
  }, [setId]);

  const missingMap = useMemo(() => {
    const map = new Map<string, MissingPart>();
    if (!summary) return map;
    for (const m of summary.missing_parts || []) {
      map.set(`${m.part_num}-${m.color_id}`, m);
    }
    return map;
  }, [summary]);

  const missingPiecesTotal = useMemo(() => {
    if (!summary?.missing_parts) return 0;

    return summary.missing_parts.reduce((total, m) => {
      const short =
        typeof m.short === "number"
          ? m.short
          : Math.max((m.need ?? 0) - (m.have ?? 0), 0);
      return total + short;
    }, 0);
  }, [summary]);

  const coveragePct =
    typeof summary?.coverage === "number"
      ? Math.round(summary.coverage * 100)
      : null;
  const setName = summary?.name ?? summary?.set_name ?? null;
  const setYearValue = summary?.year ?? summary?.set_year;
  const setYear =
    typeof setYearValue === "number" || typeof setYearValue === "string"
      ? String(setYearValue)
      : null;

  const setLine = [
    setId ? `Set ${setId}` : "Buildability details",
    setName ? String(setName) : null,
    setYear,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="page buildability-details">
      <PageHero
        title="Buildability details"
        subtitle={setLine || "Compare what this set needs with what you already own."}
      >
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
            Coverage: {coveragePct !== null ? `${coveragePct}%` : "—"}
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
            Have:{" "}
            {summary?.total_have !== undefined
              ? summary.total_have.toLocaleString()
              : "—"}{" "}
            / Need:{" "}
            {summary?.total_needed !== undefined
              ? summary.total_needed.toLocaleString()
              : "—"}
          </span>
          {missingPiecesTotal > 0 && (
            <span
              className="hero-pill hero-pill--sort"
              style={{
                background: "rgba(220,38,38,0.22)",
                borderColor: "rgba(252,165,165,0.75)",
                color: "#fef2f2",
                fontWeight: 700,
                cursor: "pointer",
              }}
              onClick={() => {
                if (setId) navigate(`/buildability/${encodeURIComponent(setId)}/missing`);
              }}
            >
              Missing pieces: {missingPiecesTotal.toLocaleString()}
            </span>
          )}
        </div>
      </PageHero>

      {/* parts grid */}
      <div
        style={{
          maxWidth: "1600px",
          margin: "0 auto 2.5rem",
          padding: "0 1.5rem",
        }}
      >
        {!setId && !error && (
          <p style={{ fontSize: "0.92rem", color: "#94a3b8" }}>
            No set selected.
          </p>
        )}

        {loading && (
          <p style={{ fontSize: "0.92rem", color: "#94a3b8" }}>
            Loading buildability details…
          </p>
        )}

        {error && (
          <p style={{ color: "#ef4444", fontSize: "0.92rem" }}>{error}</p>
        )}

        {!loading && !error && setId && parts.length === 0 && (
          <p style={{ fontSize: "0.92rem", color: "#94a3b8" }}>
            No parts to display.
          </p>
        )}

        {!loading && !error && setId && parts.length > 0 && (
          <div
            className="tile-grid"
            style={{
              gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
              gap: "1.1rem",
              alignItems: "stretch",
              marginTop: "0.5rem",
            }}
          >
            {parts.map((p) => {
              const key = `${p.part_num}-${p.color_id}`;
              const missing = missingMap.get(key);
              const need = missing?.need ?? p.quantity ?? 0;
              const have = missing ? missing.have : need;

              return (
                <BuildabilityPartsTile
                  key={key}
                  part={{
                    part_num: p.part_num,
                    color_id: p.color_id,
                    qty_total: have,
                    part_img_url: p.part_img_url ?? undefined,
                  }}
                  need={need}
                  have={have}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

// OUTER: real exported page with auth
const BuildabilityDetailsPage: React.FC = () => (
  <RequireAuth pageName="buildability details">
    <BuildabilityDetailsInner />
  </RequireAuth>
);

export default BuildabilityDetailsPage;
