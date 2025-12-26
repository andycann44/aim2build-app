// frontend/src/components/BuildabilityPartsTile.tsx
import React from "react";
import { InventoryPart } from "./PartsTile";

type BuildabilityPartsTileProps = {
  part: InventoryPart;
  need: number;
  have: number;
};

const BuildabilityPartsTile: React.FC<BuildabilityPartsTileProps> = ({
  part,
  need,
  have,
}) => {
  const missing = Math.max(need - have, 0);

  return (
    <div
      className="set-tile-frame"
      style={{
        borderRadius: 26,
        padding: 2,
        background:
          "linear-gradient(135deg,#f97316,#facc15,#22c55e,#38bdf8,#6366f1)",
        boxShadow: "0 16px 36px rgba(15,23,42,0.32)",
        width: "220px",
        height: "100%",
      }}
    >
      <div
        style={{
          width: "100%",
          borderRadius: 24,
          background: "#ffffffff",
          boxShadow: "0 12px 28px rgba(15,23,42,0.18)",
          padding: "1rem 1rem 0.8rem",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: "0.6rem",
          height: "100%",
        }}
      >
        {/* Image */}
        <div
          style={{
            height: "120px",
            borderRadius: "18px",
            background: "#fffffff2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          {part.part_img_url ? (
            <img
              src={part.part_img_url}
              alt={part.part_num}
              style={{
                maxWidth: "100%",
                maxHeight: "100%",
                objectFit: "contain",
                display: "block",
              }}
            />
          ) : (
            <span
              style={{
                fontSize: "0.8rem",
                color: "#6b7280",
              }}
            >
              No image
            </span>
          )}
        </div>

        {/* Text + pills inside the card */}
        <div
          style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}
        >
          {/* Part number + have pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "#111827",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {part.part_num}
            </div>

            <div
              style={{
                borderRadius: "999px",
                padding: "0.25rem 0.7rem",
                background:
                  missing > 0
                    ? "linear-gradient(90deg,#fecaca,#f97373)"
                    : "linear-gradient(90deg,#bbf7d0,#22c55e)",
                color: missing > 0 ? "#7f1d1d" : "#022c22",
                fontSize: "0.8rem",
                fontWeight: 700,
                minWidth: "3rem",
                textAlign: "center",
              }}
            >
              x{have}
            </div>
          </div>

          {/* Colour line */}
          <div
            style={{
              fontSize: "0.78rem",
              color: "#6b7280",
            }}
          >
            Colour {part.color_id}
          </div>

          {/* Need / have / missing line (still INSIDE card) */}
          <div
            style={{
              marginTop: "0.15rem",
              fontSize: "0.78rem",
              color: "#4b5563",
            }}
          >
            <span>
              Set needs <strong>{need}</strong> · You have{" "}
              <strong>{have}</strong>
            </span>
            {missing > 0 && (
              <>
                {" · "}
                <span style={{ color: "#b91c1c" }}>
                  Missing <strong>{missing}</strong>
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BuildabilityPartsTile;
