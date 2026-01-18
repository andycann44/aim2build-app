import React from "react";
import { useLocation } from "react-router-dom";
import AuthPanel from "../components/AuthPanel";
import PageHero from "../components/PageHero";

const AccountPage: React.FC = () => {
  const location = useLocation();
  const modeParam = new URLSearchParams(location.search).get("mode")?.toLowerCase();
  const defaultMode: "login" | "register" | undefined =
    modeParam === "signup" || modeParam === "register" || modeParam === "create"
      ? "register"
      : modeParam === "login"
        ? "login"
        : undefined;

  return (
    <div className="page page-account">
      <PageHero
        title="Account"
        subtitle="Sign in or create an account to save your sets, wishlist and inventory on this device."
      />

      {/* Auth card aligned with other pages */}
      <div style={{ maxWidth: "720px", margin: "0 auto 2rem", width: "100%" }}>
        <AuthPanel defaultMode={defaultMode} />
      </div>
    </div>
  );
};

export default AccountPage;
