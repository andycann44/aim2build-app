import React from "react";
import AuthPanel from "./AuthPanel";

const NotSignedIn: React.FC<{ pageName?: string }> = ({ pageName }) => {
  return (
    <div style={{ maxWidth: "820px", margin: "2rem auto", textAlign: "center" }}>
      <h2 style={{ marginBottom: "1rem" }}>
        You are not signed in
      </h2>
      <p style={{ marginBottom: "2rem", opacity: 0.8 }}>
        {pageName
          ? `You need to be logged in to view your ${pageName}.`
          : "Please sign in to continue."}
      </p>

      <div style={{
        maxWidth: "500px",
        margin: "0 auto"
      }}>
        <AuthPanel />
      </div>
    </div>
  );
};

export default NotSignedIn;