import React, { useEffect, useState } from "react";
import { getWishlist, removeWishlist, SetSummary } from "../api/client";

const WishlistPage: React.FC = () => {
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(false);

  async function refresh() {
    setLoading(true);
    try {
      const data = await getWishlist();
      setSets(data);
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
          <div className="page-subtitle">
            Sets you would like to build in the future.
          </div>
     </div>
     

      <div className="card">
        {loading && <div className="small-muted">Loading...</div>}
        <div className="tile-grid">
          {sets.map((s) => (
            <div key={s.set_num} className="tile">
              <div className="set-tile-layout">
                {s.img_url && (
                  <div className="set-thumb-box">
                    <img
                      src={s.img_url}
                      alt={s.name}
                      className="set-thumb"
                    />
                  </div>
                )}
                <div className="set-tile-body">
                  <div className="tile-header">
                    <div>
                      <div className="tile-title">{s.name}</div>
                      <div className="tile-meta">
                        {s.set_num} • {s.year}
                      </div>
                    </div>
                    <span className="badge">
                      {s.num_parts ? `${s.num_parts} pcs` : "Set"}
                    </span>
                  </div>
                  <div className="row-space" style={{ marginTop: 8 }}>
                    <button
                      type="button"
                      className="button danger"
                      onClick={() => handleRemove(s.set_num)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        {!loading && sets.length === 0 && (
          <div className="small-muted" style={{ marginTop: 8 }}>
            No items in wishlist yet. Add from the Search page.
          </div>
        )}
      </div>
    </div>
  );
};

export default WishlistPage;
