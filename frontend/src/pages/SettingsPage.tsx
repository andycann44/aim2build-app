import React from "react";
import RequireAuth from "../components/RequireAuth";

const SettingsInner: React.FC = () => {
  return (
    <div className="page settings-page">
      <div
        className="search-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          borderRadius: "18px",
          padding: "1.75rem 1.5rem 1.5rem",
          background:
            "linear-gradient(135deg, #0b1120 0%, #1d4ed8 35%, #fbbf24 70%, #dc2626 100%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "#fff",
          position: "relative",
          overflow: "visible",
          marginTop: "1.5rem",
          marginRight: "2.5rem",
          marginBottom: "1.5rem",
          marginLeft: 0,
        }}
      >
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

        <div style={{ position: "relative", zIndex: 1, marginTop: "1.75rem" }}>
          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: 800,
              letterSpacing: "0.03em",
              margin: 0,
              textShadow: "0 2px 6px rgba(0,0,0,0.45)",
            }}
            >
              Settings
            </h1>
          <p
            style={{
              margin: 0,
              fontSize: "0.9rem",
              lineHeight: 1.45,
              opacity: 0.92,
              maxWidth: "640px",
            }}
            >
              Account & app preferences will live here. No API keys needed on this
              page.
            </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "0.55rem",
              alignItems: "center",
              marginTop: "0.85rem",
            }}
          >
            <span
              className="hero-pill hero-pill--sort"
              style={{
                background: "rgba(15,23,42,0.55)",
                borderColor: "rgba(255,255,255,0.75)",
                color: "#f8fafc",
                fontWeight: 700,
              }}
            >
              Coming soon
            </span>
            <span
              className="hero-pill hero-pill--sort"
              style={{
                background: "rgba(15,23,42,0.48)",
                borderColor: "rgba(255,255,255,0.55)",
                color: "#f8fafc",
                fontWeight: 700,
              }}
            >
              Secure by default
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto 2.5rem",
          padding: "0 1.5rem",
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
            Settings are on the way
          </h2>
          <p
            style={{
              fontSize: "0.92rem",
              color: "#cbd5f5",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            For now, there&apos;s nothing to configure here. You can keep using Aim2Build
            as normal – this page is just a placeholder while we wire up real settings
            like account controls and notification preferences.
          </p>
        </div>
      </div>
    </div>
  );
};

const SettingsPage: React.FC = () => (
  <RequireAuth pageName="settings">
    <SettingsInner />
  </RequireAuth>
);

export default SettingsPage;
