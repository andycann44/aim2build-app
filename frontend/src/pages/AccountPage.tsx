import React from "react";
import AuthPanel from "../components/AuthPanel";
import PageHero from "../components/PageHero";

const AccountPage: React.FC = () => {
  return (
    <div className="page page-account">
      <PageHero
        title="Account"
        subtitle="Sign in or create an account to save your sets, wishlist and inventory on this device."
      />

      {/* Auth card aligned with other pages */}
      <div style={{ maxWidth: "720px", margin: "0 auto 2rem", width: "100%" }}>
        <AuthPanel />
      </div>
    </div>
  );
};

export default AccountPage;
