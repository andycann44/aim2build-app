// frontend/src/components/StagingBanner.tsx

import React from "react";

export default function StagingBanner() {
  if (typeof window === "undefined") return null;

  const host = window.location.hostname;
  if (!host.startsWith("staging.")) return null;

  return (
    <div
      style={{
        background: "#b00020",
        color: "white",
        textAlign: "center",
        padding: "6px 12px",
        fontWeight: 700,
        letterSpacing: "1px",
        zIndex: 9999,
      }}
    >
      ⚠️ STAGING ENVIRONMENT — NOT PRODUCTION
    </div>
  );
}