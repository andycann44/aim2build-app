// frontend/src/components/PartsTile.tsx
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";

export type InventoryPart = {
  part_num: string;
  color_id: number;

  // inventory qty
  qty_total?: number;
  qty?: number;

  // buildability/missing fields
  need?: number;
  have?: number;
  short?: number;

  // image field (backend-provided)
  part_img_url?: string | null;
  img_url?: string | null;
};

type PartsTileProps = {
  part: InventoryPart;

  // legacy
  hideQty?: boolean;

  // layout mode
  // - "inventory"       = inventory grid (green xN)
  // - "buildability"    = buildability details grid (Set needs / You have)
  // - "missing"         = missing parts grid (Need / Missing) - no +/- controls
  // - "addBricks"       = inventory add mode (inline +/- in right pill area)
  // - "missingAdjust"   = missing parts page with inline +/- in right pill area
  mode?: "inventory" | "buildability" | "missing" | "addBricks" | "missingAdjust";

  // optional qty + handlers for adjustable modes
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
  // STRICT: only use backend-provided image URLs (no guessing).
  const imgUrl = ((part.part_img_url ?? part.img_url ?? "").trim() || undefined);
  const [imageError, setImageError] = React.useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const isBuildability = mode === "buildability";
  const isMissing = mode === "missing";
  const isAddBricks = mode === "addBricks";
  const isMissingAdjust = mode === "missingAdjust";

  const isAdjustable = isAddBricks || isMissingAdjust;

  // what number should be shown as the "qty" (pill or adjustable)
  const baseQty =
    typeof qty === "number"
      ? qty
      : isBuildability
      ? (typeof part.have === "number" ? part.have : 0)
      : isMissing
      ? (typeof part.have === "number" ? part.have : 0)
      : (part.qty_total ?? part.qty) ?? 0;

  const displayQty = Math.max(0, baseQty);

  const need = typeof part.need === "number" ? part.need : null;
  const have = typeof part.have === "number" ? part.have : null;
  const short = typeof part.short === "number" ? part.short : null;

  // Buildability/missing tiles in your screenshot show "Colour X"
  const colourLabel = `Colour ${String(part.color_id)}`;

  // Bottom line rules (to match pic 2: single clean line)
  let bottomLine = "";
  if (isBuildability && need !== null && have !== null) {
    bottomLine = `Set needs ${need} · You have ${have}`;
  } else if ((isMissing || isMissingAdjust) && need !== null && short !== null) {
    bottomLine = `Need ${need} · Missing ${short}`;
  } else if (mode === "inventory") {
    // inventory should NOT say "set needs" etc (per your request)
    bottomLine = "";
  }

  // +/- rules
  const canDec = !!onChangeQty && displayQty > 0;
  const canInc = !!onChangeQty;

  // shared text styles (match pic 2 look)
  const partNumStyle: React.CSSProperties = {
    fontSize: "1.05rem",
    fontWeight: 900,
    color: "#111827",
    lineHeight: 1.05,
    letterSpacing: "-0.01em",
  };

  const colourStyle: React.CSSProperties = {
    fontSize: "0.92rem",
    color: "#6b7280",
    fontWeight: 700,
    lineHeight: 1.1,
  };

  const bottomStyle: React.CSSProperties = {
    fontSize: "0.85rem",
    color: "#111827",
    fontWeight: 700,
    opacity: 0.9,
    lineHeight: 1.15,
    marginTop: "0.35rem",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  };

  const pillBase: React.CSSProperties = {
    borderRadius: 999,
    padding: "0.35rem 0.85rem",
    fontSize: "0.95rem",
    fontWeight: 900,
    minWidth: "3.6rem",
    textAlign: "center",
    justifySelf: "end",
    userSelect: "none",
  };

  const qtyPillStyle: React.CSSProperties = {
    ...pillBase,
    backgroundColor: "rgba(34,197,94,0.22)",
    border: "1px solid rgba(34,197,94,0.28)",
    color: "#052e1a",
  };

  const qtyPillZeroStyle: React.CSSProperties = {
    ...pillBase,
    backgroundColor: "rgba(15,23,42,0.06)",
    border: "1px solid rgba(148,163,184,0.55)",
    color: "#0f172a",
  };

  const roundBtn: React.CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: "50%",
    border: "1px solid rgba(148,163,184,0.85)",
    background: "rgba(15,23,42,0.98)",
    color: "#e5e7eb",
    fontWeight: 900,
    lineHeight: "32px",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };

  const goPickColour = () => {
    if (!isAddBricks) return;
    const pn = (part.part_num || "").trim();
    if (!pn) return;
    navigate(`/inventory/pick-colour/${encodeURIComponent(pn)}${location.search || ""}`);
  };

    const lastTapRef = React.useRef<number>(0);

  const handleOpenColours = () => {
    // only on Add Bricks grid
    if (!isAddBricks) return;

    // ignore if user clicked the +/- buttons
    const pn = (part.part_num || "").trim();
    if (!pn) return;

    navigate(`/inventory/pick-colour/${encodeURIComponent(pn)}${location.search || ""}`);
  };

  const handleTileClick = (e: React.MouseEvent) => {
    // if click originated from a button, do nothing
    const target = e.target as HTMLElement | null;
    if (target && target.closest("button")) return;

    const now = Date.now();
    const last = lastTapRef.current;
    lastTapRef.current = now;

    // second tap within 350ms = open colours
    if (now - last < 350) {
      handleOpenColours();
    }
  };
  
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
        onDoubleClick={handleTileClick}
        style={{
          backgroundColor: "#ffffff",
          borderRadius: 24,
          padding: "0.9rem 0.9rem 0.8rem",
          boxShadow: "0 10px 24px rgba(15,23,42,0.18)",
          border: "1px solid rgba(148,163,184,0.4)",
          display: "flex",
          flexDirection: "column",
          gap: "0.7rem",
          height: "100%",
        }}
      >
        {/* IMAGE */}
        <div
          style={{
            borderRadius: 18,
            backgroundColor: "#ffffff",
            padding: "0.8rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 120,
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
                maxHeight: 140,
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
                fontSize: "0.85rem",
                color: "#9ca3af",
              }}
            >
              No image
            </span>
          )}
        </div>

        {/* TEXT (LEFT) + CONTROL (RIGHT) — matches pic 2 */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "0.75rem",
            alignItems: "center",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={partNumStyle}>{part.part_num}</div>
            <div style={colourStyle}>{colourLabel}</div>
            {bottomLine ? <div style={bottomStyle}>{bottomLine}</div> : null}
          </div>

          {/* RIGHT SIDE */}
          {!hideQty && !isAdjustable && (
            <div style={displayQty > 0 ? qtyPillStyle : qtyPillZeroStyle}>
              x{displayQty}
            </div>
          )}

          {!hideQty && isAdjustable && (
            <div style={{ justifySelf: "end" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <button
                  type="button"
                  onClick={canDec ? () => onChangeQty && onChangeQty(-1) : undefined}
                  onDoubleClick={(e) => e.stopPropagation()}
                  disabled={!canDec}
                  style={{
                    ...roundBtn,
                    opacity: canDec ? 1 : 0.35,
                    cursor: canDec ? "pointer" : "default",
                  }}
                  aria-label="Decrease"
                >
                  −
                </button>

                <div style={displayQty > 0 ? qtyPillStyle : qtyPillZeroStyle}>
                  x{displayQty}
                </div>

                <button
                  type="button"
                  onClick={canInc ? () => onChangeQty && onChangeQty(1) : undefined}
                  onDoubleClick={(e) => e.stopPropagation()}
                  disabled={!canInc}
                  style={{
                    ...roundBtn,
                    opacity: canInc ? 1 : 0.35,
                    cursor: canInc ? "pointer" : "default",
                  }}
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PartsTile;