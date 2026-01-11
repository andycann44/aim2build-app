import React from "react";
import SafeImg from "./SafeImg";
import { SetSummary } from "../api/client";
import { API_BASE } from "../api/client";
import { authHeaders } from "../utils/auth";

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
  onRemoveMySet?: (setNum: string) => void; // 👈 NEW
  inMySets?: boolean;
  inWishlist?: boolean;
  onRemoveFromInventory?: (setNum: string) => void;
  onOpenDetails?: (setNum: string) => void;
}

const pillBase: React.CSSProperties = {
  borderRadius: 999,
  border: "2px solid rgba(255,255,255,0.95)",
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
  onRemoveMySet,
  inMySets,
  inWishlist,
  onRemoveFromInventory,
  onOpenDetails,
}) => {
  const { set_num, name, year, num_parts, img_url, in_inventory } = set;
  const inInventory = !!in_inventory;

  const handleAddMySet = () => {
    if (onAddMySet) onAddMySet(set_num);
  };

  const handleRemoveMySet = () => {
    if (onRemoveMySet) onRemoveMySet(set_num);
  };

  const handleAddWishlist = () => {
    if (onAddWishlist) onAddWishlist(set_num);
  };

  const handleAddInventory = async () => {
  if (!set_num) return;

  try {
    const res = await fetch(
      `${API_BASE}/api/inventory/pour-set?set=${encodeURIComponent(set_num)}`,
      {
        method: "POST",
        headers: authHeaders(),
      }
    );

    if (!res.ok) {
      const msg = await res.text().catch(() => "");
      throw new Error(msg || `Failed to add set (${res.status})`);
    }

    // notify parent so UI refreshes state
    if (onAddInventory) onAddInventory(set_num);
  } catch (e: any) {
    console.error(e);
    alert(e?.message || "Failed to add set to inventory");
  }
};
  const handleRemoveFromInventory = () => {
    if (onRemoveFromInventory) onRemoveFromInventory(set_num);
  };

  const handleOpenDetails = () => {
    if (onOpenDetails) onOpenDetails(set_num);
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
      onDoubleClick={handleOpenDetails}
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
        {/* IMAGE */}
        <div
          style={{
            borderRadius: 22,
            overflow: "hidden",
            background: "#ffffffff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 240,
            width: "100%",
          }}
        >
          <SafeImg
            src={img_url ?? undefined}
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
            {num_parts}-pcs
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
          {(onAddMySet || onAddWishlist || onRemoveMySet) && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5rem",
                alignItems: "center",
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

              {onRemoveMySet && (
                <button
                  type="button"
                  onClick={handleRemoveMySet}
                  style={{
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.9)",
                    background: "transparent",
                    color: "#6b7280",
                    fontSize: "0.75rem",
                    padding: "0.3rem 0.7rem",
                    cursor: "pointer",
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          )}

          {(onAddInventory || onRemoveFromInventory || inInventory) && (
            <button
              type="button"
              disabled={inInventory ? !onRemoveFromInventory : !onAddInventory}
              onClick={
                inInventory ? handleRemoveFromInventory : handleAddInventory
              }
              style={{
                ...pillBase,
                width: "100%",
                justifyContent: "center",
                background: inInventory
                  ? "linear-gradient(135deg,#22c55e,#a3e635)"
                  : "linear-gradient(135deg,#0f172a,#111827)",
                color: inInventory ? "#052e16" : "#f9fafb",
                cursor:
                  inInventory && onRemoveFromInventory
                    ? "pointer"
                    : !inInventory && onAddInventory
                    ? "pointer"
                    : "default",
                opacity: inInventory ? 0.9 : 1,
              }}
              title={
                inInventory
                  ? "Remove this set from inventory"
                  : "Add this set to inventory"
              }
            >
              {inInventory ? "Remove from Inventory" : "Add to Inventory"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetTile;
