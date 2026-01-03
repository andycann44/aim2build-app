import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import SetTile from "../components/SetTile";
import { SetSummary, searchSets } from "../api/client";

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [featured, setFeatured] = useState<SetSummary[]>([]);
  const [loadingFeatured, setLoadingFeatured] = useState(false);

  const placeholders = useMemo(() => Array.from({ length: 8 }), []);

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
            if (match) {
              results.push(match);
            }
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
      {/* HERO HEADER */}
      <div
        className="home-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          marginTop: "1.5rem",
          marginRight: "2.5rem",
          marginBottom: "1.5rem",
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
        {/* top colour bar */}
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
            Aim2Build
          </div>
          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: 800,
              margin: 0,
            }}
          >
            Building in progress…
          </h1>
          <p
            style={{
              marginTop: "0.45rem",
              marginBottom: 0,
              fontSize: "0.95rem",
              maxWidth: "560px",
              opacity: 0.95,
            }}
          >
            We&apos;re wiring everything together so Aim2Build can track your
            sets, parts and buildability. You can still search sets and try the
            core features while we finish the rest.
          </p>

          {/* primary CTA */}
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
                background:
                  "linear-gradient(135deg, #22c55e 0%, #a3e635 100%)",
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
        </div>
      </div>

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
        <div
          className="home-feature-grid"
        >
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
                <SetTile
                  key={s.set_num}
                  set={{
                    set_num: s.set_num,
                    name: s.name,
                    year: s.year,
                    num_parts: s.num_parts,
                    img_url: s.img_url ?? null,
                  }}
                />
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
            You&apos;ll start here, log in, and Aim2Build will show you what
            you can build with the LEGO you already own.
          </p>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
