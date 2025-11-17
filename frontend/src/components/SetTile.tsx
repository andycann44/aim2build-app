import React from "react";
import { SetSummary } from "../api/client";

type TileSet = Pick<
  SetSummary,
  "set_num" | "name" | "year" | "num_parts" | "img_url"
> & {
  in_inventory?: boolean;
};

export interface SetTileProps {
  set: TileSet;
  onAddMySet?: (setNum: string) => void;
  onAddWishlist?: (setNum: string) => void;
  onAddInventory?: (setNum: string) => void;
  inMySets?: boolean;
  inWishlist?: boolean;
}

const pillBase: React.CSSProperties = {
  borderRadius: 999,
  border: "2px solid rgba(255,255,255,0.95)", // white outline
  background:
    "linear-gradient(135deg, #020617 0%, #020617 35%, #111827 100%)",
  color: "#f9fafb",
  fontSize: "0.8rem",
  fontWeight: 700,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  padding: "0.45rem 0.95rem",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 6px 14px rgba(15,23,42,0.7)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const SetTile: React.FC<SetTileProps> = ({
  set,
  onAddMySet,
  onAddWishlist,
  onAddInventory,
  inMySets,
  inWishlist,
}) => {
  const { set_num, name, year, num_parts, img_url, in_inventory } = set;
  const inInventory = !!in_inventory;

  const handleAddMySet = () => {
    if (onAddMySet) onAddMySet(set_num);
  };

  const handleAddWishlist = () => {
    if (onAddWishlist) onAddWishlist(set_num);
  };

  const handleAddInventory = () => {
    if (onAddInventory) onAddInventory(set_num);
  };

  return (
    <div
      className="set-tile-frame"
      style={{
        borderRadius: 28,
        padding: 2,
        background:
          "linear-gradient(135deg,#f97316,#facc15,#22c55e,#38bdf8,#6366f1)",
        boxShadow: "0 18px 40px rgba(15,23,42,0.45)",
      }}
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
        }}
      >
        {/* IMAGE – fixed sized white box for all tiles */}
        <div
          style={{
            borderRadius: 22,
            overflow: "hidden",
            background: "#e5edf5",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 240,         // 🔒 same height for all
            width: "100%",
          }}
        >
          {img_url ? (
            <img
              src={img_url}
              alt={name}
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

        {/* TITLE + PCS PILL */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: "1.05rem",
                fontWeight: 800,
                color: "#111827",
                marginBottom: 2,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={name}
            >
              {name}
            </div>
            <div
              style={{
                fontSize: "0.85rem",
                color: "#6b7280",
              }}
            >
              {set_num} • {year}
            </div>
          </div>

          {/* pcs pill */}
          <div
            style={{
              ...pillBase,
              padding: "0.35rem 0.9rem",
              fontSize: "0.78rem",
              background:
                "linear-gradient(135deg,#0ea5e9,#22c55e,#facc15)",
              color: "#111827",
            }}
          >
            {num_parts}pcs
          </div>
        </div>

        {/* BUTTON ROWS */}
        <div
          style={{
            marginTop: "0.75rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.6rem",
          }}
        >
          {/* My Sets / Wishlist chips */}
          {(onAddMySet || onAddWishlist) && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              {onAddMySet && (
                <button
                  type="button"
                  onClick={handleAddMySet}
                  style={{
                    ...pillBase,
                    background: inMySets
                      ? "linear-gradient(135deg,#22c55e,#a3e635)"
                      : pillBase.background,
                    color: inMySets ? "#052e16" : pillBase.color,
                    cursor: inMySets ? "default" : "pointer",
                  }}
                >
                  {inMySets ? "In My Sets" : "+ My Sets"}
                </button>
              )}

              {onAddWishlist && (
                <button
                  type="button"
                  onClick={handleAddWishlist}
                  style={{
                    ...pillBase,
                    background: inWishlist
                      ? "linear-gradient(135deg,#f97316,#fb7185)"
                      : pillBase.background,
                    color: inWishlist ? "#111827" : pillBase.color,
                    cursor: inWishlist ? "default" : "pointer",
                  }}
                >
                  {inWishlist ? "In Wishlist" : "+ Wishlist"}
                </button>
              )}
            </div>
          )}

          {/* Add to Inventory – full width hero pill */}
          {(onAddInventory || inInventory) && (
            <button
              type="button"
              onClick={handleAddInventory}
              disabled={inInventory && !onAddInventory}
              style={{
                ...pillBase,
                width: "100%",
                justifyContent: "center",
                background: inInventory
                  ? "linear-gradient(135deg,#22c55e,#a3e635)"
                  : "linear-gradient(135deg,#0f172a,#111827)",
                color: inInventory ? "#052e16" : "#f9fafb",
                cursor:
                  inInventory && !onAddInventory ? "default" : "pointer",
              }}
            >
              {inInventory ? "In Inventory" : "Add to Inventory"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetTile;