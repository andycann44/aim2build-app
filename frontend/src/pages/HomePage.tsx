import React, { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import SetTile from "../components/SetTile";
import { SetSummary, searchSets } from "../api/client";
import PageHero from "../components/PageHero";

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  function isAuthed(): boolean {
    try {
      const t =
        localStorage.getItem("a2b_token") ||
        localStorage.getItem("token") ||
        localStorage.getItem("access_token") ||
        localStorage.getItem("auth_token") ||
        "";
      return !!t;
    } catch {
      return false;
    }
  }

  function openBuildabilityDetails(setNum: string) {
    const base = `/buildability/${encodeURIComponent(setNum)}`;
    navigate(isAuthed() ? base : `${base}?demo=1`);
  }

  const [featured, setFeatured] = useState<SetSummary[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(false);

  const handleFeaturedClick = useCallback(
    (setNum: string) => {
      openBuildabilityDetails(setNum);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              res.find((s) => s.set_num === sn) ||
              res.find((s) => String(s.set_num || "").startsWith(sn));
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
      <div className="home-featured-wrap">
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

        {loadingFeatured ? (
          <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>
            Loading featured sets…
          </p>
        ) : (
          <div className="tile-grid home-featured-grid">
            {featured.map((s) => (
              <div
                key={s.set_num}
                onClick={() => handleFeaturedClick(s.set_num)}
                style={{ cursor: "pointer" }}
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
        )}
      </div>

      {/* SIMPLE STATUS SECTION */}
      <div className="home-bottom-grid">
        <div
          className="home-bottom-card"
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
            <li>Secure user accounts with persistent login</li>
            <li>Personal inventory tracking (strict part + colour matching)</li>
            <li>Buildability engine showing what you can build from your inventory</li>
            <li>Real LEGO set catalog powered by the Aim2Build database</li>
            <li>Canonical inventory add / decrement endpoints (stable)</li>
          </ul>
        </div>

        <div
          className="home-bottom-card"
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
            Smarter build suggestions. Not just what you can build, but what you should build next from your inventory.
          </p>
          <p style={{ margin: 0 }}>
            You&apos;re already logged in — add your LEGO, and Aim2Build will show what you can build.
          </p>

        </div>
      </div>
    </div>
  );
};

export default HomePage;