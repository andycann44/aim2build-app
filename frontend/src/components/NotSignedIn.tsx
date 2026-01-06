import React, { useMemo } from "react";
import AuthPanel from "./AuthPanel";

type Props = { pageName?: string };

const heroCopy = (pageName?: string) => {
  switch ((pageName || "").toLowerCase()) {
    case "wishlist":
      return {
        title: "Wishlist",
        subtitle: "You need to be logged in to view your wishlist.",
      };
    case "buildability":
      return {
        title: "Buildability",
        subtitle: "Sign in to see buildability for your sets.",
      };
    case "inventory":
      return {
        title: "Inventory",
        subtitle: "Sign in to manage your parts inventory.",
      };
    case "settings":
      return {
        title: "Settings",
        subtitle: "Sign in to access your settings.",
      };
    case "my-sets":
    case "mysets":
      return {
        title: "My Sets",
        subtitle: "Sign in to view and manage your sets.",
      };
    default:
      return {
        title: "Sign in",
        subtitle: "You need to be logged in to continue.",
      };
  }
};

const NotSignedIn: React.FC<Props> = ({ pageName }) => {
  const copy = useMemo(() => heroCopy(pageName), [pageName]);

  return (
    <div className="page" style={{ width: "100%" }}>
      {/* HERO HEADER (matches Account/Search style) */}
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
          {["#dc2626", "#f97316", "#fbbf24", "#22c55e", "#0ea5e9", "#6366f1"].map((c, i) => (
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
          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: 800,
              letterSpacing: "0.03em",
              marginBottom: "0.4rem",
              textShadow: "0 2px 6px rgba(0,0,0,0.45)",
            }}
          >
            {copy.title}
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
            {copy.subtitle}
          </p>
        </div>
      </div>

      {/* Auth panel */}
      <div style={{ maxWidth: "720px", margin: "0 auto 2rem", width: "100%" }}>
        <AuthPanel />
      </div>
    </div>
  );
};

export default NotSignedIn;
