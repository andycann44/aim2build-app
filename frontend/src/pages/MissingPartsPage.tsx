/// <reference types="vite/client" />
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import RequireAuth from "../components/RequireAuth";
import { authHeaders, getToken } from "../utils/auth";
import { API_BASE } from "../api/client";

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

const MissingPartsInner: React.FC = () => {
  const { setNum } = useParams<{ setNum: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<CompareResult | null>(null);
  const [stagedHaveByKey, setStagedHaveByKey] = useState<Record<string, number>>({});

  // Simple plan gate: signed-in users get add controls, others read-only
  const isPro = useMemo(() => !!getToken(), []);

  const load = useCallback(async () => {
    if (!setNum) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API_BASE}/api/buildability/compare?set=${encodeURIComponent(setNum)}`,
        { headers: { ...authHeaders() } }
      );
      if (!res.ok) {
        const txt = await res.text().catch(() => "");
        throw new Error(txt || `Compare failed (${res.status} ${res.statusText})`);
      }
      const data = (await res.json()) as CompareResult;
      setSummary(data);
      const staged: Record<string, number> = {};
      (data?.missing_parts || []).forEach((m) => {
        const key = `${m.part_num}-${m.color_id}`;
        staged[key] = typeof m.have === "number" ? m.have : 0;
      });
      setStagedHaveByKey(staged);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to load missing parts.");
    } finally {
      setLoading(false);
    }
  }, [setNum]);

  useEffect(() => {
    void load();
  }, [load]);

  const missingCount = useMemo(() => {
    if (!summary?.missing_parts) return 0;
    return summary.missing_parts.reduce(
      (acc, m) => acc + (typeof m.short === "number" ? m.short : 0),
      0
    );
  }, [summary]);

  // Stage adjustments only; apply later
  const adjustStaged = useCallback((key: string, delta: number) => {
    setStagedHaveByKey((prev) => {
      const next = { ...prev };
      const current = Number.isFinite(prev[key]) ? prev[key] : 0;
      next[key] = Math.max(0, current + delta);
      return next;
    });
  }, []);

  const applyPending = useCallback(async () => {
    if (!summary?.missing_parts?.length) return;
    try {
      setError(null);
      for (const m of summary.missing_parts) {
        const key = `${m.part_num}-${m.color_id}`;
        const originalHave = typeof m.have === "number" ? m.have : 0;
        const stagedHave = Number.isFinite(stagedHaveByKey[key])
          ? stagedHaveByKey[key]
          : originalHave;
        if (stagedHave === originalHave) continue;

        if (stagedHave > originalHave) {
          const qty = stagedHave - originalHave;
          await fetch(`${API_BASE}/api/inventory/add-canonical`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeaders(),
            },
            body: JSON.stringify({ part_num: m.part_num, color_id: m.color_id, qty }),
          }).then(async (res) => {
            if (!res.ok) {
              const txt = await res.text().catch(() => "");
              throw new Error(txt || `Failed to add part (${res.status})`);
            }
          });
        } else {
          const delta = originalHave - stagedHave;
          await fetch(`${API_BASE}/api/inventory/decrement-canonical`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...authHeaders(),
            },
            body: JSON.stringify({ part_num: m.part_num, color_id: m.color_id, delta }),
          }).then(async (res) => {
            if (!res.ok) {
              const txt = await res.text().catch(() => "");
              throw new Error(txt || `Failed to decrement part (${res.status})`);
            }
          });
        }
      }
      await load();
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to update inventory.");
    }
  }, [summary, stagedHaveByKey, load]);
  const setLine =
    summary?.set_num && summary.set_num.trim()
      ? `Set ${summary.set_num}`
      : setNum
      ? `Set ${setNum}`
      : "Missing parts";

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

      {/* HERO – match buildability styling */}
      <div
        className="search-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          borderRadius: "18px",
          padding: "1.75rem 1.5rem 1.5rem",
          background:
            "linear-gradient(135deg, #0b1120 0%, #1d4ed8 35%, #fbbf24 70%, #dc2626 100%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
          marginTop: "1.5rem",
          marginRight: "2.5rem",
          marginBottom: "1.5rem",
          marginLeft: 0,
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "0 0 auto 0",
            height: "10px",
            display: "flex",
            gap: "2px",
            padding: "0 8px",
          }}
        >
          {["#dc2626", "#f97316", "#fbbf24", "#22c55e", "#0ea5e9", "#6366f1"].map(
            (c, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderRadius: "99px",
                  background: c,
                  opacity: 0.9,
                }}
              />
            )
          )}
        </div>

        <div style={{ position: "relative", zIndex: 1, marginTop: "1.75rem" }}>
          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: 800,
              letterSpacing: "0.03em",
              margin: 0,
              textShadow: "0 2px 6px rgba(0,0,0,0.45)",
            }}
          >
            Missing parts
          </h1>

          <p
            style={{
              margin: 0,
              marginTop: "0.25rem",
              fontSize: "0.9rem",
              lineHeight: 1.45,
              opacity: 0.92,
              maxWidth: "640px",
            }}
          >
            {setLine}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.55rem",
              alignItems: "center",
              marginTop: "0.85rem",
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
              Coverage:{" "}
              {typeof summary?.coverage === "number"
                ? `${Math.round(summary.coverage * 100)}%`
                : "—"}
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
              Need:{" "}
              {summary?.total_needed !== undefined
                ? summary.total_needed.toLocaleString()
                : "—"}
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

            <button
              type="button"
              onClick={() => {
                if (setNum) navigate(`/buildability/${encodeURIComponent(setNum)}`);
                else navigate(-1);
              }}
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
              ← Back to details
            </button>
            <button
              type="button"
              onClick={() => void applyPending()}
              disabled={!isPro}
              style={{
                borderRadius: 999,
                border: "1px solid rgba(34,197,94,0.7)",
                background: isPro
                  ? "linear-gradient(135deg,#22c55e,#16a34a)"
                  : "rgba(15,23,42,0.08)",
                color: isPro ? "#fff" : "#6b7280",
                padding: "0.35rem 0.85rem",
                fontWeight: 700,
                cursor: isPro ? "pointer" : "not-allowed",
              }}
            >
              Update inventory
            </button>
          </div>
        </div>
      </div>

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

        {!loading && !error && (!summary || !summary.missing_parts.length) && (
          <p style={{ fontSize: "0.92rem", color: "#94a3b8" }}>
            No missing parts for this set.
          </p>
        )}

        {!loading && !error && summary?.missing_parts?.length ? (
          <div className="tile-grid tile-grid--5" style={{ marginTop: "0.5rem" }}>
            {summary.missing_parts.map((m) => {
              const key = `${m.part_num}-${m.color_id}`;
              const need = typeof m.need === "number" ? m.need : 0;
              const originalHave = typeof m.have === "number" ? m.have : 0;
              const stagedHave = Number.isFinite(stagedHaveByKey[key])
                ? stagedHaveByKey[key]
                : originalHave;
              const short = Math.max(need - stagedHave, 0);

              return (
                <BuildabilityPartsTile
                  key={key}
                  part={{
                    part_num: m.part_num,
                    color_id: m.color_id,
                    part_img_url: m.part_img_url ?? undefined,
                  }}
                  need={need}
                  have={stagedHave}
                  editableQty={isPro}
                  onChangeQty={async (delta) => {
                    if (!isPro) {
                      setError("Sign in to adjust missing parts.");
                      return;
                    }
                    adjustStaged(key, delta);
                  }}
                />
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
};

const MissingPartsPage: React.FC = () => (
  <RequireAuth pageName="missing parts">
    <MissingPartsInner />
  </RequireAuth>
);

export default MissingPartsPage;
