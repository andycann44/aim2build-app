/// <reference types="vite/client" />
import * as React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../api/client";
import BuildabilityTile, { BuildabilityItem } from "../components/BuildabilityTile";
import PageHero from "../components/PageHero";
import RequireAuth from "../components/RequireAuth";
import { authHeaders } from "../utils/auth";

type DiscoverRow = {
  set_num: string;
  coverage: number;
  total_needed: number;
  total_have: number;
  name?: string | null;
  year?: number | null;
  img_url?: string | null;
  num_parts?: number | null;
};

const CACHE_PREFIX = "a2b:buildability:discover:v1";
const PAGE_SIZE = 20;

function readCache(key: string): DiscoverRow[] | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return parsed as DiscoverRow[];
  } catch {
    return null;
  }
}

function writeCache(key: string, rows: DiscoverRow[]) {
  try {
    localStorage.setItem(key, JSON.stringify(rows));
  } catch {
    // ignore
  }
}

function toBuildabilityItem(r: DiscoverRow): BuildabilityItem {
  return {
    set_num: r.set_num,
    name: r.name || r.set_num,
    year: r.year ?? undefined,
    img_url: r.img_url ?? undefined,
    num_parts: r.num_parts ?? undefined,
    coverage: r.coverage,
    total_needed: r.total_needed,
    total_have: r.total_have,
  };
}

