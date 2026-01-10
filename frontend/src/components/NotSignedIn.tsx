import React, { useMemo } from "react";
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

  return (
    <div className="page" style={{ width: "100%" }}>
      <PageHero title={copy.title} subtitle={copy.subtitle} />

      {/* Auth panel */}
      <div style={{ maxWidth: "720px", margin: "0 auto 2rem", width: "100%" }}>
        <AuthPanel />
      </div>
    </div>
  );
};

export default NotSignedIn;
