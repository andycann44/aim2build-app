import React from "react";

export type InventoryPart = {
  part_num: string;
  color_id: number;
  qty_total: number;
  part_img_url?: string; // comes from backend when available
};

type PartsTileProps = {
  part: InventoryPart;
};

const PartsTile: React.FC<PartsTileProps> = ({ part }) => {
  // Prefer the URL the backend gives us. If it's missing/blank, we just
  // fall back to "No image" instead of guessing a CDN path.
  const imgUrl =
    part.part_img_url && part.part_img_url.trim().length > 0
      ? part.part_img_url
      : undefined;

  const [imageError, setImageError] = React.useState(false);

  return (
    <div
      className="part-tile"
      style={{
        backgroundColor: "#ffffff",
        borderRadius: 22,
        padding: "0.85rem 0.85rem 0.75rem",
        boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
        border: "1px solid rgba(148,163,184,0.4)",
        display: "flex",
        flexDirection: "column",
        gap: "0.6rem",
        height: "100%",
      }}
    >
      {/* IMAGE BLOCK – white behind the part so it looks clean */}
      <div
        style={{
          borderRadius: 18,
          backgroundColor: "#ffffff",
          padding: "0.75rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 110,
          position: "relative",
          overflow: "hidden",
        }}
      >
        {imgUrl && !imageError ? (
          <img
            src={imgUrl}
            alt={part.part_num}
            style={{
              maxWidth: "100%",
              maxHeight: 110,
              objectFit: "contain",
              display: "block",
            }}
            onError={() => setImageError(true)}
          />
        ) : (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.8rem",
              color: "#9ca3af",
            }}
          >
            No image
          </span>
        )}
      </div>

      {/* TEXT + GREEN PILL – simple for inventory */}
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 16,
          padding: "0.55rem 0.65rem 0.5rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "#111827",
            }}
          >
            {part.part_num}
          </div>
          <div
            style={{
              fontSize: "0.75rem",
              color: "#6b7280",
            }}
          >
            Colour {part.color_id}
          </div>
        </div>
        <div
          style={{
            borderRadius: 999,
            padding: "0.25rem 0.7rem",
            backgroundColor: "#22c55e",
            fontSize: "0.8rem",
            fontWeight: 700,
            color: "#022c22",
            minWidth: "3rem",
            textAlign: "center",
          }}
        >
          x{part.qty_total}
        </div>
      </div>
    </div>
  );
};

export default PartsTile;