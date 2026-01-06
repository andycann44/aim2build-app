import React from "react";
import RequireAuth from "../components/RequireAuth";

const KEY_ENABLED = "a2b_session_idle_enabled";
const KEY_MINUTES = "a2b_session_idle_minutes";

const SettingsInner: React.FC = () => {
  const [idleEnabled, setIdleEnabled] = React.useState<boolean>(() => {
    const v = localStorage.getItem(KEY_ENABLED);
    return v === null ? true : v === "1";
  });

  const [idleMinutes, setIdleMinutes] = React.useState<number>(() => {
    const v = localStorage.getItem(KEY_MINUTES);
    const n = v ? parseInt(v, 10) : 60;
    return Number.isFinite(n) && n > 0 ? n : 60;
  });

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
              Beta 
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
        {/* Session settings panel */}
        <div
          style={{
            borderRadius: "18px",
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(30,64,175,0.6)",
            padding: "1.25rem 1.3rem",
            boxShadow: "0 14px 30px rgba(15,23,42,0.65)",
            marginBottom: "1rem",
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
            Session
          </h2>

          <label
            style={{
              display: "flex",
              gap: "0.6rem",
              alignItems: "center",
              color: "#cbd5f5",
              fontSize: "0.92rem",
              lineHeight: 1.6,
              marginTop: "0.4rem",
            }}
          >
            <input
              type="checkbox"
              checked={idleEnabled}
              onChange={(e) => {
                const on = e.target.checked;
                setIdleEnabled(on);
                localStorage.setItem(KEY_ENABLED, on ? "1" : "0");
              }}
            />
            Check session when returning after inactivity
          </label>

          <div style={{ marginTop: "0.85rem" }}>
            <div style={{ fontSize: "0.82rem", opacity: 0.9, color: "#cbd5f5" }}>
              Idle timeout
            </div>

            <select
              value={idleMinutes}
              onChange={(e) => {
                const n = parseInt(e.target.value, 10);
                setIdleMinutes(n);
                localStorage.setItem(KEY_MINUTES, String(n));
              }}
              style={{
                marginTop: "0.45rem",
                padding: "0.45rem 0.6rem",
                borderRadius: "10px",
                background: "rgba(2,6,23,0.6)",
                color: "#e5e7eb",
                border: "1px solid rgba(255,255,255,0.18)",
              }}
            >
              <option value={15}>15 minutes</option>
              <option value={30}>30 minutes</option>
              <option value={60}>60 minutes</option>
              <option value={120}>120 minutes</option>
            </select>

            <div style={{ marginTop: "0.6rem", fontSize: "0.82rem", opacity: 0.85, color: "#cbd5f5" }}>
              Default: ON, 60 minutes. When you come back after being idle, we call
              <code style={{ marginLeft: 6 }}>GET /api/auth/me</code> and if it fails you’ll be sent to login.
            </div>
          </div>
        </div>

        {/* Existing placeholder card */}
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
            For now, there&apos;s nothing else to configure here. You can keep using Aim2Build
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