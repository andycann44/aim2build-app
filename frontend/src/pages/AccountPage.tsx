import React from "react";
import AuthPanel from "../components/AuthPanel";

const AccountPage: React.FC = () => {
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
            Sign in or create an account to save your sets, wishlist and
            inventory on this device.
          </p>
        </div>
      </div>

      {/* Auth card aligned with other pages */}
      <div style={{ maxWidth: "720px", margin: "0 auto 2rem", width: "100%" }}>
        <AuthPanel />
      </div>
    </div>
  );
};

export default AccountPage;
