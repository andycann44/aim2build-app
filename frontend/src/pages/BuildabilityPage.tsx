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
import PageHero from "../components/PageHero";

type BuildabilityResultWithDisplay = BuildabilityResult & {
  display_total?: number | null;
};

type BuildabilityWithMeta = {
  item: BuildabilityItem;
  result: BuildabilityResultWithDisplay;
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
            const res: BuildabilityResultWithDisplay = await getBuildability(
              s.set_num
            );
            const raw: BuildabilityResultWithDisplay = res;

            const coverage =
              typeof raw.coverage === "number" ? raw.coverage : 0;

            const displayTotal =
              (typeof raw.display_total === "number"
                ? raw.display_total
                : undefined) ??
              (typeof raw.total_needed === "number"
                ? raw.total_needed
                : undefined) ??
              (typeof s.num_parts === "number" ? s.num_parts : undefined) ??
              0;

            const totalHave =
              (typeof raw.total_have === "number" ? raw.total_have : undefined) ??
              Math.round(displayTotal * coverage);

            const item: BuildabilityItem = {
              set_num: s.set_num,
              name: s.name,
              year: s.year,
              img_url: s.img_url,
              coverage,
              display_total: displayTotal,
              total_needed: totalNeeded,
              total_have: totalHave,
            };

            return { item, result: res };
          } catch (e) {
            // If compare fails, still show the set at 0%
            const displayTotal = (s.num_parts as number | undefined) ?? 0;

            const item: BuildabilityItem = {
              set_num: s.set_num,
              name: s.name,
              year: s.year,
              img_url: s.img_url,
              coverage: 0,
              total_needed: totalNeeded,
              total_have: 0,
            };

            const fallback: BuildabilityResultWithDisplay = {
              set_num: s.set_num,
              coverage: 0,
              total_needed: totalNeeded,
              total_have: 0,
              missing_parts: [],
            } as BuildabilityResultWithDisplay;

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
      <PageHero
        eyebrow="Buildability"
        title="Find out how close you are to building"
        subtitle="We'll check each set in your My Sets list against your inventory and show you how many pieces you already own. Double-click a tile to see a full parts breakdown."
      />

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
