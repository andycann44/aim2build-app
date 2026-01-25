import React, { useState } from "react";
import SafeImg from "./SafeImg";

export type BuildabilityItem = {
  set_num: string;
  name: string;
  year?: number;
  img_url?: string;
  coverage: number; // 0–1
  total_have?: number; // pieces you have
  total_needed?: number; // total pieces
};

type BuildabilityTileProps = {
  item: BuildabilityItem;
  onOpenDetails?: (setNum: string) => void; // double-click handler
};

const BuildabilityTile: React.FC<BuildabilityTileProps> = ({ item, onOpenDetails }) => {
  const { set_num, name, year, img_url, coverage, total_have, total_needed } = item;

  const [hovered, setHovered] = useState(false);

  const safeCoverage = typeof coverage === "number" && !Number.isNaN(coverage) ? coverage : 0;
  const percent = Math.max(0, Math.min(100, Math.round(safeCoverage * 100)));

  const have = typeof total_have === "number" ? total_have : 0;
  const needed = typeof total_needed === "number" ? total_needed : 0;

  let pillBg = "#0f172a";
  let pillText = "#e5e7eb";

  if (percent <= 0) {
    pillBg = "#ef4444"; // red
    pillText = "#7f1d1d";
  } else if (percent < 100) {
    pillBg = "#f97316"; // amber
    pillText = "#7c2d12";
  } else {
    pillBg = "#22c55e"; // green
    pillText = "#022c22";
  }

  const handleDoubleClick = (e?: React.MouseEvent) => {
    if (!onOpenDetails) return;
    e?.preventDefault();
    e?.stopPropagation();
    onOpenDetails(set_num);
  };

  return (
    <div
      className="set-tile-frame"
      style={{
        borderRadius: 28,
        padding: 2,
        background: "linear-gradient(135deg,#f97316,#facc15,#22c55e,#38bdf8,#6366f1)",
        boxShadow: hovered ? "0 18px 40px rgba(15,23,42,0.55)" : "0 12px 28px rgba(15,23,42,0.35)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        transition: "transform 150ms ease, box-shadow 150ms ease",
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={(e) => handleDoubleClick(e)}
    >
      <div
        className="set-tile"
        style={{
          borderRadius: 26,
          background: "#f9fafb",
          padding: "1.1rem 1.1rem 1rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.75rem",
          height: "100%",
        }}
      >
        {/* IMAGE – stable + safe */}
        <div
          style={{
            borderRadius: 22,
            overflow: "hidden",
            background: "#ffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 240,
            width: "100%",
          }}
        >
          {img_url && img_url.trim().length > 0 ? (
            <SafeImg
              src={img_url}
              alt={name || set_num}
              loading="lazy"
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                height: "100%",
                width: "auto",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <div
              style={{
                padding: "2rem",
                color: "#9ca3af",
                fontSize: "0.9rem",
              }}
            >
              No image available
            </div>
          )}
        </div>

        {/* TITLE + YEAR + SET NUM */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              gap: "0.75rem",
            }}
          >
            <div
              style={{
                fontSize: "0.95rem",
                fontWeight: 700,
                color: "#111827",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={name}
            >
              {name}
            </div>
            {year && (
              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#6b7280",
                  whiteSpace: "nowrap",
                }}
              >
                {year}
              </div>
            )}
          </div>

          <div
            style={{
              fontSize: "0.78rem",
              color: "#6b7280",
            }}
          >
            Set&nbsp;
            <span style={{ fontWeight: 600, color: "#111827" }}>{set_num}</span>
          </div>
        </div>

        {/* COVERAGE ROW – traffic light pill + status */}
        <div
          style={{
            marginTop: "0.35rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <div
            style={{
              borderRadius: 999,
              padding: "0.3rem 0.9rem",
              backgroundColor: pillBg,
              color: pillText,
              fontSize: "0.8rem",
              fontWeight: 700,
              minWidth: "3.4rem",
              textAlign: "center",
              whiteSpace: "nowrap",
            }}
          >
            {percent}%
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "#6b7280",
              textAlign: "right",
              flex: 1,
            }}
          >
            {percent >= 100 ? "Ready to build!" : percent <= 0 ? "No parts yet" : "On your way"}
          </div>
        </div>

        {/* PIECES SUMMARY */}
        {needed > 0 && (
          <div
            style={{
              fontSize: "0.76rem",
              color: "#9ca3af",
              marginTop: "0.15rem",
            }}
          >
            {have.toLocaleString()} / {needed.toLocaleString()} pieces available
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildabilityTile;