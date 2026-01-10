import React, { useEffect, useState } from "react";
import SetTile from "../components/SetTile";
import { getWishlist, removeWishlist, SetSummary } from "../api/client";
import { authHeaders } from "../utils/auth";
import RequireAuth from "../components/RequireAuth";
import { API_BASE } from "../api/client";
import PageHero from "../components/PageHero";

// Use server if env not set
const API = API_BASE;

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
      <PageHero title="Wishlist" subtitle="Sets you would like to build in the future." />

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

const WishlistPageWrapper: React.FC = () => (
  <RequireAuth pageName="wishlist">
    <WishlistPage />
  </RequireAuth>
);

export default WishlistPageWrapper;
