import React, { useEffect, useMemo, useState, useRef } from "react";
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
  display_img_url?: string | null;
  is_printed?: boolean | null;
  is_sticker?: boolean | null;
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

function _is401(res: Response) {
  return res.status === 401 || res.status === 403;
}

const BuildabilityDetailsInner: React.FC<BuildabilityDetailsInnerProps> = ({ demo }) => {
  const { setNum } = useParams<{ setNum: string }>();
  const setId = (setNum || "").trim();
  const navigate = useNavigate();

  // Phase states
  const [loadingCompare, setLoadingCompare] = useState(true);
  const [loadingParts, setLoadingParts] = useState(true);

  const [errorCompare, setErrorCompare] = useState<string | null>(null);
  const [errorParts, setErrorParts] = useState<string | null>(null);

  const [summary, setSummary] = useState<CompareResult | null>(null);
  const [parts, setParts] = useState<CatalogPart[]>([]);
  const [setImgUrl, setSetImgUrl] = useState<string | null>(null);


  // React 18 StrictMode (dev) runs effects twice. Guard per setId+demo.
  const compareKeyRef = useRef<string>("");
  const partsKeyRef = useRef<string>("");
  const metaKeyRef = useRef<string>("");

  // -----------------------
  // Progressive parts rendering (scroll-driven)
  // -----------------------
  const INITIAL_RENDER = 60;
  const STEP = 40;

  const [visibleCount, setVisibleCount] = useState(INITIAL_RENDER);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setVisibleCount(INITIAL_RENDER);
  }, [parts.length]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          setVisibleCount((v) => Math.min(parts.length, v + STEP));
        }
      },
      { root: null, rootMargin: "800px 0px", threshold: 0.01 }
    );

    io.observe(el);
    return () => io.disconnect();
  }, [parts.length]);

  const visibleParts = useMemo(() => parts.slice(0, visibleCount), [parts, visibleCount]);

  // -----------------------
  // Phase 0: validate route param (instant)
  // -----------------------
  useEffect(() => {
    if (!setId) {
      setErrorCompare("No set selected.");
      setLoadingCompare(false);
      setLoadingParts(false);
      return;
    }
    // reset for new set
    compareKeyRef.current = "";
    partsKeyRef.current = "";
    metaKeyRef.current = "";

    setSummary(null);
    setParts([]);
    setSetImgUrl(null);
    setErrorCompare(null);
    setErrorParts(null);
    setLoadingCompare(true);
    setLoadingParts(true);
  }, [setId]);

  // -----------------------
  // Phase 1: compare first (fast)
  // -----------------------
  useEffect(() => {
    if (!setId) return;

    const key = `${setId}|${demo}`;
    if (compareKeyRef.current === key) return;
    compareKeyRef.current = key;

    const controller = new AbortController();
    const headers = authHeaders();

    async function loadCompare() {
      try {
        setLoadingCompare(true);
        setErrorCompare(null);

        if (demo) {
          setSummary({
            set_num: setId,
            coverage: 0,
            total_needed: 0,
            total_have: 0,
            missing_parts: [],
          });
          return;
        }

        const compareUrl = `${API_BASE}/api/buildability/compare?set=${encodeURIComponent(setId)}`;
        const res = await fetch(compareUrl, { headers, signal: controller.signal });

        if (_is401(res)) {
          navigate(`/account?mode=login`, { replace: true });
          return;
        }

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Compare failed (${res.status}): ${txt || res.statusText}`);
        }

        const compareJson = (await res.json()) as CompareResult;
        setSummary(compareJson);
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Compare load failed:", err);
        setErrorCompare(err?.message ?? "Failed to load buildability compare.");
      } finally {
        setLoadingCompare(false);
      }
    }

    loadCompare();
    return () => controller.abort();
  }, [setId, demo, navigate]);

  // -----------------------
  // Phase 2: parts after compare (heavy grid)
  // -----------------------
  useEffect(() => {
    if (!setId) return;

    const key = `${setId}|${demo}`;
    if (partsKeyRef.current === key) return;
    partsKeyRef.current = key;

    const controller = new AbortController();
    const headers = authHeaders();

    function groupPartsV2(rows: CatalogPart[]): CatalogPart[] {
      const m = new Map<string, CatalogPart>();

      for (const r of rows || []) {
        const part_num = String(r.part_num || "").trim();
        const color_id = Number(r.color_id ?? 0);
        if (!part_num) continue;

        const k = `${part_num}-${color_id}`;
        const prev = m.get(k);

        if (!prev) {
          m.set(k, { ...r, part_num, color_id, quantity: Number(r.quantity ?? 0) });
        } else {
          prev.quantity = Number(prev.quantity ?? 0) + Number(r.quantity ?? 0);
          if (!prev.part_img_url && r.part_img_url) prev.part_img_url = r.part_img_url;
          if (!prev.part_name && r.part_name) prev.part_name = r.part_name;
          if (!prev.display_img_url && r.display_img_url) prev.display_img_url = r.display_img_url;
        }
      }
      return Array.from(m.values());
    }

    async function loadParts() {
      try {
        setLoadingParts(true);
        setErrorParts(null);

        const partsUrl = `${API_BASE}/api/catalog/parts-v2?set=${encodeURIComponent(setId)}`;
        const res = await fetch(partsUrl, { headers, signal: controller.signal });

        if (_is401(res)) {
          navigate(`/account?mode=login`, { replace: true });
          return;
        }

        if (!res.ok) {
          const txt = await res.text();
          throw new Error(`Parts lookup failed (${res.status}): ${txt || res.statusText}`);
        }

        const partsJson = (await res.json()) as CatalogPart[];
        const safeParts = Array.isArray(partsJson) ? partsJson : [];
        setParts(groupPartsV2(safeParts));

        if (demo) {
          const totalNeeded = safeParts.reduce((sum, p) => sum + (p.quantity ?? 0), 0);
          const missingParts = safeParts.map((p) => ({
            part_num: p.part_num,
            color_id: p.color_id,
            need: p.quantity ?? 0,
            have: 0,
            short: p.quantity ?? 0,
          }));

          setSummary((prev) => ({
            set_num: setId,
            coverage: 0,
            total_needed: totalNeeded,
            total_have: 0,
            missing_parts: missingParts,
            name: prev?.name ?? null,
            year: prev?.year ?? null,
          }));
        }
      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error("Parts load failed:", err);
        setErrorParts(err?.message ?? "Failed to load catalog parts.");
      } finally {
        setLoadingParts(false);
      }
    }

    // tiny delay so hero paints first
    const t = window.setTimeout(loadParts, 50);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [setId, demo, navigate]);

  // -----------------------
  // Phase 3: optional meta image/name (lowest priority)
  // -----------------------
  useEffect(() => {
    if (!setId) return;

    const key = `${setId}|${demo}`;
    if (metaKeyRef.current === key) return;
    metaKeyRef.current = key;

    const controller = new AbortController();
    const headers = authHeaders();

    async function loadMeta() {
      try {
        const searchUrl = `${API_BASE}/api/search?q=${encodeURIComponent(setId)}`;
        const r = await fetch(searchUrl, { headers, signal: controller.signal });
        if (!r.ok) return;

        const list = (await r.json()) as any[];
        const hit = list.find((x) => x?.set_num === setId) || list[0] || null;

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
      } catch {
        // ignore
      }
    }

    const t = window.setTimeout(loadMeta, 250);
    return () => {
      window.clearTimeout(t);
      controller.abort();
    };
  }, [setId, demo]);

  // -----------------------
  // Derived maps
  // -----------------------
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
        typeof m.short === "number" ? m.short : Math.max((m.need ?? 0) - (m.have ?? 0), 0);
      return total + short;
    }, 0);
  }, [demo, parts, summary]);

  const coveragePct =
    demo ? 0 : typeof summary?.coverage === "number" ? Math.round(summary.coverage * 100) : null;

  const setName = summary?.name ?? summary?.set_name ?? null;
  const setYearValue = summary?.year ?? summary?.set_year;
  const setYear =
    typeof setYearValue === "number" || typeof setYearValue === "string" ? String(setYearValue) : null;

  const setLine = [setId ? `Set ${setId}` : "Buildability details", setName ? String(setName) : null, setYear]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="page buildability-details">
      <PageHero title="Buildability details" subtitle={setLine || "Compare what this set needs with what you already own."}>
        <div className="heroTwoCol">
          <div className="heroLeft">
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.55rem", alignItems: "center" }}>
              <span
                className="hero-pill hero-pill--sort"
                style={{
                  background: "rgba(15,23,42,0.55)",
                  borderColor: "rgba(255,255,255,0.75)",
                  color: "#f8fafc",
                  fontWeight: 700,
                }}
              >
                Coverage: {loadingCompare ? "Loading…" : coveragePct !== null ? `${coveragePct}%` : "—"}
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
                {loadingCompare ? "…" : summary?.total_have !== undefined ? summary.total_have.toLocaleString() : "—"} / Need:{" "}
                {loadingCompare ? "…" : summary?.total_needed !== undefined ? summary.total_needed.toLocaleString() : "—"}
              </span>

              {!loadingCompare && missingPiecesTotal > 0 && (
                <span
                  className="hero-pill hero-pill--sort"
                  style={{
                    background: "rgba(220,38,38,0.22)",
                    borderColor: "rgba(252,165,165,0.75)",
                    color: "#fef2f2",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                  onClick={() => navigate(`/buildability/${encodeURIComponent(setId)}/missing`)}
                >
                  Missing pieces: {missingPiecesTotal.toLocaleString()}
                </span>
              )}
            </div>

            {errorCompare && <div style={{ marginTop: 10, color: "#fecaca", fontSize: "0.9rem" }}>{errorCompare}</div>}
          </div>

          <div className="heroRight">
            <div style={{ width: "clamp(180px, 22vw, 240px)", aspectRatio: "220 / 140" }}>
              <InstructionsTile setNum={setId || ""} imgUrl={setImgUrl} />
            </div>
          </div>
        </div>
      </PageHero>

      {demo && (
        <div className="demo-banner tile-style">
          <strong>DEMO MODE</strong>
          <div style={{ marginTop: 4 }}>
            You're viewing a demo. Sign in or create an account to use your real inventory and save progress.
          </div>
          <div style={{ marginTop: 8 }}>
            <a href="/account?mode=login">Sign in</a>{" "}
            &middot;{" "}
            <a href="/account?mode=signup">Create account</a>
          </div>
        </div>
      )}

      {/* parts grid */}
      <div style={{ maxWidth: "none", margin: "0 0 2.5rem", padding: "0" }}>
        {errorParts && <p style={{ color: "#ef4444", fontSize: "0.92rem" }}>{errorParts}</p>}

        {loadingParts && <p style={{ fontSize: "0.92rem", color: "#94a3b8" }}>Loading parts…</p>}

        {!loadingParts && !errorParts && setId && parts.length === 0 && (
          <p style={{ fontSize: "0.92rem", color: "#94a3b8" }}>No parts to display.</p>
        )}

        {!loadingParts && !errorParts && setId && parts.length > 0 && (<>
          <div className="parts-grid" style={{ gap: "1.1rem", alignItems: "stretch", marginTop: "0.5rem" }}>
            {visibleParts.map((p) => {
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
          <div ref={sentinelRef} style={{ height: 1 }} />
        </>
        )}
      </div>
    </div>
  );
};

const BuildabilityDetailsPage: React.FC = () => {
  const location = useLocation();
  const demo = new URLSearchParams(location.search).get("demo") === "1";
  const content = <BuildabilityDetailsInner demo={demo} />;

  if (demo) return content;

  return <RequireAuth pageName="buildability details">{content}</RequireAuth>;
};

export default BuildabilityDetailsPage;