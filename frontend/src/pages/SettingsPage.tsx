import React, { useEffect, useState } from "react";
import AuthPanel from "../components/AuthPanel";

const SettingsPage: React.FC = () => {
  const apiBase =
    import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  const [removeAffectsInventory, setRemoveAffectsInventory] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("removeAffectsInventory");
      if (stored === null) return true;
      return stored === "true";
    } catch {
      return true;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem("removeAffectsInventory", String(removeAffectsInventory));
    } catch {
      // ignore storage errors
    }
  }, [removeAffectsInventory]);

  return (
    <div className="page page-settings">
      <AuthPanel />
      <div
        className="search-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          margin: "1.5rem 0",
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

        <div style={{ position: "relative", zIndex: 1 }}>
          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: 800,
              letterSpacing: "0.03em",
              marginBottom: "0.4rem",
              textShadow: "0 2px 6px rgba(0,0,0,0.45)",
            }}
          >
            Settings
          </h1>
          <p
            style={{
              margin: "0.5rem 0 0.75rem",
              maxWidth: "520px",
              fontSize: "0.9rem",
              lineHeight: 1.45,
              opacity: 0.9,
            }}
          >
            Configure Aim2Build behavior and view environment info.
          </p>
        </div>
      </div>

      <div
        className="card"
        style={{
          maxWidth: "960px",
          margin: "0 auto",
          padding: "1.25rem",
          borderRadius: "16px",
        }}
      >
        <div style={{ marginBottom: 12 }}>
          <div className="small-muted">API Base</div>
          <div>{apiBase}</div>
        </div>
        <div style={{ margin: "12px 0" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem" }}>
            <input
              type="checkbox"
              checked={removeAffectsInventory}
              onChange={(e) => setRemoveAffectsInventory(e.target.checked)}
            />
            Also remove parts from Inventory when I remove a set
          </label>
        </div>
        <div className="small-muted">
          To change backend URL, create a <code>.env.local</code> in{" "}
          <code>frontend/</code> with:
          <pre
            style={{
              marginTop: 6,
              padding: 8,
              background: "#020617",
              borderRadius: 8,
              border: "1px solid rgba(15,23,42,0.8)",
              fontSize: "0.8rem"
            }}
          >
{`VITE_API_BASE=http://127.0.0.1:8000`}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
