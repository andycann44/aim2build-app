import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import AuthPanel from "../components/AuthPanel";
import { getToken, clearToken } from "../utils/auth";


const AccountPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const next = useMemo(() => {
    const p = new URLSearchParams(location.search);
    const raw = p.get("next") || "";
    // basic safety: only allow internal paths
    if (raw.startsWith("/")) return raw;
    return "/search";
  }, [location.search]);

  const [authed, setAuthed] = useState<boolean>(() => !!getToken());

  // If user is already logged in and lands on /login?next=..., bounce immediately.
  useEffect(() => {
    if (authed) {
      navigate(next, { replace: true });
    }
  }, [authed, next, navigate]);

  const onAuthed = useCallback(() => {
    setAuthed(true);
    navigate(next, { replace: true });
  }, [next, navigate]);

  const onLogout = useCallback(() => {
    clearToken();
    setAuthed(false);
    // stay on account page; user can login again
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <div className="page page-account">
      {/* HERO – match search/mysets style with studs strip */}
      <div
        className="search-hero"
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
            Account
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
            Sign in to add sets to My Sets / Wishlist and manage your inventory
            on this device.
          </p>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: "720px", margin: "0 auto 2rem", width: "100%" }}>
        {!authed ? (
          <AuthPanel onAuthed={onAuthed} />
        ) : (
          <div
            className="card"
            style={{
              borderRadius: "18px",
              padding: "1.25rem 1.25rem 1rem",
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(255,255,255,0.12)",
              boxShadow: "0 18px 40px rgba(0,0,0,0.25)",
              color: "#fff",
            }}
          >
            <div style={{ fontWeight: 800, fontSize: "1.1rem" }}>
              You’re logged in
            </div>
            <div style={{ opacity: 0.85, marginTop: "0.35rem" }}>
              Redirecting…
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={onLogout}
                style={{
                  marginTop: "0.9rem",
                  padding: "0.65rem 1rem",
                  borderRadius: "999px",
                  border: "2px solid rgba(255,255,255,0.85)",
                  fontWeight: 800,
                  background: "rgba(0,0,0,0.15)",
                  color: "#fff",
                  cursor: "pointer",
                }}
              >
                Log out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountPage;