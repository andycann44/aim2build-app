import React from "react";
import { useLocation } from "react-router-dom";
import AuthPanel from "../components/AuthPanel";
import PageHero from "../components/PageHero";

const AccountPage: React.FC = () => {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);

  const modeParam = qs.get("mode")?.toLowerCase();
  const defaultMode: "login" | "register" | undefined =
    modeParam === "signup" || modeParam === "register" || modeParam === "create"
      ? "register"
      : modeParam === "login"
        ? "login"
        : undefined;

  const reasonParam = qs.get("reason")?.toLowerCase();
  const showExpired = reasonParam === "expired";

  return (
    <div className="page page-account">
      <PageHero
        title="Account"
        subtitle="Sign in or create an account to save your sets, wishlist and inventory on this device."
      />

      <div style={{ maxWidth: "720px", margin: "0 auto 2rem", width: "100%" }}>
        {showExpired && (
          <div
            style={{
              margin: "0 0 1rem",
              padding: "0.75rem 1rem",
              borderRadius: "12px",
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            Session expired — please sign in again.
          </div>
        )}

        <AuthPanel defaultMode={defaultMode} />
      </div>
    </div>
  );
};

export default AccountPage;