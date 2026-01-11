import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SetTile from "../components/SetTile";
import { SetSummary, searchSets } from "../api/client";
import PageHero from "../components/PageHero";
import { getToken } from "../utils/auth";

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<SetSummary[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(false);

  const placeholders = useMemo(() => Array.from({ length: 8 }), []);

  // ✅ MUST be top-level (not inside useEffect) to avoid “invalid hook call”
  const onOpenFeatured = useCallback(
    (setNum: string) => {
      const loggedIn = !!getToken();

      // Logged out: open Missing Parts view (shows “everything missing”)
      if (!loggedIn) {
        navigate(`/set/${encodeURIComponent(setNum)}`);
        return;
      }

      // Logged in: go to normal set view
      navigate(`/buildability/${encodeURIComponent(setNum)}`);
    },
    [navigate]
  );

  useEffect(() => {
    const load = async () => {
      setLoadingFeatured(true);
      try {
        const setNums = [
          "21330-1",
          "42141-1",
          "10302-1",
          "10327-1",
          "42143-1",
          "10294-1",
          "10321-1",
          "75375-1",
        ];

        const results: SetSummary[] = [];
        for (const sn of setNums) {
          try {
            const res = await searchSets(sn);
            const match =
              res.find((s) => s.set_num === sn) || res.find((s) => s.set_num.startsWith(sn));
            if (match) results.push(match);
          } catch {
            // ignore individual failures
          }
        }

        setFeatured(results.slice(0, 8));
      } finally {
        setLoadingFeatured(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="page page-home">
      <PageHero
        eyebrow="Aim2Build"
        title="What can you build today?"
        subtitle="Discover what LEGO sets you can build with the bricks you own."
      >
        <div
          style={{
            marginTop: "1.1rem",
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => navigate("/search")}
            style={{
              borderRadius: "999px",
              padding: "0.65rem 1.3rem",
              border: "none",
              cursor: "pointer",
              fontWeight: 700,
              fontSize: "0.9rem",
              background: "linear-gradient(135deg, #22c55e 0%, #a3e635 100%)",
              color: "#022c22",
              boxShadow: "0 10px 25px rgba(15,23,42,0.6)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Go to Search
          </button>
          <button
            type="button"
            onClick={() => navigate("/buildability")}
            style={{
              borderRadius: "999px",
              padding: "0.6rem 1.1rem",
              border: "1px solid rgba(148,163,184,0.7)",
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "0.85rem",
              background: "rgba(15,23,42,0.65)",
              color: "#e5e7eb",
            }}
          >
            View buildability
          </button>
        </div>

        <div style={{ marginTop: "0.6rem", color: "#e5e7eb", opacity: 0.9 }}>
          Need help?{" "}
          <a
            href="mailto:support@aim2build.co.uk"
            style={{ color: "#c7d2fe", textDecoration: "underline" }}
          >
            support@aim2build.co.uk
          </a>
        </div>
      </PageHero>

      {/* Featured sets */}
      <div
        style={{
          marginTop: "0.5rem",
          marginRight: "2.5rem",
          marginBottom: "1rem",
        }}
      >
        <h2
          style={{
            margin: "0 0 0.65rem",
            fontSize: "1.1rem",
            fontWeight: 800,
            color: "#0f172a",
          }}
        >
          Featured sets
        </h2>

        <div className="home-feature-grid">
          {loadingFeatured
            ? placeholders.map((_, idx) => (
                <div
                  key={`skeleton-${idx}`}
                  style={{
                    borderRadius: 28,
                    padding: 2,
                    background:
                      "linear-gradient(135deg,#f97316,#facc15,#22c55e,#38bdf8,#6366f1)",
                    boxShadow: "0 18px 40px rgba(15,23,42,0.45)",
                    minHeight: 360,
                    opacity: 0.6,
                  }}
                >
                  <div
                    style={{
                      borderRadius: 26,
                      background: "#f3f4f6",
                      padding: "1.1rem",
                      height: "100%",
                    }}
                  />
                </div>
              ))
            : featured.map((s) => (
                <div
                  key={s.set_num}
                  onDoubleClick={() => onOpenFeatured(s.set_num)}
                  style={{ cursor: "default" }}
                >
                  <SetTile
                    set={{
                      set_num: s.set_num,
                      name: s.name,
                      year: s.year,
                      num_parts: s.num_parts,
                      img_url: s.img_url ?? null,
                    }}
                  />
                </div>
              ))}
        </div>
      </div>

      {/* SIMPLE STATUS SECTION */}
      <div
        style={{
          marginTop: "0.5rem",
          marginRight: "2.5rem",
          display: "grid",
          gridTemplateColumns: "minmax(0, 2.2fr) minmax(0, 1.2fr)",
          gap: "1.25rem",
        }}
      >
        <div
          style={{
            borderRadius: "18px",
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(30,64,175,0.6)",
            padding: "1.25rem 1.3rem",
            boxShadow: "0 14px 30px rgba(15,23,42,0.65)",
          }}
        >
          <h2
            style={{
              margin: 0,
              marginBottom: "0.6rem",
              fontSize: "1.05rem",
              fontWeight: 700,
              color: "#e5e7eb",
            }}
          >
            What&apos;s live right now
          </h2>
          <ul
            style={{
              listStyle: "disc",
              paddingLeft: "1.2rem",
              margin: 0,
              fontSize: "0.9rem",
              color: "#cbd5f5",
            }}
          >
            <li>Backend API running on aim2build.co.uk</li>
            <li>Search &amp; catalog endpoints powered by the Aim2Build LEGO set database</li>
            <li>Buildability engine comparing your inventory to sets</li>
          </ul>
        </div>

        <div
          style={{
            borderRadius: "18px",
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(148,163,184,0.5)",
            padding: "1.25rem 1.3rem",
            boxShadow: "0 14px 30px rgba(15,23,42,0.5)",
            fontSize: "0.88rem",
            color: "#e5e7eb",
          }}
        >
          <h3
            style={{
              margin: 0,
              marginBottom: "0.5rem",
              fontSize: "0.95rem",
              fontWeight: 700,
            }}
          >
            Coming next
          </h3>
          <p style={{ margin: 0, marginBottom: "0.35rem" }}>
            User accounts, personalised suggestions and proper onboarding.
          </p>
          <p style={{ margin: 0 }}>
            You&apos;ll start here, log in, and Aim2Build will show you what you can build with the
            LEGO you already own.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;