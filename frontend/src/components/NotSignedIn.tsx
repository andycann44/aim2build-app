import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AuthPanel from "./AuthPanel";
import PageHero from "./PageHero";

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
  const navigate = useNavigate();

  return (
    <div className="page" style={{ width: "100%" }}>
      <PageHero title={copy.title} subtitle={copy.subtitle} />

      <div
        style={{
          marginTop: "0.8rem",
          display: "flex",
          gap: "0.75rem",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button
          type="button"
          className="a2b-hero-button"
          onClick={() => navigate("/account?mode=login")}
        >
          Sign in
        </button>
        <button
          type="button"
          className="a2b-hero-button a2b-cta-dark"
          onClick={() => navigate("/account?mode=signup")}
        >
          Create account
        </button>
      </div>

      {/* Auth panel */}
      <div style={{ maxWidth: "720px", margin: "0 auto 2rem", width: "100%" }}>
        <AuthPanel />
      </div>
    </div>
  );
};

export default NotSignedIn;
