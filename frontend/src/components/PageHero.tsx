import React from "react";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Optional eyebrow/kicker above the title */
  eyebrow?: React.ReactNode;
  /** Optional left-side buttons/controls (e.g. Back) */
  left?: React.ReactNode;
  /** Optional right-side buttons/controls (e.g. Refresh) */
  right?: React.ReactNode;
  /** Optional extra content below title/subtitle (e.g. pills/filters) */
  children?: React.ReactNode;
};

/**
 * Canonical hero: matches Home hero bar behavior.
 * - Uses .search-hero wrapper (styled in index.css)
 * - Uses .hero-tiles/.hero-tile strip (same as Home)
 * - Avoids inline background/maxWidth drift; relies on existing CSS classes
 */
export function PageHero({ title, subtitle, eyebrow, left, right, children }: Props) {
  const colors = ["#dc2626", "#f97316", "#fbbf24", "#22c55e", "#0ea5e9", "#6366f1"];

  return (
    <div className="search-hero">
      {/* top brick strip (same pattern as Home) */}
      <div className="hero-tiles" aria-hidden="true">
        {colors.map((c, i) => (
          <div
            key={i}
            className="hero-tile"
            style={{ flex: 1, "--c": c } as React.CSSProperties}
          />
        ))}
      </div>

      <div className="page-hero-content" style={{ minHeight: "120px" }}>
        {(left || right) && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexWrap: "wrap",
              marginBottom: "0.9rem",
            }}
          >
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{left}</div>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>{right}</div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          {eyebrow ? <div className="page-hero-eyebrow">{eyebrow}</div> : null}
          <h1 style={{ fontSize: "1.9rem", fontWeight: 800, letterSpacing: "0.03em", margin: 0 }}>
            {title}
          </h1>

          {subtitle ? (
            <p
              style={{
                margin: 0,
                fontSize: "0.9rem",
                lineHeight: 1.45,
                opacity: 0.92,
                maxWidth: "640px",
              }}
            >
              {subtitle}
            </p>
          ) : null}
        </div>

        {children ? <div style={{ marginTop: "0.9rem" }}>{children}</div> : null}
      </div>
    </div>
  );
}

export default PageHero;
