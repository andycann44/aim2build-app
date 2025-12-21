import React from "react";
import { SetSummary } from "../api/client";

type TileSet = Pick<SetSummary, "set_num" | "name" | "year" | "num_parts" | "img_url"> & {
  in_inventory?: boolean;
};

export interface SetTileProps {
  set: TileSet;
  onAddMySet?: (setNum: string) => void | Promise<void>;
  onAddWishlist?: (setNum: string) => void | Promise<void>;

  // allow async or sync handlers (minimal + backward compatible)
  onAddInventory?: (setNum: string) => void | Promise<void>;
  onRemoveFromInventory?: (setNum: string) => void | Promise<void>;

  onRemoveMySet?: (setNum: string) => void;
  inMySets?: boolean;
  inWishlist?: boolean;
  onOpenDetails?: (setNum: string) => void;
}

const pillBase: React.CSSProperties = {
  borderRadius: 999,
  border: "2px solid rgba(255,255,255,0.95)",
  background: "linear-gradient(135deg, #020617 0%, #020617 35%, #111827 100%)",
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
  onRemoveFromInventory,
  onRemoveMySet,
  inMySets,
  inWishlist,
  onOpenDetails,
}) => {
  const { set_num, name, year, num_parts, img_url } = set;

  // local optimistic state for inventory button
  const [localInInventory, setLocalInInventory] = React.useState<boolean>(!!set.in_inventory);
  const [localInMySets, setLocalInMySets] = React.useState<boolean>(!!inMySets);
  const [localInWishlist, setLocalInWishlist] = React.useState<boolean>(!!inWishlist);
  const [isAddingMySet, setIsAddingMySet] = React.useState<boolean>(false);
  const [isAddingWishlist, setIsAddingWishlist] = React.useState<boolean>(false);
  const [isAddingInventory, setIsAddingInventory] = React.useState<boolean>(false);
  const [isRemovingInventory, setIsRemovingInventory] = React.useState<boolean>(false);

  React.useEffect(() => {
    setLocalInInventory(!!set.in_inventory);
  }, [set.in_inventory]);

  React.useEffect(() => {
    setLocalInMySets(!!inMySets);
  }, [inMySets]);

  React.useEffect(() => {
    setLocalInWishlist(!!inWishlist);
  }, [inWishlist]);

  const handleAddMySet = async () => {
    if (!onAddMySet) return;
    if (localInMySets || isAddingMySet) return;
    try {
      setIsAddingMySet(true);
      await onAddMySet(set_num);
      setLocalInMySets(true);
    } finally {
      setIsAddingMySet(false);
    }
  };

  const handleRemoveMySet = () => onRemoveMySet?.(set_num);

  const handleAddWishlist = async () => {
    if (!onAddWishlist) return;
    if (localInWishlist || isAddingWishlist) return;
    try {
      setIsAddingWishlist(true);
      await onAddWishlist(set_num);
      setLocalInWishlist(true);
    } finally {
      setIsAddingWishlist(false);
    }
  };

  const handleOpenDetails = () => onOpenDetails?.(set_num);

  const inInventory = localInInventory;
  const mySetsActive = localInMySets;
  const wishlistActive = localInWishlist;
  const inventoryButtonDisabled = isAddingInventory || isRemovingInventory;

  const handleAddInventory = async () => {
    if (!onAddInventory) return;
    if (inventoryButtonDisabled) return;
    try {
      setIsAddingInventory(true);
      await onAddInventory(set_num);
      setLocalInInventory(true);
    } finally {
      setIsAddingInventory(false);
    }
  };

  const handleRemoveInventory = async () => {
    if (!onRemoveFromInventory) return;
    if (inventoryButtonDisabled) return;
    try {
      setIsRemovingInventory(true);
      await onRemoveFromInventory(set_num);
      setLocalInInventory(false);
    } finally {
      setIsRemovingInventory(false);
    }
  };

  return (
    <div
      className="set-tile-frame"
      style={{
        borderRadius: 28,
        padding: 2,
        background: "linear-gradient(135deg,#f97316,#facc15,#22c55e,#38bdf8,#6366f1)",
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
            <div style={{ padding: "2rem", color: "#9ca3af", fontSize: "0.9rem" }}>
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
            <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              {set_num} • {year}
            </div>
          </div>

          <div
            style={{
              ...pillBase,
              padding: "0.35rem 0.9rem",
              fontSize: "0.78rem",
              background: "linear-gradient(135deg,#0ea5e9,#22c55e,#facc15)",
              color: "#111827",
            }}
          >
            {num_parts}-pcs
          </div>
        </div>

        {/* BUTTON ROWS */}
        <div style={{ marginTop: "0.75rem", display: "flex", flexDirection: "column", gap: "0.6rem" }}>
          {(onAddMySet || onAddWishlist || onRemoveMySet) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
              {onAddMySet && (
                <button
                  type="button"
                  onClick={handleAddMySet}
                  style={{
                    ...pillBase,
                    background: mySetsActive ? "linear-gradient(135deg,#22c55e,#a3e635)" : pillBase.background,
                    color: mySetsActive ? "#052e16" : pillBase.color,
                    cursor: mySetsActive || isAddingMySet ? "default" : "pointer",
                    opacity: isAddingMySet ? 0.8 : 1,
                  }}
                >
                  {mySetsActive ? "In My Sets" : isAddingMySet ? "Adding…" : "+ My Sets"}
                </button>
              )}

              {onAddWishlist && (
                <button
                  type="button"
                  onClick={handleAddWishlist}
                  style={{
                    ...pillBase,
                    background: wishlistActive ? "linear-gradient(135deg,#f97316,#fb7185)" : pillBase.background,
                    color: wishlistActive ? "#111827" : pillBase.color,
                    cursor: wishlistActive || isAddingWishlist ? "default" : "pointer",
                    opacity: isAddingWishlist ? 0.8 : 1,
                  }}
                >
                  {wishlistActive ? "In Wishlist" : isAddingWishlist ? "Adding…" : "+ Wishlist"}
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

          {(onAddInventory || inInventory) && (
            <button
              type="button"
              disabled={inventoryButtonDisabled}
              onClick={inInventory ? handleRemoveInventory : handleAddInventory}
              style={{
                ...pillBase,
                width: "100%",
                justifyContent: "center",
                background: inInventory
                  ? "linear-gradient(135deg,#22c55e,#a3e635)"
                  : "linear-gradient(135deg,#0f172a,#111827)",
                color: inInventory ? "#052e16" : "#f9fafb",
                cursor: inventoryButtonDisabled ? "default" : "pointer",
                opacity: inventoryButtonDisabled ? 0.85 : 1,
              }}
            >
              {isAddingInventory
                ? "Adding..."
                : isRemovingInventory
                ? "Removing..."
                : inInventory
                ? "In Inventory"
                : "Add to Inventory"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SetTile;
