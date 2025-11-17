import React from "react";

export function PageHero({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div
      className="page-hero"
      style={{
        margin: "1.5rem auto 1.5rem",
        maxWidth: "960px",
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
      {/* Lego studs strip */}
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
        {[
          "#dc2626",
          "#f97316",
          "#fbbf24",
          "#22c55e",
          "#0ea5e9",
          "#6366f1",
        ].map((c, i) => (
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

      {/* Title + Subtitle */}
      <h1 style={{ fontSize: "2.1rem", fontWeight: 800, marginTop: "1.2rem" }}>
        {title}
      </h1>
      {subtitle && (
        <p style={{ opacity: 0.95, marginTop: "0.5rem", fontSize: "1rem" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}