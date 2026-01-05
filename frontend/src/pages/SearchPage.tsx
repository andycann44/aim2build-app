import { API_BASE } from "../api/client";
import React, { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  searchSetsPaged,
  addMySet,
  addWishlist,
  removeMySet,
  removeWishlist,
  getMySets,
  getWishlist,
  SetSummary,
} from "../api/client";
import { useLocation, useNavigate } from "react-router-dom";
import SetTile from "../components/SetTile";
import { authHeaders } from "../utils/auth";

// Use server if env not set
const API = API_BASE;

const PAGE_SIZE = 60;

const SearchPage: React.FC = () => {
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState("");

  // paging
  const [pageNum, setPageNum] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);

  // membership
  const [mySetIds, setMySetIds] = useState<Set<string>>(new Set());
  const [wishlistIds, setWishlistIds] = useState<Set<string>>(new Set());

  // sorting (wired through API)
  const [sort, setSort] = useState<"recent" | "popular">("recent");

  const navigate = useNavigate();
  const location = useLocation();

  const nextUrl = `${location.pathname.toLowerCase()}${location.search}`;
  const goLogin = useCallback(() => {
    navigate(`/login?next=${encodeURIComponent(nextUrl)}`);
  }, [navigate, nextUrl]);

  const hasAuth = () => {
    const h = authHeaders();
    return !!h.Authorization;
  };

  // Robust 401 detector (covers Error("401 Unauthorized"), Response-ish, and thrown strings)
  const is401 = (err: any) => {
    const msg = String(err?.message ?? err ?? "");
    const status = (err && (err.status || err.statusCode)) ?? null;
    return status === 401 || msg.includes("401") || msg.toLowerCase().includes("unauthorized");
  };

  // Load existing My Sets / Wishlist once on mount (don’t spam 401 if logged out)
  useEffect(() => {
    let cancelled = false;

    const loadMembership = async () => {
      if (!hasAuth()) return; // avoid 401 spam when logged out
      try {
        const [mySets, wishlist] = await Promise.all([getMySets(), getWishlist()]);
        if (cancelled) return;

        setMySetIds(new Set((mySets || []).map((s: SetSummary) => s.set_num)));
        setWishlistIds(new Set((wishlist || []).map((s: SetSummary) => s.set_num)));
      } catch (err) {
        if (is401(err)) return; // silently ignore auth failures here
        console.error("Failed to load existing My Sets / Wishlist", err);
      }
    };

    loadMembership();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 🔄 TRUE TOGGLE: add if missing, remove (and clean inventory) if present
  const handleToggleMySets = useCallback(
    async (setNum: string) => {
      if (!hasAuth()) {
        goLogin();
        return;
      }

      const alreadyIn = mySetIds.has(setNum);

      try {
        if (alreadyIn) {
          await removeMySet(setNum);

          // Mirror My Sets page behaviour – also remove its inventory
          const res = await fetch(
            `${API}/api/inventory/remove_set?set=${encodeURIComponent(setNum)}`,
            { method: "POST", headers: authHeaders() }
          );

          if (res.status === 401) {
            goLogin();
            return;
          }
          if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(`remove_set failed: ${res.status} ${body}`.trim());
          }

          setMySetIds((prev) => {
            const next = new Set(prev);
            next.delete(setNum);
            return next;
          });
        } else {
          await addMySet(setNum);
          setMySetIds((prev) => {
            const next = new Set(prev);
            next.add(setNum);
            return next;
          });
        }
      } catch (err) {
        if (is401(err)) {
          goLogin();
          return;
        }
        console.error(err);
        setError("Could not update My Sets. Please try again.");
      }
    },
    [goLogin, mySetIds]
  );

  const handleToggleWishlist = useCallback(
    async (setNum: string) => {
      if (!hasAuth()) {
        goLogin();
        return;
      }

      try {
        if (wishlistIds.has(setNum)) {
          await removeWishlist(setNum);
          setWishlistIds((prev) => {
            const n = new Set(prev);
            n.delete(setNum);
            return n;
          });
        } else {
          await addWishlist(setNum);
          setWishlistIds((prev) => new Set(prev).add(setNum));
        }
      } catch (err) {
        if (is401(err)) {
          goLogin();
          return;
        }
        console.error(err);
        setError("Could not update wishlist. Please try again.");
      }
    },
    [goLogin, wishlistIds]
  );

  const hasResults = results.length > 0;

  const statusText = useMemo(() => {
    if (loading) return "Searching the LEGO universe…";
    if (error) return error;
    if (!lastQuery && !hasResults) return "Type a keyword or set number to get started.";
    if (!hasResults) return `No sets found for “${lastQuery}”. Try another word or a set number.`;
    return `Showing ${results.length} of ${total} set${total === 1 ? "" : "s"} (page ${pageNum}) for “${lastQuery}”.`;
  }, [loading, error, lastQuery, hasResults, results.length, total, pageNum]);

  const performSearch = useCallback(
    async (query: string, pageToLoad: number = 1) => {
      const trimmed = query.trim();
      if (!trimmed) {
        setError("Please type something to search for.");
        setResults([]);
        setLastQuery("");
        setPageNum(1);
        setTotal(0);
        setHasMore(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const resp = await searchSetsPaged(trimmed, pageToLoad, PAGE_SIZE, false, sort);

        setResults(resp.results ?? []);
        setLastQuery(trimmed);
        setPageNum(resp.page ?? pageToLoad);
        setTotal(resp.total ?? 0);
        setHasMore(!!resp.has_more);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed. Please try again.");
        setResults([]);
        setLastQuery(trimmed);
        setPageNum(1);
        setTotal(0);
        setHasMore(false);
      } finally {
        setLoading(false);
      }
    },
    [sort]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void performSearch(term, 1);
  };

  // If sort changes and we already have results, re-run page 1
  useEffect(() => {
    if (lastQuery) void performSearch(lastQuery, 1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

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
          {["#dc2626", "#f97316", "#fbbf24", "#22c55e", "#0ea5e9", "#6366f1"].map((c, i) => (
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
            Try something like <strong>Home Alone</strong>, <strong>Star Wars</strong>, or a set
            number like <strong>21330</strong>.
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
                  width: "calc(100% - 1cm)",
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

            <div
              style={{
                flex: "0 0 160px",
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as "recent" | "popular")}
                style={{
                  width: "100%",
                  padding: "0.85rem 1rem",
                  borderRadius: "999px",
                  border: "2px solid rgba(255,255,255,0.95)",
                  background: "rgba(15,23,42,0.9)",
                  color: "#f9fafb",
                  fontWeight: 800,
                }}
              >
                <option value="recent">Newest</option>
                <option value="popular">Popular (big sets)</option>
              </select>
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
                background: "linear-gradient(135deg,#f97316,#facc15,#22c55e)",
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
              onAddMySet={handleToggleMySets}
              onAddWishlist={handleToggleWishlist}
            />
          ))}

          {!loading && !results.length && !error && !lastQuery && (
            <p className="search-empty">
              Start with a word like <strong>home</strong>, <strong>star</strong>, or a set number
              like <strong>21330</strong>.
            </p>
          )}
        </div>

        {lastQuery && total > 0 && (
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              gap: "0.75rem",
              padding: "1.25rem 0 2rem",
            }}
          >
            <button
              type="button"
              disabled={loading || pageNum <= 1}
              onClick={() => void performSearch(lastQuery, pageNum - 1)}
              className="search-button"
              style={{
                padding: "0.75rem 1.25rem",
                borderRadius: "999px",
                border: "2px solid rgba(255,255,255,0.2)",
                fontWeight: 800,
                fontSize: "0.9rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: loading || pageNum <= 1 ? "default" : "pointer",
                opacity: loading || pageNum <= 1 ? 0.6 : 1,
              }}
            >
              Prev
            </button>

            <button
              type="button"
              disabled={loading || !hasMore}
              onClick={() => void performSearch(lastQuery, pageNum + 1)}
              className="search-button"
              style={{
                padding: "0.75rem 1.25rem",
                borderRadius: "999px",
                border: "2px solid rgba(255,255,255,0.2)",
                fontWeight: 800,
                fontSize: "0.9rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                cursor: loading || !hasMore ? "default" : "pointer",
                opacity: loading || !hasMore ? 0.6 : 1,
              }}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SearchPage;
