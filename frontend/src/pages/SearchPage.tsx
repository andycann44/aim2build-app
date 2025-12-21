import React, {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  searchSets,
  addMySet,
  addWishlist,
  getMySets,
  getWishlist,
  SetSummary,
} from "../api/client";
import SetTile from "../components/SetTile";

const SearchPage: React.FC = () => {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");
  const [mySetIds, setMySetIds] = useState<Set<string>>(new Set());
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  // Load existing My Sets / Wishlist once on mount
  useEffect(() => {
    let cancelled = false;

    const loadMembership = async () => {
      try {
        const [mySets, wishlist] = await Promise.all([
          getMySets(),
          getWishlist(),
        ]);

        if (cancelled) return;

        setMySetIds(
          new Set((mySets || []).map((s: SetSummary) => s.set_num))
        );
        setWishlistIds(
          new Set((wishlist || []).map((s: SetSummary) => s.set_num))
        );
      } catch (err) {
        console.error("Failed to load existing My Sets / Wishlist", err);
        // Don't block search if this fails.
      }
    };

    loadMembership();

    return () => {
      cancelled = true;
    };
  }, []);

  // Add to My Sets with optimistic UI
  const handleAddMySets = useCallback(
    async (setNum: string) => {
      if (mySetIds.has(setNum)) return;
      try {
        await addMySet(setNum);
        setMySetIds((prev) => {
          const next = new Set(prev);
          next.add(setNum);
          return next;
        });
      } catch (err) {
        console.error(err);
        setError("Could not add to My Sets. Please try again.");
      }
    },
    [mySetIds]
  );

  const handleAddWishlist = useCallback(
    async (setNum: string) => {
      if (wishlistIds.has(setNum)) return;
      try {
        await addWishlist(setNum);
        setWishlistIds((prev) => {
          const next = new Set(prev);
          next.add(setNum);
          return next;
        });
      } catch (err) {
        console.error(err);
        setError("Could not add to wishlist. Please try again.");
      }
    },
    [wishlistIds]
  );

  const hasResults = results.length > 0;

  const statusText = useMemo(() => {
    if (loading) return "Searching the LEGO universe…";
    if (error) return error;
    if (!lastQuery && !hasResults)
      return "Type a keyword or set number to get started.";
    if (!hasResults)
      return `No sets found for “${lastQuery}”. Try another word or a set number.`;
    return `Showing ${results.length} set${
      results.length === 1 ? "" : "s"
    } for “${lastQuery}”.`;
  }, [loading, error, lastQuery, hasResults, results.length]);

  const performSearch = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setError("Please type something to search for.");
        setResults([]);
        setLastQuery("");
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const data = await searchSets(trimmed);
        setResults(data ?? []);
        setLastQuery(trimmed);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Search failed. Please try again."
        );
        setResults([]);
        setLastQuery(trimmed);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void performSearch(term);
  };

  return (
    <div className="page page-search">
      {/* HERO SEARCH BAR */}
      <div
        className="search-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          margin: "1.5rem 0",
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
        {/* subtle lego studs strip */}
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

        <div style={{ position: "relative", zIndex: 1 }}>
          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: 800,
              letterSpacing: "0.03em",
              marginBottom: "0.4rem",
              textShadow: "0 2px 6px rgba(0,0,0,0.45)",
            }}
          >
            Find your next LEGO build
          </h1>
          <p className="text-xs md:text-sm opacity-80 mt-3">
            Try something like <strong>Home Alone</strong>,{" "}
            <strong>Star Wars</strong>, or a set number like{" "}
            <strong>21330</strong>.
          </p>

          <form
            onSubmit={handleSubmit}
            style={{
              display: "flex",
              gap: "0.7rem",
              alignItems: "stretch",
              marginBottom: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ flex: "1 1 220px", minWidth: 0 }}>
              <input
                type="text"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search sets…"
                autoFocus
                className="search-input"
                style={{
                  width: "100%",
                  padding: "0.9rem 1rem",
                  borderRadius: "999px",
                  border: "2px solid rgba(255,255,255,0.9)",
                  outline: "none",
                  fontSize: "1rem",
                  backgroundColor: "rgba(15,23,42,0.9)",
                  color: "#f9fafb",
                  boxShadow: "0 0 0 2px rgba(15,23,42,0.35)",
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="search-button"
              style={{
                flex: "0 0 auto",
                padding: "0.85rem 1.6rem",
                borderRadius: "999px",
                border: "2px solid rgba(255,255,255,0.95)",
                fontWeight: 800,
                fontSize: "0.95rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: loading ? "default" : "pointer",
                background:
                  "linear-gradient(135deg,#f97316,#facc15,#22c55e)",
                color: "#111827",
                boxShadow: "0 10px 22px rgba(0,0,0,0.55)",
                opacity: loading ? 0.8 : 1,
              }}
            >
              {loading ? "Searching…" : "Search sets"}
            </button>
          </form>

          <div
            className="search-status"
            style={{
              fontSize: "0.85rem",
              opacity: 0.9,
              display: "flex",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.5rem",
            }}
          >
            <span>{statusText}</span>
            {hasResults && (
              <span style={{ fontWeight: 600 }}>
                Click a tile to add to <span>My Sets</span> or your Wishlist.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* RESULTS GRID */}
      <div className="page-body" style={{ marginRight: "2.5rem" }}>
        <div className="tile-grid">
          {results.map((s) => (
            <SetTile
              key={s.set_num}
              set={s}
              inMySets={mySetIds.has(s.set_num)}
              inWishlist={wishlistIds.has(s.set_num)}
              // 🔌 wire tiles to add handlers with optimistic state
              onAddMySet={handleAddMySets}
              onAddWishlist={handleAddWishlist}
            />
          ))}

          {!loading && !results.length && !error && !lastQuery && (
            <p className="search-empty">
              Start with a word like <strong>home</strong>,{" "}
              <strong>star</strong>, or a set number like{" "}
              <strong>21330</strong>.
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
