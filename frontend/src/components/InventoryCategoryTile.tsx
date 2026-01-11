// frontend/src/components/InventoryCategoryTile.tsx
import React from "react";
import SafeImg from "./SafeImg";

export type InventoryCategory = {
  key: string;
  label: string;
  description?: string;
  sampleImgUrl?: string | null;
  onClick: () => void;
};

const InventoryCategoryTile: React.FC<{ category: InventoryCategory }> = ({
  category,
}) => {
  const [hovered, setHovered] = React.useState(false);

  const outerStyle: React.CSSProperties = {
    borderRadius: 26,
    padding: 2,
    background:
      "linear-gradient(135deg,#f97316,#facc15,#22c55e,#38bdf8,#6366f1)",
    boxShadow: hovered
      ? "0 20px 40px rgba(15,23,42,0.45)"
      : "0 14px 30px rgba(15,23,42,0.28)",
    transform: hovered ? "translateY(-8px) scale(1.03)" : "translateY(0) scale(1)",
    transition:
      "transform 0.15s ease-out, box-shadow 0.15s ease-out, background 0.2s",
    cursor: "pointer",
    border: "none",
    width: "100%",
    textAlign: "left",
  };

  const innerStyle: React.CSSProperties = {
    borderRadius: 24,
    backgroundColor: "#ffffff",
    padding: "0.9rem 0.9rem 0.8rem",
    boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
    border: "1px solid rgba(148,163,184,0.4)",
    display: "flex",
    flexDirection: "column",
    gap: "0.6rem",
    height: "100%",
  };

  const imgBox: React.CSSProperties = {
    borderRadius: 18,
    backgroundColor: "#ffffff",
    padding: "0.75rem",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
    overflow: "hidden",
  };

  const labelPill: React.CSSProperties = {
    borderRadius: 999,
    backgroundColor: "#0f172a",
    color: "#f9fafb",
    fontWeight: 700,
    fontSize: "0.9rem",
    padding: "0.35rem 0.9rem",
    alignSelf: "center",
    transform: hovered ? "translateY(-2px)" : "translateY(0)",
    transition: "transform 0.15s ease-out",
  };

  return (
    <button
      type="button"
      style={outerStyle}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={category.onClick}
    >
      <div style={innerStyle}>
        <div style={imgBox}>
          <SafeImg
            src={category.sampleImgUrl ?? undefined}
            alt={category.label}
            style={{
              maxWidth: "100%",
              maxHeight: 120,
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        <div style={labelPill}>{category.label}</div>
      </div>
    </button>
  );
};

export default InventoryCategoryTile;
