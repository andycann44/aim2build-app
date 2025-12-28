// frontend/src/components/PartsTile.tsx
import React from "react";

export type InventoryPart = {
  part_num: string;
  color_id: number;
  qty_total?: number;
  qty?: number;
  // canonical image field – from backend when available
  part_img_url?: string | null;
  img_url?: string | null;
};

type PartsTileProps = {
  part: InventoryPart;

  // when true, hide the built-in green qty pill (legacy flag, keep for safety)
  hideQty?: boolean;

  // layout mode
  // - "inventory"  = normal inventory grid (green pill)
  // - "addBricks"  = inline - qty + controls inside the tile
  mode?: "inventory" | "addBricks";

  // optional qty + handlers for addBricks mode
  qty?: number;
  onChangeQty?: (delta: number) => void;
};

const PartsTile: React.FC<PartsTileProps> = ({
  part,
  hideQty,
  mode = "inventory",
  qty,
  onChangeQty,
}) => {
  // STRICT: only use backend-provided part_img_url.
  // If missing, show "No image". Never guess/fallback to ldraw.
  const imgUrl = ((part.part_img_url ?? part.img_url ?? "").trim() || undefined);

  const [imageError, setImageError] = React.useState(false);

  const isAddBricks = mode === "addBricks";

  // Display qty rules:
  // - Add Bricks page: default 0 unless explicitly provided
  // - Inventory: use part.qty_total
    const displayQtyRaw =
    typeof qty === "number" ? qty : isAddBricks ? 0 : ((part.qty_total ?? part.qty) ?? 0);
  const displayQty = Math.max(0, displayQtyRaw);
  const minQty = 0; // future: set-floor goes here
  const canDec = !!onChangeQty && displayQty > minQty;
  const canInc = !!onChangeQty;
  return (
    <div
      className="part-tile"
      style={{
        borderRadius: 26,
        padding: 2,
        background:
          "linear-gradient(135deg,#f97316,#facc15,#22c55e,#38bdf8,#6366f1)",
        boxShadow: "0 18px 40px rgba(15,23,42,0.3)",
        height: "100%",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 24,
          padding: "0.85rem 0.85rem 0.75rem",
          boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
          border: "1px solid rgba(148,163,184,0.4)",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
          height: "100%",
        }}
      >
        {/* IMAGE */}
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

        {/* TEXT + QTY AREA */}
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
              Colour {String(part.color_id)}
            </div>
          </div>

          {/* INVENTORY MODE – green pill as before */}
          {!isAddBricks && !hideQty && (
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
              x{displayQty}
            </div>
          )}

          {/* ADD-BRICKS MODE – inline - qty + inside tile */}
                    {isAddBricks && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 8px",
                borderRadius: 999,
                border: `1px solid ${
                  displayQty > 0 ? "rgba(34,197,94,0.55)" : "rgba(148,163,184,0.55)"
                }`,
                background:
                  displayQty > 0 ? "rgba(34,197,94,0.14)" : "rgba(15,23,42,0.06)",
                color: "#0f172a",
                fontWeight: 800,
              }}
              title="Owned quantity"
            >
              <button
                type="button"
                onClick={canDec ? () => onChangeQty && onChangeQty(-1) : undefined}
                disabled={!canDec}
                style={{
                  width: 28,
                  height: 22,
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.9)",
                  background: "rgba(15,23,42,0.98)",
                  color: "#e5e7eb",
                  cursor: canDec ? "pointer" : "default",
                  opacity: canDec ? 1 : 0.35,
                  fontWeight: 900,
                  lineHeight: "20px",
                }}
                aria-label="Decrease"
              >
                −
              </button>

              <div
                style={{
                  minWidth: 28,
                  textAlign: "center",
                  fontSize: "0.85rem",
                  fontVariantNumeric: "tabular-nums",
                  color: "#111827",
                }}
              >
                {displayQty}
              </div>

              <button
                type="button"
                onClick={canInc ? () => onChangeQty && onChangeQty(1) : undefined}
                disabled={!canInc}
                style={{
                  width: 28,
                  height: 22,
                  borderRadius: 999,
                  border: "1px solid rgba(148,163,184,0.9)",
                  background: "rgba(15,23,42,0.98)",
                  color: "#e5e7eb",
                  cursor: canInc ? "pointer" : "default",
                  opacity: canInc ? 1 : 0.35,
                  fontWeight: 900,
                  lineHeight: "20px",
                }}
                aria-label="Increase"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartsTile;