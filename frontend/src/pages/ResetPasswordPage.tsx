import React, { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../api/client";
import PageHero from "../components/PageHero";

const API = API_BASE;

const ResetPasswordPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const search = useMemo(() => new URLSearchParams(location.search || ""), [location.search]);
  const token = useMemo(() => search.get("token") || "", [search]);
  const nextParam = useMemo(() => {
    const n = search.get("next");
    return n && n.startsWith("/") ? n : "/account";
  }, [search]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!token) {
      setError("Reset link is invalid or has expired. Please request a new link.");
      return;
    }

    if (!password || password.length < 8) {
      setError("Please choose a password at least 8 characters long.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, new_password: password }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Reset failed (${res.status})`);
      }

      setInfo("Password updated. Redirecting you to sign in…");
      setTimeout(() => {
        navigate(`/login?next=${encodeURIComponent(nextParam)}`, { replace: true });
      }, 500);
    } catch (err: any) {
      const msg =
        (err instanceof Error && err.message) ||
        (typeof err === "string" ? err : null) ||
        "Could not reset password. Please request a new link.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page page-reset-password">
      <PageHero
        title="Reset password"
        subtitle="Choose a new password for your Aim2Build account."
      />

      <div style={{ maxWidth: "720px", margin: "0 auto 2rem", width: "100%" }}>
        <div
          className="auth-panel card"
          style={{
            width: "100%",
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
          <div style={{ position: "relative", zIndex: 1 }}>
            <h2 style={{ marginTop: 0, marginBottom: "0.35rem" }}>Choose a new password</h2>
            <p style={{ marginBottom: "1rem", maxWidth: "520px", opacity: 0.9 }}>
              Enter a new password for your Aim2Build account.
            </p>

            <form onSubmit={submit}>
              <div className="form-field" style={{ marginBottom: "0.85rem" }}>
                <label htmlFor="new-password">New password</label>
                <input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter a new password"
                  style={{
                    width: "100%",
                    padding: "0.9rem 1rem",
                    borderRadius: "999px",
                    border: "2px solid rgba(255,255,255,0.9)",
                    backgroundColor: "rgba(15,23,42,0.9)",
                    color: "#f9fafb",
                    fontSize: "1rem",
                    boxShadow: "0 0 0 2px rgba(15,23,42,0.35)",
                    outline: "none",
                  }}
                />
              </div>

              <div className="form-field" style={{ marginBottom: "0.85rem" }}>
                <label htmlFor="confirm-password">Confirm password</label>
                <input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat your new password"
                  style={{
                    width: "100%",
                    padding: "0.9rem 1rem",
                    borderRadius: "999px",
                    border: "2px solid rgba(255,255,255,0.9)",
                    backgroundColor: "rgba(15,23,42,0.9)",
                    color: "#f9fafb",
                    fontSize: "1rem",
                    boxShadow: "0 0 0 2px rgba(15,23,42,0.35)",
                    outline: "none",
                  }}
                />
              </div>

              {error && (
                <p style={{ color: "#fecdd3", marginTop: "0.25rem", fontWeight: 600 }}>{error}</p>
              )}
              {info && (
                <p style={{ color: "#bbf7d0", marginTop: "0.4rem", fontWeight: 600 }}>{info}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: "1rem",
                  width: "100%",
                  padding: "0.95rem 1rem",
                  borderRadius: "999px",
                  border: "2px solid rgba(255,255,255,0.95)",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  cursor: loading ? "default" : "pointer",
                  background: "linear-gradient(135deg,#f97316,#facc15,#22c55e)",
                  color: "#111827",
                  boxShadow: "0 10px 22px rgba(0,0,0,0.55)",
                  opacity: loading ? 0.85 : 1,
                }}
              >
                {loading ? "Resetting…" : "Reset password"}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
