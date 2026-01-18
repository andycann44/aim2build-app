import React from "react";
import { useNavigate } from "react-router-dom";
import SafeImg from "./SafeImg";
import { SetSummary } from "../api/client";
import { API_BASE } from "../api/client";
import { authHeaders, getToken } from "../utils/auth";

type TileSet = Pick<SetSummary, "set_num" | "name" | "year" | "num_parts" | "img_url"> & {
  in_inventory?: boolean;
};

export interface SetTileProps {
  set: TileSet;
  onAddMySet?: (setNum: string) => void;
  onAddWishlist?: (setNum: string) => void;
  onAddInventory?: (setNum: string) => void;
  onRemoveMySet?: (setNum: string) => void;
  inMySets?: boolean;
  inWishlist?: boolean;
  onRemoveFromInventory?: (setNum: string) => void;
  onOpenDetails?: (setNum: string) => void;
}

const pillBase: React.CSSProperties = {
  borderRadius: 999,
  border: "2px solid rgba(255,255,255,0.95)",
  background: "linear-gradient(135deg, #020617 0%, #020617 35%, #111827 100%)",
  color: "#f9fafb",
  fontSize: "0.72rem",
  fontWeight: 800,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  padding: "0.32rem 0.68rem",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "0 6px 14px rgba(15,23,42,0.7)",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

function normalizeSetForLegoSearch(setNum: string) {
  return (setNum || "").trim().replace(/-\d+$/, "");
}

function legoInstructionsUrl(setNum: string) {
  const q = normalizeSetForLegoSearch(setNum);
  return `https://www.lego.com/en-gb/service/buildinginstructions/${encodeURIComponent(q)}`;
}

async function tryUnpourSet(setNum: string): Promise<void> {
  // If you already have a proper endpoint, wire it via onRemoveFromInventory and this won’t be used.
  const candidates: Array<{ url: string; method: "POST" | "DELETE" }> = [
    { url: `${API_BASE}/api/inventory/unpour-set?set=${encodeURIComponent(setNum)}`, method: "POST" },
    { url: `${API_BASE}/api/inventory/unpour-set?set=${encodeURIComponent(setNum)}`, method: "DELETE" },
    { url: `${API_BASE}/api/inventory/unpour?set=${encodeURIComponent(setNum)}`, method: "POST" },
    { url: `${API_BASE}/api/inventory/unpour?set=${encodeURIComponent(setNum)}`, method: "DELETE" },
    { url: `${API_BASE}/api/inventory/remove-poured-set?set=${encodeURIComponent(setNum)}`, method: "POST" },
    { url: `${API_BASE}/api/inventory/remove-poured-set?set=${encodeURIComponent(setNum)}`, method: "DELETE" },
  ];

  let lastText = "";
  for (const c of candidates) {
    const res = await fetch(c.url, { method: c.method, headers: authHeaders() });
    if (res.ok) return;
    lastText = await res.text().catch(() => "");
  }
  throw new Error(lastText || "Failed to remove set from inventory (no matching backend endpoint found)");
}

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
  const { set_num, name, year, num_parts, img_url } = set;
  const navigate = useNavigate();

  // local state so the Search page can flip instantly without waiting for parent refresh
  const [localInInventory, setLocalInInventory] = React.useState<boolean>(!!set.in_inventory);

  React.useEffect(() => {
    setLocalInInventory(!!set.in_inventory);
  }, [set.in_inventory]);

  const handleAddMySet = () => {
    onAddMySet?.(set_num);
  };

  const handleRemoveMySet = () => {
    onRemoveMySet?.(set_num);
  };

  const handleAddWishlist = () => {
    onAddWishlist?.(set_num);
  };

  const handlePourToInventory = async () => {
    if (!set_num) return;
    if (!getToken()) {
      navigate("/account?mode=login");
      return;
    }

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

      setLocalInInventory(true);
      onAddInventory?.(set_num);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to add set to inventory");
    }
  };

  const handleUnpourFromInventory = async () => {
    if (!set_num) return;

    try {
      // prefer parent wiring if available (My Sets page etc.)
      if (onRemoveFromInventory) {
        onRemoveFromInventory(set_num);
        setLocalInInventory(false);
        return;
      }

      // fallback for Search page if you didn’t wire the callback there yet
      await tryUnpourSet(set_num);
      setLocalInInventory(false);
    } catch (e: any) {
      console.error(e);
      alert(e?.message || "Failed to remove set from inventory");
    }
  };

  const handleOpenDetails = (e?: React.MouseEvent) => {
    if (!onOpenDetails) return;
    e?.preventDefault();
    e?.stopPropagation();
    onOpenDetails(set_num);
  };

  const showInstructions = !!inMySets; // only once it’s in My Sets
  const showInventoryToggle = !!inMySets; // keep it “earned” by adding to My Sets first

  return (
    <div
      className="set-tile-frame"
      style={{
        borderRadius: 28,
        padding: 2,
        background: "linear-gradient(135deg,#f97316,#facc15,#22c55e,#38bdf8,#6366f1)",
        boxShadow: "0 18px 40px rgba(15,23,42,0.45)",
      }}
      onDoubleClick={(e) => handleOpenDetails(e)}
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

        {/* ACTION ROW (single row, wraps only if it absolutely must) */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "0.45rem",
            alignItems: "center",
          }}
        >
          {onAddMySet && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleAddMySet();
              }}
              style={{
                ...pillBase,
                background: inMySets ? "linear-gradient(135deg,#22c55e,#a3e635)" : pillBase.background,
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
              onClick={(e) => {
                e.stopPropagation();
                handleAddWishlist();
              }}
              style={{
                ...pillBase,
                background: inWishlist ? "linear-gradient(135deg,#f97316,#fb7185)" : pillBase.background,
                color: inWishlist ? "#111827" : pillBase.color,
                cursor: inWishlist ? "default" : "pointer",
              }}
            >
              {inWishlist ? "In Wishlist" : "+ Wishlist"}
            </button>
          )}

          {showInstructions ? (
            <a
              href={legoInstructionsUrl(set_num)}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                ...pillBase,
                textDecoration: "none",
                background: "linear-gradient(135deg,#0ea5e9,#38bdf8)",
                color: "#052e16",
              }}
              title="Open LEGO building instructions"
              onClick={(e) => e.stopPropagation()}
            >
              Instructions
            </a>
          ) : null}

          {showInventoryToggle ? (
            localInInventory ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleUnpourFromInventory();
                }}
                style={{
                  ...pillBase,
                  background: "linear-gradient(135deg,#22c55e,#a3e635)",
                  color: "#052e16",
                }}
                title="Remove this set from your inventory (unpour)"
              >
                Remove from Inventory
              </button>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handlePourToInventory();
                }}
                style={{
                  ...pillBase,
                  background: "linear-gradient(135deg,#0f172a,#111827)",
                  color: "#f9fafb",
                }}
                title="Pour this set into your inventory"
              >
                Add to Inventory
              </button>
            )
          ) : null}

          {onRemoveMySet && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleRemoveMySet();
              }}
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
      </div>
    </div>
  );
};

export default SetTile;
