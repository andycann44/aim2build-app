import React, { useEffect, useState } from "react";
import SetTile from "../components/SetTile";
import { getWishlist, removeWishlist, SetSummary } from "../api/client";
import { authHeaders } from "../utils/auth";

const API =
  (import.meta as any)?.env?.VITE_API_BASE || "http://127.0.0.1:8000";

const WishlistPage: React.FC = () => {
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await getWishlist();
      const withImages = await Promise.all(
        (data || []).map(async (s) => {
          let numParts =
            typeof s.num_parts === "number" ? s.num_parts : undefined;

          if (numParts === undefined) {
            try {
              const res = await fetch(
                `${API}/api/buildability/compare?set=${encodeURIComponent(
                  s.set_num
                )}`,
                {
                  headers: {
                    ...authHeaders(),
                  },
                }
              );
              if (res.ok) {
                const b = await res.json();
                const displayTotal =
                  typeof b.display_total === "number"
                    ? b.display_total
                    : typeof b.total_needed === "number"
                    ? b.total_needed
                    : undefined;
                if (typeof displayTotal === "number") {
                  numParts = displayTotal;
                }
              }
            } catch {
              // ignore and keep fallback below
            }
          }

          return {
            ...s,
            num_parts: numParts ?? 0,
            img_url:
              s.img_url && s.img_url.trim().length > 0
                ? s.img_url
                : `https://cdn.rebrickable.com/media/sets/${s.set_num}.jpg`,
          };
        })
      );
      setSets(withImages);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function handleRemove(set_num: string) {
    await removeWishlist(set_num);
    await refresh();
  }

  return (
    <div className="page page-wishlist">
      {/* HERO HEADER – same style as Search, just without the search box */}
      <div
        className="wishlist-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          marginTop: "1.5rem",
          marginRight: "2.5rem",
          marginBottom: "1.5rem",
          marginLeft: "0",
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

        <h1
          style={{
            fontSize: "2.1rem",
            fontWeight: 800,
            marginTop: "1.2rem",
          }}
        >
          Wishlist
        </h1>
        <div
          className="page-subtitle"
          style={{ color: "rgba(229,231,235,0.9)", fontSize: "0.95rem" }}
        >
          Sets you would like to build in the future.
        </div>
      </div>

      {loading && <div className="small-muted">Loading...</div>}

      {!loading && sets.length > 0 && (
        <div className="tile-grid">
          {sets.map((s) => (
            <SetTile
              key={s.set_num}
              set={s}
              onRemoveMySet={() => handleRemove(s.set_num)}
            />
          ))}
        </div>
      )}

      {!loading && sets.length === 0 && (
        <div className="small-muted" style={{ marginTop: 8 }}>
          No items in wishlist yet. Add from the Search page.
        </div>
      )}
    </div>
  );
};

export default WishlistPage;
