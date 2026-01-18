import React, { useEffect, useMemo, useState } from "react";
import { API_BASE } from "../api/client";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { authHeaders } from "../utils/auth";
import RequireAuth from "../components/RequireAuth";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import PageHero from "../components/PageHero";
import InstructionsTile from "../components/InstructionsTile";

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

type BuildabilityDetailsInnerProps = {
  demo: boolean;
};

// INNER IMPLEMENTATION
const BuildabilityDetailsInner: React.FC<BuildabilityDetailsInnerProps> = ({
  demo,
}) => {
  // match App.tsx: path="/buildability/:setNum"
  const { setNum } = useParams<{ setNum: string }>();
  const setId = setNum;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CompareResult | null>(null);
  const [parts, setParts] = useState<CatalogPart[]>([]);
  const [setImgUrl, setSetImgUrl] = useState<string | null>(null);

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
        setSetImgUrl(null);

        const base = (setId || "").trim();

        const fetchMeta = async () => {
          try {
            const searchUrl = `${API_BASE}/api/search?q=${encodeURIComponent(base)}`;
            const r = await fetch(searchUrl, {
              headers,
              signal: controller.signal,
            });

            if (r.ok) {
              const list = (await r.json()) as any[];
              const hit =
                list.find((x) => x?.set_num === base) || list[0] || null;
              setSetImgUrl((hit?.img_url ?? null) as any);

              if (demo && hit) {
                setSummary((prev) =>
                  prev
                    ? {
                        ...prev,
                        name: hit?.name ?? hit?.set_name ?? null,
                        year: hit?.year ?? hit?.set_year ?? null,
                      }
                    : prev
                );
              }
            } else {
              setSetImgUrl(null);
            }
          } catch {
            setSetImgUrl(null);
          }
        };

        if (demo) {
          const partsUrl = `${API_BASE}/api/catalog/parts?set=${encodeURIComponent(
            setId
          )}`;
          const partsRes = await fetch(partsUrl, {
            headers,
            signal: controller.signal,
          });

          if (!partsRes.ok) {
            const txt = await partsRes.text();
            throw new Error(
              `Parts lookup failed (${partsRes.status}): ${txt || partsRes.statusText}`
            );
          }

          const partsJson = (await partsRes.json()) as CatalogPart[];
          const safeParts = Array.isArray(partsJson) ? partsJson : [];

          setParts(safeParts);

          const totalNeeded = safeParts.reduce(
            (sum, p) => sum + (p.quantity ?? 0),
            0
          );
          const missingParts = safeParts.map((p) => ({
            part_num: p.part_num,
            color_id: p.color_id,
            need: p.quantity ?? 0,
            have: 0,
            short: p.quantity ?? 0,
          }));

          setSummary({
            set_num: setId,
            coverage: 0,
            total_needed: totalNeeded,
            total_have: 0,
            missing_parts: missingParts,
          });

          await fetchMeta();
          return;
        }

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
            `Compare failed (${compareRes.status}): ${txt || compareRes.statusText}`
          );
        }
        if (!partsRes.ok) {
          const txt = await partsRes.text();
          throw new Error(
            `Parts lookup failed (${partsRes.status}): ${txt || partsRes.statusText}`
          );
        }

        const compareJson = (await compareRes.json()) as CompareResult;
        const partsJson = (await partsRes.json()) as CatalogPart[];

        setSummary(compareJson);
        setParts(partsJson);

        await fetchMeta();
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
  }, [setId, demo]);

  const missingMap = useMemo(() => {
    const map = new Map<string, MissingPart>();

    if (demo) {
      for (const p of parts) {
        map.set(`${p.part_num}-${p.color_id}`, {
          part_num: p.part_num,
          color_id: p.color_id,
          need: p.quantity ?? 0,
          have: 0,
          short: p.quantity ?? 0,
        });
      }
      return map;
    }

    if (!summary) return map;
    for (const m of summary.missing_parts || []) {
      map.set(`${m.part_num}-${m.color_id}`, m);
    }
    return map;
  }, [demo, parts, summary]);

  const missingPiecesTotal = useMemo(() => {
    if (demo) {
      return parts.reduce((total, p) => total + (p.quantity ?? 0), 0);
    }
    if (!summary?.missing_parts) return 0;

    return summary.missing_parts.reduce((total, m) => {
      const short =
        typeof m.short === "number"
          ? m.short
          : Math.max((m.need ?? 0) - (m.have ?? 0), 0);
      return total + short;
    }, 0);
  }, [demo, parts, summary]);

  const coveragePct = demo
    ? 0
    : typeof summary?.coverage === "number"
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
      <style>{`
        .demo-banner {
          z-index: 5;
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
          pointer-events: auto;
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

      `}</style>
      <PageHero
        title="Buildability details"
        subtitle={setLine || "Compare what this set needs with what you already own."}
      >
        <div className="heroTwoCol">
          <div className="heroLeft">
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
                    if (setId)
                      navigate(`/buildability/${encodeURIComponent(setId)}/missing`);
                  }}
                >
                  Missing pieces: {missingPiecesTotal.toLocaleString()}
                </span>
              )}
            </div>
          </div>

          <div className="heroRight">
            <div style={{ width: "clamp(180px, 22vw, 240px)", aspectRatio: "220 / 140" }}>
              <InstructionsTile setNum={setId || ""} imgUrl={setImgUrl} />
            </div>
          </div>
        </div>
      </PageHero>

      {demo && (
        <div className="demo-banner">
          <div>
            <strong>Demo mode</strong>
            <div style={{ fontSize: 13, opacity: 0.9 }}>
              Viewing this set with zero inventory.
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" onClick={() => navigate("/account?mode=login")}>
              Sign in
            </button>
            <button type="button" onClick={() => navigate("/account?mode=signup")}>
              Create account
            </button>
          </div>
        </div>
      )}

      {/* parts grid */}
      <div
        style={{
          maxWidth: "none",
          margin: "0 0 2.5rem",
          padding: "0",
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

        {error && <p style={{ color: "#ef4444", fontSize: "0.92rem" }}>{error}</p>}

        {!loading && !error && setId && parts.length === 0 && (
          <p style={{ fontSize: "0.92rem", color: "#94a3b8" }}>
            No parts to display.
          </p>
        )}

        {!loading && !error && setId && parts.length > 0 && (
          <div
            className="parts-grid"
            style={{
              gap: "1.1rem",
              alignItems: "stretch",
              marginTop: "0.5rem",
            }}
          >
            {parts.map((p) => {
              const key = `${p.part_num}-${p.color_id}`;
              const missing = missingMap.get(key);
              const need = demo ? p.quantity ?? 0 : missing?.need ?? p.quantity ?? 0;
              const have = demo ? 0 : missing ? missing.have : need;

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
const BuildabilityDetailsPage: React.FC = () => {
  const location = useLocation();
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  const content = <BuildabilityDetailsInner demo={demo} />;

  if (demo) return content;

  return (
    <RequireAuth pageName="buildability details">
      {content}
    </RequireAuth>
  );
};

export default BuildabilityDetailsPage;
