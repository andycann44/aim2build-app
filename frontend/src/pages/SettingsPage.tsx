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
            "linear-gradient(135deg, #0b1120 0%, #4b5563 35%, #0ea5e9 70%, #22c55e 100%)",
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
        <div style={{ position: "relative", zIndex: 1, marginTop: "0.5rem" }}>
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
        </div>
      </div>

      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto 2.5rem",
          padding: "0 1.5rem",
        }}
      >
        <p style={{ fontSize: "0.95rem", color: "#94a3b8" }}>
          For now, there&apos;s nothing to configure here. You can keep using
          Aim2Build as normal – this page is just a placeholder while we wire
          up real settings.
        </p>
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