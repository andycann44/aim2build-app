// src/pages/BuildabilityPage.tsx
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import BuildabilityTile, {
  BuildabilityItem,
} from "../components/BuildabilityTile";
import {
  getMySets,
  getBuildability,
  SetSummary,
  BuildabilityResult,
} from "../api/client";
import { useNavigate } from "react-router-dom";

type BuildabilityWithMeta = {
  item: BuildabilityItem;
  result: BuildabilityResult;
};

const BuildabilityPage: React.FC = () => {
  const [items, setItems] = useState<BuildabilityWithMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // 1) Load My Sets
      const sets: SetSummary[] = await getMySets();

      // 2) For each set, get buildability
      const results: BuildabilityWithMeta[] = await Promise.all(
        sets.map(async (s) => {
          try {
            const res: BuildabilityResult = await getBuildability(s.set_num);

            const totalNeeded =
              (res.total_needed as number | undefined) ??
              (s.num_parts as number | undefined) ??
              0;

            const coverage =
              typeof res.coverage === "number" ? res.coverage : 0;

            const totalHave =
              (res.total_have as number | undefined) ??
              Math.round(totalNeeded * coverage);

            const item: BuildabilityItem = {
              set_num: s.set_num,
              name: s.name,
              year: s.year,
              img_url: s.img_url,
              coverage,
              total_needed: totalNeeded,
              total_have: totalHave,
            };

            return { item, result: res };
          } catch (e) {
            // If compare fails, still show the set at 0%
            const totalNeeded = (s.num_parts as number | undefined) ?? 0;

            const item: BuildabilityItem = {
              set_num: s.set_num,
              name: s.name,
              year: s.year,
              img_url: s.img_url,
              coverage: 0,
              total_needed: totalNeeded,
              total_have: 0,
            };

            const fallback: BuildabilityResult = {
              set_num: s.set_num,
              coverage: 0,
              total_needed: totalNeeded,
              total_have: 0,
              missing_parts: [],
            } as BuildabilityResult;

            return { item, result: fallback };
          }
        })
      );

      setItems(results);
    } catch (err: any) {
      setError(err?.message || "Failed to load buildability data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleOpenDetails = (setNum: string) => {
    navigate(`/buildability/${encodeURIComponent(setNum)}`);
  };

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(({ item }) => {
      const name = (item.name || "").toLowerCase();
      const setNum = (item.set_num || "").toLowerCase();
      return name.includes(q) || setNum.includes(q);
    });
  }, [items, query]);

  return (
    <div className="page page-buildability page-mysets">
      {/* HERO HEADER – same style as your My Sets hero */}
      <div
        className="Buildability-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          marginTop: "1.5rem",
          marginRight: "2.5rem",
          marginBottom: "1.0rem",
          marginLeft: 0,
          borderRadius: "18px",
          padding: "1.75rem 1.5rem 1.5rem",
          background:
            "linear-gradient(135deg, #0b1120 0%, #1d4ed8 35%, #fbbf24 70%, #dc2626 100%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
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
          {[
            "#dc2626",
            "#f97316",
            "#fbbf24",
            "#22c55e",
            "#0ea5e9",
            "#6366f1",
          ].map((c, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                borderRadius: "99px",
                background: c,
                opacity: 0.9,
              }}
            />
          ))}
        </div>

        <div style={{ position: "relative", zIndex: 1 }}>
          <div
            style={{
              fontSize: "0.8rem",
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              opacity: 0.9,
              marginBottom: "0.35rem",
            }}
          >
            Buildability
          </div>
          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: 800,
              margin: 0,
            }}
          >
            Find out how close you are to building
          </h1>
          <p
            style={{
              marginTop: "0.45rem",
              marginBottom: 0,
              fontSize: "0.92rem",
              maxWidth: "560px",
              opacity: 0.95,
            }}
          >
            We&apos;ll check each set in your My Sets list against your
            inventory and show you how many pieces you already own. Double-click
            a tile to see a full parts breakdown.
          </p>
        </div>
      </div>

      {/* SEARCH BAR – similar style to Search page, but scoped to buildable sets */}
      {items.length > 0 && (
        <div
          className="buildability-search-wrap"
          style={{
            marginTop: "0.25rem",
            marginBottom: "1.25rem",
            display: "flex",
            justifyContent: "flex-start",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "480px",
              position: "relative",
            }}
          >
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your buildable sets… (name or set number)"
              style={{
                width: "100%",
                borderRadius: "999px",
                padding: "0.75rem 1rem",
                paddingRight: "3.5rem",
                border: "1px solid rgba(148,163,184,0.7)",
                background: "#020617",
                color: "#e5e7eb",
                fontSize: "0.9rem",
                outline: "none",
                boxShadow: "0 10px 25px rgba(15,23,42,0.65)",
              }}
            />
            <div
              style={{
                position: "absolute",
                right: "0.5rem",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "0.75rem",
                padding: "0.25rem 0.7rem",
                borderRadius: "999px",
                background:
                  "linear-gradient(135deg, #22c55e 0%, #a3e635 100%)",
                color: "#022c22",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Filter
            </div>
          </div>
        </div>
      )}

      {/* STATUS / ERROR */}
      {loading && (
        <div style={{ marginTop: "1rem" }}>Loading buildability…</div>
      )}

      {error && !loading && (
        <div
          style={{
            marginTop: "1rem",
            color: "#ef4444",
            fontSize: "0.9rem",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && items.length === 0 && (
        <div style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
          No sets in My Sets yet. Add some sets first and we&apos;ll show
          buildability here.
        </div>
      )}

      {/* No matches for current search */}
      {!loading &&
        !error &&
        items.length > 0 &&
        filteredItems.length === 0 && (
          <div style={{ marginTop: "1rem", fontSize: "0.9rem" }}>
            No sets match <strong>{query}</strong>. Try a different name or set
            number.
          </div>
        )}

      {/* MAIN GRID – 2 WIDE (same as My Sets) */}
      {!loading && !error && filteredItems.length > 0 && (
        <div className="tile-grid" style={{ marginTop: "1.5rem" }}>
          {filteredItems.map(({ item }) => (
            <BuildabilityTile
              key={item.set_num}
              item={item}
              onOpenDetails={handleOpenDetails}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default BuildabilityPage;
