import * as React from "react";
import { useNavigate } from "react-router-dom";
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
  name?: string;
  year?: number;
  img_url?: string;
  num_parts?: number;
};

const API = API_BASE;
const DISCOVER_LIMIT = 200;
const CACHE_PREFIX = "a2b-discover:v1";

function apiUrl(path: string): string {
  if (!API) return path;
  return `${API}${path}`;
}

function toBuildabilityItem(r: DiscoverRow): BuildabilityItem {
  return {
    set_num: r.set_num,
    coverage: r.coverage,
    total_needed: r.total_needed,
    total_have: r.total_have,
    name: r.name,
    year: r.year,
    img_url: r.img_url,
    num_parts: r.num_parts,
  } as BuildabilityItem;
}

async function fetchText(url: string): Promise<{ ok: boolean; status: number; text: string }> {
  const res = await fetch(url, {
    method: "GET",
    headers: { ...authHeaders() },
  });
  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

type DiscoverFilters = {
  minCoverage: number;
  includeComplete: boolean;
  showOwned: boolean; // UI checkbox: checked = show owned sets
  limit: number;
};

function readCache(key: string): DiscoverRow[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.rows)) return null;
    return parsed.rows as DiscoverRow[];
  } catch {
    return null;
  }
}

function writeCache(key: string, rows: DiscoverRow[]): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(key, JSON.stringify({ rows, cached_at: Date.now() }));
  } catch {
    // ignore cache write failures
  }
}

async function fetchDiscover(filters: DiscoverFilters): Promise<DiscoverRow[]> {
  const params = new URLSearchParams();
  params.set("min_coverage", filters.minCoverage.toFixed(2));
  params.set("limit", String(filters.limit));
  params.set("include_complete", String(filters.includeComplete));
  // backend expects hide_owned; UI is showOwned => invert
  params.set("hide_owned", String(!filters.showOwned));

  const url = apiUrl(`/api/buildability/discover?${params.toString()}`);
  const { ok, status, text } = await fetchText(url);

  if (!ok) {
    throw new Error(`discover failed: ${status} ${text.slice(0, 180)}`);
  }

  try {
    const data = JSON.parse(text);
    return Array.isArray(data) ? (data as DiscoverRow[]) : [];
  } catch {
    throw new Error(`discover invalid JSON: ${text.slice(0, 180)}`);
  }
}

export default function BuildabilityDiscoverPage() {
  const nav = useNavigate();

  const [minPct, setMinPct] = React.useState<number>(90); // default 90%
  const [include100, setInclude100] = React.useState<boolean>(false);
  const [showOwned, setShowOwned] = React.useState<boolean>(false); // default OFF (hide owned by default)

  const [rows, setRows] = React.useState<DiscoverRow[] | null>(null);
  const [err, setErr] = React.useState<string>("");
  const [busy, setBusy] = React.useState<boolean>(false);

  const cacheKey = React.useMemo(
    () => `${CACHE_PREFIX}:${minPct}:${include100 ? 1 : 0}:${showOwned ? 1 : 0}`,
    [minPct, include100, showOwned]
  );

  const runIdRef = React.useRef(0);

  const run = React.useCallback(
    async (options?: { force?: boolean }) => {
      const force = options?.force ?? false;
      const key = cacheKey;
      const runId = ++runIdRef.current;

      if (!force) {
        const cached = readCache(key);
        if (cached) {
          setErr("");
          setRows(cached);
          setBusy(false);
          return;
        }
      }
      setErr("");
      setBusy(true);
      if (!force) setRows(null);

      try {
        const minCoverage = Math.max(0, Math.min(1, minPct / 100));
        const discover = await fetchDiscover({
          minCoverage,
          includeComplete: include100,
          showOwned,
          limit: DISCOVER_LIMIT,
        });

        if (runIdRef.current !== runId) return;
        const out = Array.isArray(discover) ? discover.slice() : [];
        setRows(out);
        writeCache(key, out);
      } catch (e: any) {
        if (runIdRef.current !== runId) return;
        setErr(String(e?.message || e));
        if (!force) setRows([]);
      } finally {
        if (runIdRef.current === runId) setBusy(false);
      }
    },
    [cacheKey, minPct, include100, showOwned]
  );

  React.useEffect(() => {
    // initial load
    run();
  }, [run]);

  return (
    <RequireAuth pageName="Buildability Discover">
      <div className="page">
        <PageHero
          title="Discover builds"
          subtitle="Sets you can almost build from your current inventory."
          left={
            <button
              type="button"
              onClick={() => nav("/buildability")}
              className="a2b-hero-button a2b-cta-dark"
            >
              Back
            </button>
          }
          right={
            <button
              type="button"
              onClick={() => run({ force: true })}
              disabled={busy}
              className="a2b-hero-button"
            >
              {busy ? "Loading..." : "Refresh"}
            </button>
          }
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.6rem",
              alignItems: "center",
            }}
          >
            <label className="hero-pill hero-pill--sort" style={{ gap: "0.6rem", cursor: "default" }}>
              <span>Min buildability</span>
              <span className="hero-pill__value">{minPct}%</span>
              <input
                type="range"
                min={50}
                max={99}
                step={1}
                value={minPct}
                onChange={(e) => setMinPct(parseInt(e.target.value || "90", 10))}
                style={{ width: "180px" }}
              />
            </label>

            <label className="hero-pill hero-pill--sort" style={{ gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={include100}
                onChange={(e) => setInclude100(!!e.target.checked)}
              />
              Include 100% complete sets
            </label>

            <label className="hero-pill hero-pill--sort" style={{ gap: "0.5rem" }}>
              <input
                type="checkbox"
                checked={showOwned}
                onChange={(e) => setShowOwned(!!e.target.checked)}
              />
              Show sets I already own
            </label>
          </div>
        </PageHero>

        <div style={{ marginTop: "0.5rem", marginRight: "2.5rem", marginBottom: "1rem" }}>
          <h2 style={{ margin: "0 0 0.65rem", fontSize: "1.1rem", fontWeight: 800, color: "#0f172a" }}>
            Discoverable sets
          </h2>

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

          {rows ? (
            rows.length === 0 ? (
              <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>No discover results yet.</p>
            ) : (
              <div className="tile-grid">
                {rows.map((r) => (
                  <BuildabilityTile
                    key={r.set_num}
                    item={toBuildabilityItem(r)}
                    onOpenDetails={() => nav(`/buildability/${encodeURIComponent(r.set_num)}`)}
                  />
                ))}
              </div>
            )
          ) : null}
        </div>
      </div>
    </RequireAuth>
  );
}