function clampInt(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

function _is401(res: Response) {
  return res.status === 401 || res.status === 403;
}

// Avoid cross-user cache bleed (new user after wipe still seeing old cached results)
function authFingerprint(): string {
  try {
    const t =
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("auth_token") ||
      "";
    if (!t) return "anon";
    return `t:${t.slice(-12)}`;
  } catch {
    return "anon";
  }
}

function BuildabilityDiscoverInner({ demo }: { demo: boolean }) {
  const nav = useNavigate();

  const [minPct, setMinPct] = React.useState<number>(90);
  const [include100, setInclude100] = React.useState<boolean>(false);

  const [includeOwned, setIncludeOwned] = React.useState<boolean>(false);
  const [ownedSetNums, setOwnedSetNums] = React.useState<Set<string>>(new Set());

  const [minNeedText, setMinNeedText] = React.useState<string>("");
  const [maxNeedText, setMaxNeedText] = React.useState<string>("");

  const [page, setPage] = React.useState<number>(1);

  const [rows, setRows] = React.useState<DiscoverRow[] | null>(null);
  const [err, setErr] = React.useState<string>("");
  const [busy, setBusy] = React.useState<boolean>(false);

  const fp = React.useMemo(() => authFingerprint(), []);
  const cacheKey = React.useMemo(
    () => `${CACHE_PREFIX}:${fp}:${minPct}:${include100 ? 1 : 0}`,
    [fp, minPct, include100]
  );

  const runIdRef = React.useRef(0);
  const abortRef = React.useRef<AbortController | null>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load "My Sets" once so we can hide owned sets in Discover (client-side filter)
  React.useEffect(() => {
    if (demo) return;

    let alive = true;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/mysets?limit=1000`, {
          headers: authHeaders(),
        });

        if (_is401(res)) return;
        if (!res.ok) return;

        const data = await res.json();
        const arr = Array.isArray(data) ? data : data?.sets ?? [];
        const nums = new Set<string>(
          (arr || [])
            .map((s: any) => String(s?.set_num ?? s?.set ?? s?.id ?? "").trim())
            .filter(Boolean)
        );

        if (alive) setOwnedSetNums(nums);
      } catch {
        // ignore
      }
    })();

    return () => {
      alive = false;
    };
  }, [demo]);

  const run = React.useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const key = cacheKey;
      const runId = ++runIdRef.current;

      // cancel any in-flight request BEFORE starting a new one
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      if (!force) {
        const cached = readCache(key);
        if (cached) {
          setErr("");
          setRows(cached);
          setBusy(false);
          setPage(1);
          return;
        }
      }

      setBusy(true);
      setErr("");

      try {
        const minCoverage = Math.max(0.0, Math.min(1.0, minPct / 100));
        const url =
          `${API_BASE}/api/buildability/discover` +
          `?min_coverage=${encodeURIComponent(minCoverage.toFixed(2))}` +
          `&limit=${encodeURIComponent(200)}` +
          `&include_100=${include100 ? "1" : "0"}`;

        const res = await fetch(url, {
          headers: authHeaders(),
          signal: controller.signal,
        });

        if (runId !== runIdRef.current) return; // stale

        if (_is401(res)) {
          if (!demo) {
            const from = encodeURIComponent("/buildability/discover");
            window.location.href = `/account?mode=login&reason=expired&from=${from}`;
          }
          return;
        }

        if (!res.ok) {
          const t = await res.text().catch(() => "");
          throw new Error(t || `HTTP ${res.status}`);
        }

        const data = (await res.json()) as DiscoverRow[];
        if (runId !== runIdRef.current) return;

        const out = Array.isArray(data) ? data : [];
        setRows(out);
        writeCache(key, out);
        setPage(1);
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        if (runId !== runIdRef.current) return;
        setErr(e?.message || "Failed to load discover results.");
        setRows([]);
      } finally {
        if (runId === runIdRef.current) setBusy(false);
      }
    },
    [cacheKey, minPct, include100, demo]
  );

  // Debounce when changing filters
  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    debounceRef.current = setTimeout(() => {
      run();
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [minPct, include100, run]);

  // Filter rows client-side
  const visibleRows = React.useMemo(() => {
    if (!rows) return rows;

    let out = rows;

    // Always hide minifig "sets"
    out = out.filter((r) => {
      const sn = String(r?.set_num ?? "").toLowerCase();
      if (sn.startsWith("fig-")) return false;

      const nm = String(r?.name ?? "").toLowerCase();
      if (nm.includes("minifig") || nm.includes("minifigure")) return false;

      return true;
    });

    // Hide owned sets by default
    if (!includeOwned && ownedSetNums.size) {
      out = out.filter((r) => !ownedSetNums.has(String(r.set_num)));
    }

    // Parts qty filter (BOM total_needed)
    const minRaw = (minNeedText || "").trim();
    const maxRaw = (maxNeedText || "").trim();

    const minN = minRaw === "" ? 0 : clampInt(parseInt(minRaw, 10), 0, 999999999);
    const maxN = maxRaw === "" ? 0 : clampInt(parseInt(maxRaw, 10), 0, 999999999);

    if (minN > 0) out = out.filter((r) => (r.total_needed ?? 0) >= minN);
    if (maxN > 0) out = out.filter((r) => (r.total_needed ?? 0) <= maxN);

    return out;
  }, [rows, includeOwned, ownedSetNums, minNeedText, maxNeedText]);

  const pageCount = React.useMemo(() => {
    if (!visibleRows) return 1;
    return Math.max(1, Math.ceil(visibleRows.length / PAGE_SIZE));
  }, [visibleRows]);

  const pageSafe = Math.min(Math.max(1, page), pageCount);

  React.useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSafe]);

  const pagedRows = React.useMemo(() => {
    if (!visibleRows) return visibleRows;
    const start = (pageSafe - 1) * PAGE_SIZE;
    return visibleRows.slice(start, start + PAGE_SIZE);
  }, [visibleRows, pageSafe]);

  console.log("A2B_DISCOVER_UI=v1");

  return (
    <div className="page">
      <PageHero
        title="Discover builds"
        subtitle="Sets you can almost build from your current inventory."
        right={
          <button
            type="button"
            className="a2b-hero-button"
            onClick={() => run({ force: true })}
            disabled={busy}
          >
            {busy ? "Loading..." : "Refresh"}
          </button>
        }
      >
        <div
          className="a2b-discover-hero__controls"
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.6rem",
            alignItems: "center",
          }}
        >
          <div className="hero-sliderRow">
            <div className="hero-sliderMeta">
              <span>Min buildability</span>
              <strong>{minPct}%</strong>
            </div>
            <input
              type="range"
              min={50}
              max={99}
              step={1}
              value={minPct}
              onChange={(e) => {
                setMinPct(parseInt(e.target.value || "90", 10));
                setPage(1);
              }}
            />
          </div>

          <label className="hero-checkRow">
            <input
              type="checkbox"
              checked={include100}
              onChange={(e) => {
                setInclude100(!!e.target.checked);
                setPage(1);
              }}
            />
            <span>Include 100% complete sets</span>
          </label>

          <button
            type="button"
            className="hero-pill"
            onClick={() => {
              setIncludeOwned((v) => !v);
              setPage(1);
            }}
            style={{ gap: "0.5rem" }}
          >
            {includeOwned ? "Hide sets I already own" : "Show sets I already own"}
          </button>

          <div
            className="hero-pill"
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.5rem 0.75rem",
            }}
          >
            <span style={{ fontWeight: 800 }}>Parts qty</span>

            <div
              className="hero-partsBubble"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1 }}
            >
              <span style={{ opacity: 0.8 }}>Min</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="(any)"
                value={minNeedText}
                onChange={(e) => {
                  const v = (e.target.value || "").replace(/[^\d]/g, "");
                  setMinNeedText(v);
                  setPage(1);
                }}
                style={{
                  width: "6.25rem",
                  padding: "0.3rem 0.4rem",
                  borderRadius: "0.5rem",
                  border: "1px solid rgba(15,23,42,0.18)",
                }}
              />

              <span style={{ opacity: 0.8 }}>Max</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder="(any)"
                value={maxNeedText}
                onChange={(e) => {
                  const v = (e.target.value || "").replace(/[^\d]/g, "");
                  setMaxNeedText(v);
                  setPage(1);
                }}
                style={{
                  width: "6.25rem",
                  padding: "0.3rem 0.4rem",
                  borderRadius: "0.5rem",
                  border: "1px solid rgba(15,23,42,0.18)",
                }}
              />

              <button
                type="button"
                className="a2b-hero-button"
                onClick={() => {
                  setMinNeedText("");
                  setMaxNeedText("");
                  setPage(1);
                }}
                style={{ padding: "0.35rem 0.6rem" }}
              >
                Clear
              </button>
            </div>
          </div>
        </div>
      </PageHero>

      {demo ? (
        <div className="demo-banner tile-style">
          <strong>DEMO MODE</strong>
          <div style={{ marginTop: 4 }}>
            You're viewing a demo. Sign in or create an account to use your real inventory and save
            progress.
          </div>
          <div style={{ marginTop: 8 }}>
            <a href="/account?mode=login">Sign in</a> &middot;{" "}
            <a href="/account?mode=signup">Create account</a>
          </div>
        </div>
      ) : null}

      <div style={{ padding: "0 1.5rem 2.5rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            justifyContent: "space-between",
            gap: "1rem",
          }}
        >
          <h2
            style={{
              margin: "0 0 0.65rem",
              fontSize: "1.1rem",
              fontWeight: 800,
              color: "#0f172a",
            }}
          >
            Discoverable sets
          </h2>

          {visibleRows ? (
            <div style={{ fontSize: "0.85rem", color: "#64748b" }}>
              Showing {pagedRows ? pagedRows.length : 0} of {visibleRows.length}
            </div>
          ) : null}
        </div>

        {err ? (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.55)",
              color: "#b91c1c",
              fontSize: "0.9rem",
            }}
          >
            {err}
          </div>
        ) : null}

        {!rows ? <p style={{ fontSize: "0.9rem", opacity: 0.8 }}>Loading…</p> : null}

        {pagedRows ? (
          pagedRows.length === 0 ? (
            <>
              <p style={{ fontSize: "0.9rem", color: "#6b7280", marginBottom: "0.75rem" }}>
                No results at <strong>{minPct}%</strong>.
              </p>

              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="a2b-hero-button a2b-cta-dark"
                  onClick={() => {
                    setMinPct(80);
                    setPage(1);
                  }}
                >
                  Try 80%
                </button>

                <button
                  type="button"
                  className="a2b-hero-button a2b-cta-dark"
                  onClick={() => {
                    setMinPct(70);
                    setPage(1);
                  }}
                >
                  Try 70%
                </button>

                <button
                  type="button"
                  className="a2b-hero-button a2b-cta-dark"
                  onClick={() => {
                    setMinNeedText("");
                    setMaxNeedText("");
                    setIncludeOwned(false);
                    setPage(1);
                  }}
                >
                  Clear filters
                </button>

                <button
                  type="button"
                  className="a2b-hero-button"
                  onClick={() => run({ force: true })}
                  disabled={busy}
                >
                  {busy ? "Loading..." : "Refresh"}
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="tile-grid">
                {pagedRows.map((r) => (
                  <BuildabilityTile
                    key={r.set_num}
                    item={toBuildabilityItem(r)}
                    onOpenDetails={() => nav(`/buildability/${encodeURIComponent(r.set_num)}`)}
                  />
                ))}
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: "0.6rem",
                  marginTop: "1.2rem",
                }}
              >
                <button
                  type="button"
                  className="a2b-hero-button a2b-cta-dark"
                  disabled={pageSafe <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>

                <div style={{ fontSize: "0.9rem", color: "#0f172a" }}>
                  Page <strong>{pageSafe}</strong> of <strong>{pageCount}</strong>
                </div>

                <button
                  type="button"
                  className="a2b-hero-button a2b-cta-dark"
                  disabled={pageSafe >= pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                >
                  Next
                </button>
              </div>
            </>
          )
        ) : null}
      </div>
    </div>
  );
}

function BuildabilityDiscoverPage() {
  const location = useLocation();
  const demo = new URLSearchParams(location.search).get("demo") === "1";

  const content = <BuildabilityDiscoverInner demo={demo} />;

  if (demo) return content;
  return <RequireAuth pageName="Buildability Discover">{content}</RequireAuth>;
}

export default BuildabilityDiscoverPage;