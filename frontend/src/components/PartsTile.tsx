import React from "react";

export type InventoryPart = {
  part_num: string;
  color_id: number;
  qty_total: number;
  // optional, for later if backend sends a direct URL
  part_img_url?: string;
};

type PartsTileProps = {
  part: InventoryPart;
};

const pillBase: React.CSSProperties = {
  borderRadius: 999,
  border: "2px solid rgba(255,255,255,0.95)",
  background:
    "linear-gradient(135deg, #020617 0%, #020617 35%, #111827 100%)",
  color: "#f9fafb",
  fontSize: "0.75rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  padding: "0.25rem 0.75rem",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 6px 14px rgba(15,23,42,0.7)",
  whiteSpace: "nowrap",
};

const PartsTile: React.FC<PartsTileProps> = ({ part }) => {
  const imgUrl =
    part.part_img_url ??
    `https://cdn.rebrickable.com/media/parts/ldraw/${part.color_id}/${part.part_num}.png`;

  return (
    <div
      className="part-tile-frame"
      style={{
        borderRadius: 22,
        padding: 2,
        background:
          "linear-gradient(135deg,#f97316,#facc15,#22c55e,#38bdf8,#6366f1)",
        boxShadow: "0 14px 30px rgba(15,23,42,0.5)",
      }}
    >
      <div
        className="part-tile"
        style={{
          borderRadius: 20,
          background: "#020617",
          padding: "0.8rem 0.8rem 0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.55rem",
        }}
      >
        {/* IMAGE */}
        <div
          style={{
            borderRadius: 16,
            overflow: "hidden",
            background: "#0f172a",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 150,
            width: "100%",
            position: "relative",
          }}
        >
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.8rem",
              opacity: 0.4,
              color: "#e5e7eb",
            }}
          >
            No image
          </span>

          <img
            src={imgUrl}
            alt={`Part ${part.part_num} colour ${part.color_id}`}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              position: "relative",
              zIndex: 1,
              display: "block",
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>

        {/* META + QTY PILL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.5rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.9rem",
                fontWeight: 700,
                color: "#f9fafb",
                marginBottom: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={part.part_num}
            >
              {part.part_num}
            </div>
            <div
              style={{
                fontSize: "0.8rem",
                color: "#9ca3af",
              }}
            >
              Colour {part.color_id}
            </div>
          </div>

          <div
            style={{
              ...pillBase,
              padding: "0.2rem 0.9rem",
              fontSize: "0.78rem",
              background:
                "linear-gradient(135deg,#22c55e,#a3e635)",
              color: "#052e16",
              borderColor: "rgba(34,197,94,0.9)",
            }}
          >
            x{part.qty_total}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PartsTile;
