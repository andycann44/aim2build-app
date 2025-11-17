import React from "react";

const SettingsPage: React.FC = () => {
  const apiBase =
    import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Settings</div>
          <div className="page-subtitle">
            Environment and debug information for Aim2Build.
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ marginBottom: 8 }}>
          <div className="small-muted">API Base</div>
          <div>{apiBase}</div>
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
