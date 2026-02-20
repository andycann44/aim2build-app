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
import PageHero from "../components/PageHero";

const API = API_BASE;
const PAGE_SIZE = 60;

function boostExactNameFirst<T extends { name?: string | null }>(items: T[], rawQuery: string) {
  const q = (rawQuery || "").trim().toLowerCase();
  if (!q) return items;

  const exact: T[] = [];
  const starts: T[] = [];
  const word: T[] = [];
  const rest: T[] = [];

  const wordRe = new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");

  for (const it of items) {
    const name = (it.name || "").trim();
    const n = name.toLowerCase();

    if (n === q) exact.push(it);
    else if (n.startsWith(q)) starts.push(it);
    else if (wordRe.test(name)) word.push(it);
    else rest.push(it);
  }

  return [...exact, ...starts, ...word, ...rest];
}

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

  // Best-effort inventory clean-up on My Sets removal.
  // Tries supported endpoints; ignores 404s.
  const tryRemoveSetFromInventory = useCallback(async (setNum: string) => {
    const candidates = [
      `/api/inventory/unpour-set?set=${encodeURIComponent(setNum)}`,
      `/api/inventory/unpour_set?set=${encodeURIComponent(setNum)}`,
      `/api/inventory/remove_set?set=${encodeURIComponent(setNum)}`,
    ];

    for (const path of candidates) {
      const res = await fetch(`${API}${path}`, {
        method: "POST",
        headers: authHeaders(),
      });

      if (res.status === 401) throw new Error("401 Unauthorized");
      if (res.status === 404) continue; // endpoint not present, try next
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`Inventory cleanup failed: ${res.status} ${body}`.trim());
      }
      return; // success
    }
  }, []);

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
        setError(null);

        if (alreadyIn) {
          // 1) remove from My Sets
          await removeMySet(setNum);

          // 2) best-effort: also remove/unpour from inventory (only if endpoint exists)
          try {
            await tryRemoveSetFromInventory(setNum);
          } catch (e) {
            if (is401(e)) {
              goLogin();
              return;
            }
            console.warn("Inventory cleanup failed (non-fatal):", e);
          }

          // 3) update local state
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
    [goLogin, mySetIds, tryRemoveSetFromInventory]
  );

  const handleToggleWishlist = useCallback(
    async (setNum: string) => {
      if (!hasAuth()) {
        goLogin();
        return;
      }

      try {
        setError(null);

        if (wishlistIds.has(setNum)) {
          await removeWishlist(setNum);
          setWishlistIds((prev) => {
            const n = new Set(prev);
            n.delete(setNum);
            return n;
          });
        } else {
          await addWishlist(setNum);
          setWishlistIds((prev) => {
            const n = new Set(prev);
            n.add(setNum);
            return n;
          });
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

        setResults(boostExactNameFirst(resp.results ?? [], trimmed));
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
      <PageHero
        title="Find your next LEGO build"
        subtitle={
          <>
            Try something like <strong>Home Alone</strong>, <strong>Star Wars</strong>, or a set
            number like <strong>21330</strong>.
          </>
        }
      >
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
      </PageHero>

      {/* RESULTS GRID */}
      <div className="page-body">
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
              style={{
                padding: "0.55rem 0.95rem",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.6)",
                background: "#0f172a",
                color: "#e5e7eb",
                cursor: loading || pageNum <= 1 ? "default" : "pointer",
              }}
            >
              Previous
            </button>
            <button
              type="button"
              disabled={loading || !hasMore}
              onClick={() => void performSearch(lastQuery, pageNum + 1)}
              style={{
                padding: "0.55rem 0.95rem",
                borderRadius: 12,
                border: "1px solid rgba(148,163,184,0.6)",
                background: "#0f172a",
                color: "#e5e7eb",
                cursor: loading || !hasMore ? "default" : "pointer",
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
