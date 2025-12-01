import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import BuildabilityTile, { BuildabilityItem } from "../components/BuildabilityTile";
import {
  getBuildability,
  getMySets,
  getWishlist,
  searchSets,
  SetSummary,
} from "../api/client";

type Mode = "mysets" | "wishlist" | "search";

type BuildabilityCard = BuildabilityItem & {
  loading?: boolean;
};

const MODE_OPTIONS: { id: Mode; label: string }[] = [
  { id: "mysets", label: "My Sets" },
  { id: "wishlist", label: "Wishlist" },
  { id: "search", label: "Search" },
];

async function hydrateSetImages(sets: SetSummary[]): Promise<SetSummary[]> {
  const results: SetSummary[] = [];
  for (const s of sets) {
    if (s.img_url && s.img_url.trim().length > 0) {
      results.push(s);
      continue;
    }

    try {
      const searchResults = await searchSets(s.set_num);
      const first = (searchResults || [])[0];
      if (first && first.img_url) {
        results.push({
          ...s,
          img_url: first.img_url,
          name: s.name ?? first.name,
          year: s.year ?? first.year,
        });
      } else {
        results.push(s);
      }
    } catch {
      results.push(s);
    }
  }
  return results;
}

const BuildabilityOverviewPage: React.FC = () => {
  const navigate = useNavigate();

  const [mode, setMode] = useState<Mode>("mysets");
  const [items, setItems] = useState<BuildabilityCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiNote, setAiNote] = useState(false);

  const [searchTerm, setSearchTerm] = useState("");
  const [lastQuery, setLastQuery] = useState("");

  const fetchCoverageForSets = useCallback(
    async (sets: SetSummary[]) => {
      const results = await Promise.all(
        sets.map(async (s) => {
          try {
            const cmp = await getBuildability(s.set_num);
            const coverage =
              typeof cmp.coverage === "number" && !Number.isNaN(cmp.coverage)
                ? cmp.coverage
                : 0;
            const total_needed =
              typeof cmp.total_needed === "number" ? cmp.total_needed : s.num_parts;
            const total_have =
              typeof cmp.total_have === "number" ? cmp.total_have : undefined;

            return {
              set_num: s.set_num,
              name: s.name,
              year: s.year,
              img_url: s.img_url ?? undefined,
              coverage,
              total_have,
              total_needed,
            } as BuildabilityCard;
          } catch (err) {
            console.warn("Failed to load buildability for set", s.set_num, err);
            return {
              set_num: s.set_num,
              name: s.name,
              year: s.year,
              img_url: s.img_url ?? undefined,
              coverage: 0,
              total_have: 0,
              total_needed: s.num_parts,
            } as BuildabilityCard;
          }
        })
      );
      return results;
    },
    []
  );

  const loadMode = useCallback(
    async (nextMode: Mode) => {
      setLoading(true);
      setError(null);
      try {
        if (nextMode === "mysets") {
          const sets = await getMySets();
          const withCoverage = await fetchCoverageForSets(sets ?? []);
          setItems(withCoverage);
        } else if (nextMode === "wishlist") {
          const sets = await getWishlist();
          const hydrated = await hydrateSetImages(sets ?? []);
          const withCoverage = await fetchCoverageForSets(hydrated ?? []);
          setItems(withCoverage);
        } else {
          // search mode: wait for explicit search
          setItems([]);
        }
      } catch (err: any) {
        setError(err?.message ?? "Failed to load buildability overview.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [fetchCoverageForSets]
  );

  useEffect(() => {
    void loadMode(mode);
  }, [mode, loadMode]);

  const handleModeChange = (next: Mode) => {
    setMode(next);
    setError(null);
    if (next !== "search") {
      setSearchTerm("");
      setLastQuery("");
    }
  };

  const handleSearch = useCallback(
    async (event?: FormEvent) => {
      if (event) {
        event.preventDefault();
      }
      const q = searchTerm.trim();
      if (!q) {
        setError("Type a keyword or set number to search.");
        setItems([]);
        setLastQuery("");
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const results = await searchSets(q);
        setLastQuery(q);
        if (!results || results.length === 0) {
          setItems([]);
          return;
        }
        const withCoverage = await fetchCoverageForSets(results);
        setItems(withCoverage);
      } catch (err: any) {
        setError(err?.message ?? "Search failed. Please try again.");
        setItems([]);
      } finally {
        setLoading(false);
      }
    },
    [fetchCoverageForSets, searchTerm]
  );

  const visibleItems = useMemo(() => items, [items]);

  const heroTitle =
    mode === "mysets"
      ? "Buildability for My Sets"
      : mode === "wishlist"
      ? "Buildability for Wishlist"
      : "Search buildability across sets";

  const heroSubtitle =
    mode === "search"
      ? "Search any set and see instantly how buildable it is with your inventory."
      : "Review how ready your sets are to build, with quick access to missing parts.";

  const aiButtonClick = () => {
    console.log("TODO: send top buildable sets to AI");
    setAiNote(true);
  };

  const modePill = (opt: { id: Mode; label: string }) => (
    <button
      key={opt.id}
      type="button"
      onClick={() => handleModeChange(opt.id)}
      className="hero-pill hero-pill--sort"
      style={{
        opacity: mode === opt.id ? 1 : 0.85,
        borderColor: mode === opt.id ? "#ffffff" : "rgba(148,163,184,0.35)",
        background:
          mode === opt.id ? "linear-gradient(135deg, #f97316, #facc15, #22c55e)" : undefined,
        color: mode === opt.id ? "#0f172a" : "#e5e7eb",
        fontWeight: mode === opt.id ? 800 : 600,
      }}
    >
      {opt.label}
    </button>
  );

  return (
    <div className="page page-buildability-overview">
      {/* HERO */}
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
        {/* studs strip */}
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
          {/* mode + AI row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "0.9rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
              {MODE_OPTIONS.map(modePill)}
            </div>

            <button
              type="button"
              className="hero-pill hero-pill--sort"
              onClick={aiButtonClick}
              style={{
                background: "rgba(15,23,42,0.55)",
                borderColor: "rgba(148,163,184,0.6)",
              }}
            >
              Ask AI
            </button>
          </div>

          {/* text block */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
            <h1
              style={{
                fontSize: "1.9rem",
                fontWeight: 800,
                letterSpacing: "0.03em",
                margin: 0,
              }}
            >
              Buildability overview
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "0.9rem",
                lineHeight: 1.45,
                opacity: 0.92,
                maxWidth: "640px",
              }}
            >
              {heroTitle} · {heroSubtitle}
            </p>
            {aiNote && (
              <span style={{ fontSize: "0.8rem", color: "#e5e7eb", opacity: 0.9 }}>
                AI assistant coming soon.
              </span>
            )}
          </div>

          {/* search bar */}
          {mode === "search" && (
            <form
              onSubmit={handleSearch}
              style={{
                marginTop: "1rem",
                display: "flex",
                gap: "0.65rem",
                flexWrap: "wrap",
              }}
            >
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search set name or number…"
                style={{
                  flex: "1 1 260px",
                  minWidth: "240px",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "10px",
                  border: "1px solid rgba(255,255,255,0.6)",
                  background: "rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: "0.95rem",
                }}
              />
              <button
                type="submit"
                className="hero-pill"
                style={{
                  background: "linear-gradient(135deg, #f97316, #facc15, #22c55e)",
                  color: "#0f172a",
                  borderColor: "#ffffff",
                  fontWeight: 800,
                }}
              >
                Search
              </button>
              {lastQuery && (
                <span style={{ fontSize: "0.82rem", color: "#e5e7eb", opacity: 0.85 }}>
                  Showing results for “{lastQuery}”
                </span>
              )}
            </form>
          )}
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding: "0 1.5rem 2.5rem" }}>
        {error && (
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
            {error}
          </div>
        )}

        {loading && <p style={{ fontSize: "0.9rem", opacity: 0.8 }}>Loading…</p>}

        {!loading && visibleItems.length === 0 && !error && (
          <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
            {mode === "search"
              ? lastQuery
                ? `No sets found for “${lastQuery}”. Try another search.`
                : "Search for a set to see buildability."
              : "No sets to show yet."}
          </p>
        )}

        {visibleItems.length > 0 && (
          <div
            className="tile-grid"
            style={{
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "1.4rem",
            }}
          >
            {visibleItems.map((item) => {
              const coverage = item.coverage ?? 0;
              const traffic =
                coverage >= 0.9 ? "#22c55e" : coverage >= 0.5 ? "#f59e0b" : "#ef4444";

              return (
                <div key={item.set_num} style={{ position: "relative" }}>
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "14px",
                      width: "12px",
                      height: "12px",
                      borderRadius: "50%",
                      background: traffic,
                      boxShadow: "0 0 0 4px rgba(255,255,255,0.8)",
                      zIndex: 2,
                    }}
                  />
                  <BuildabilityTile
                    item={item}
                    onOpenDetails={(setNum) =>
                      navigate(`/buildability/${encodeURIComponent(setNum)}`)
                    }
                  />
                  <div style={{ marginTop: "0.5rem", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/buildability/${encodeURIComponent(item.set_num)}`)
                      }
                      className="hero-pill"
                      style={{
                        background: "rgba(15,23,42,0.75)",
                        color: "#e5e7eb",
                        borderColor: "rgba(148,163,184,0.35)",
                        fontSize: "0.82rem",
                      }}
                    >
                      View parts
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildabilityOverviewPage;
