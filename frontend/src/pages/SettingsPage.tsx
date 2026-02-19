import React from "react";
import { useNavigate } from "react-router-dom";
import RequireAuth from "../components/RequireAuth";
import PageHero from "../components/PageHero";
import { API_BASE } from "../api/client";
import { authHeaders } from "../utils/auth";

const KEY_ENABLED = "a2b_session_idle_enabled";
const KEY_MINUTES = "a2b_session_idle_minutes";

function clearLocalAuth() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
  } catch {}
}

const SettingsInner: React.FC = () => {
  const nav = useNavigate();

  const [idleEnabled, setIdleEnabled] = React.useState<boolean>(() => {
    const v = localStorage.getItem(KEY_ENABLED);
    return v === null ? true : v === "1";
  });

  const [idleMinutes, setIdleMinutes] = React.useState<number>(() => {
    const v = localStorage.getItem(KEY_MINUTES);
    const n = v ? parseInt(v, 10) : 60;
    return Number.isFinite(n) && n > 0 ? n : 60;
  });

  // Danger zone state
  const [dzOpen, setDzOpen] = React.useState(false);
  const [dzTyped, setDzTyped] = React.useState("");
  const [dzBusy, setDzBusy] = React.useState(false);
  const [dzErr, setDzErr] = React.useState<string | null>(null);
  const [dzPassword, setDzPassword] = React.useState("");
  const dzCanDelete = dzTyped.trim() === "DELETE" && dzPassword.trim().length > 0;

  async function doDeleteAccount() {
    if (!dzCanDelete || dzBusy) return;

    setDzBusy(true);
    setDzErr(null);

    try {
      const res = await fetch(`${API_BASE}/api/auth/me`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          password: dzPassword,
        }),
      });

      if (!res.ok) {
        // Prefer JSON detail if present, else fallback to text
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          const j = await res.json().catch(() => ({} as any));
          const detail =
            typeof j?.detail === "string"
              ? j.detail
              : Array.isArray(j?.detail)
              ? j.detail.map((x: any) => x?.msg).filter(Boolean).join(", ")
              : "";
          throw new Error(detail || `Delete failed (${res.status})`);
        } else {
          const txt = await res.text().catch(() => "");
          throw new Error(txt || `Delete failed (${res.status})`);
        }
      }

      clearLocalAuth();
      setDzOpen(false);
      nav("/login", { replace: true });
    } catch (e: any) {
      setDzErr(e?.message || "Failed to delete account");
    } finally {
      setDzBusy(false);
    }
  }

  return (
    <div className="page settings-page">
      <PageHero
        title="Settings"
        subtitle="Account & app preferences will live here. No API keys needed on this page."
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.55rem",
            alignItems: "center",
          }}
        />
      </PageHero>

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

            <div
              style={{
                marginTop: "0.6rem",
                fontSize: "0.82rem",
                opacity: 0.85,
                color: "#cbd5f5",
              }}
            >
              Default: ON, 60 minutes. When you come back after being idle, we call
              <code style={{ marginLeft: 6 }}>GET /api/auth/me</code> and if it fails you’ll be sent to login.
            </div>
          </div>
        </div>

        {/* Danger zone */}
        <div
          style={{
            borderRadius: "18px",
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(220,38,38,0.55)",
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
              color: "#fecaca",
            }}
          >
            Danger zone
          </h2>

          <p
            style={{
              fontSize: "0.92rem",
              color: "rgba(254,202,202,0.92)",
              margin: 0,
              lineHeight: 1.6,
            }}
          >
            Deleting your account permanently removes your Aim2Build account and all associated data
            (inventory, sets, wishlist). This cannot be undone.
          </p>

          <div style={{ marginTop: "0.9rem" }}>
            <button
              className="a2b-danger-pulse"
              onClick={() => {
                setDzErr(null);
                setDzTyped("");
                setDzPassword("");
                setDzOpen(true);
              }}
              style={{
                borderRadius: "12px",
                padding: "0.6rem 0.9rem",
                background: "rgba(220,38,38,0.95)",
                color: "white",
                border: "1px solid rgba(255,255,255,0.12)",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Delete account
            </button>
          </div>

          {dzOpen && (
            <div
              style={{
                marginTop: "0.95rem",
                borderRadius: "14px",
                background: "rgba(2,6,23,0.6)",
                border: "1px solid rgba(248,113,113,0.35)",
                padding: "0.95rem",
              }}
            >
              <div style={{ color: "#fecaca", fontWeight: 700, marginBottom: "0.35rem" }}>
                Confirm deletion
              </div>

              <div style={{ color: "rgba(254,202,202,0.9)", fontSize: "0.9rem", lineHeight: 1.5 }}>
                Type <code style={{ marginLeft: 6 }}>DELETE</code> to permanently delete your account.
              </div>

              <input
                value={dzTyped}
                onChange={(e) => setDzTyped(e.target.value)}
                placeholder="Type DELETE"
                autoFocus
                style={{
                  marginTop: "0.6rem",
                  width: "260px",
                  maxWidth: "100%",
                  padding: "0.5rem 0.65rem",
                  borderRadius: "10px",
                  background: "rgba(2,6,23,0.75)",
                  color: "#e5e7eb",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              />
              <input
                value={dzPassword}
                onChange={(e) => setDzPassword(e.target.value)}
                placeholder="Enter your password"
                type="password"
                style={{
                  marginTop: "0.6rem",
                  width: "260px",
                  maxWidth: "100%",
                  padding: "0.5rem 0.65rem",
                  borderRadius: "10px",
                  background: "rgba(2,6,23,0.75)",
                  color: "#e5e7eb",
                  border: "1px solid rgba(255,255,255,0.18)",
                }}
              />

              {dzErr && (
                <div style={{ marginTop: "0.55rem", color: "#fecaca", fontSize: "0.9rem" }}>
                  {dzErr}
                </div>
              )}

              <div style={{ marginTop: "0.8rem", display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
                <button
                  onClick={() => setDzOpen(false)}
                  disabled={dzBusy}
                  style={{
                    borderRadius: "12px",
                    padding: "0.55rem 0.85rem",
                    background: "rgba(148,163,184,0.18)",
                    color: "#e5e7eb",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontWeight: 700,
                    cursor: dzBusy ? "default" : "pointer",
                    opacity: dzBusy ? 0.7 : 1,
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={doDeleteAccount}
                  disabled={!dzCanDelete || dzBusy}
                  style={{
                    borderRadius: "12px",
                    padding: "0.55rem 0.85rem",
                    background: dzCanDelete && !dzBusy ? "rgba(220,38,38,0.95)" : "rgba(220,38,38,0.45)",
                    color: "white",
                    border: "1px solid rgba(255,255,255,0.12)",
                    fontWeight: 800,
                    cursor: dzCanDelete && !dzBusy ? "pointer" : "default",
                    opacity: dzBusy ? 0.75 : 1,
                  }}
                >
                  {dzBusy ? "Deleting..." : "Yes, delete my account"}
                </button>
              </div>
            </div>
          )}
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