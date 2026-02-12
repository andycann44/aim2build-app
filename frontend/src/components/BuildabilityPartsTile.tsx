// frontend/src/components/BuildabilityPartsTile.tsx
import React from "react";
import SafeImg from "./SafeImg";
import { InventoryPart } from "./PartsTile";
import { API_BASE } from "../api/client";
import { authHeaders } from "../utils/auth";

type BuildabilityPartsTileProps = {
  part: InventoryPart;
  partName?: string | null;
  need: number;
  have: number;
  mode?: "inventory" | "buildability" | "missing";
  editableQty?: boolean;
  onChangeQty?: (delta: number) => void;
  showBottomLine?: boolean;
  showInfoButton?: boolean;
  infoText?: string;
};

const randomImgCache = new Map<string, string | null>();
const inflightRequests = new Map<string, Promise<string | null>>();

async function fetchRandomImage(partNum: string): Promise<string | null> {
  if (randomImgCache.has(partNum)) return randomImgCache.get(partNum) ?? null;
  if (inflightRequests.has(partNum)) return inflightRequests.get(partNum) ?? null;

  const p = (async () => {
    try {
      const res = await fetch(
        `${API_BASE}/api/catalog/part-image-random?part_num=${encodeURIComponent(partNum)}`,
        { headers: { ...authHeaders() } }
      );
      if (!res.ok) return null;
      const data = (await res.json()) as { img_url?: string | null };
      const url = typeof data?.img_url === "string" ? data.img_url : null;
      randomImgCache.set(partNum, url);
      return url;
    } catch {
      randomImgCache.set(partNum, null);
      return null;
    } finally {
      inflightRequests.delete(partNum);
    }
  })();

  inflightRequests.set(partNum, p);
  return p;
}

const BuildabilityPartsTile: React.FC<BuildabilityPartsTileProps> = ({
  part,
  partName = null,
  need,
  have,
  mode = "buildability",
  editableQty = false,
  onChangeQty,
  showBottomLine = true,
  showInfoButton = false,
  infoText,
}) => {
  const missing = React.useMemo(() => Math.max((need ?? 0) - (have ?? 0), 0), [need, have]);

  const canDec = React.useMemo(() => editableQty && !!onChangeQty && have > 0, [editableQty, onChangeQty, have]);
  const canInc = React.useMemo(() => editableQty && !!onChangeQty, [editableQty, onChangeQty]);

  const [infoOpen, setInfoOpen] = React.useState(false);
  const infoRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!showInfoButton) return;
    const handler = (e: MouseEvent) => {
      if (!infoRef.current) return;
      if (!infoRef.current.contains(e.target as Node)) setInfoOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showInfoButton]);

  const BOTTOM_SLOT_MIN_HEIGHT = 18;
  const showBottomSlot = React.useMemo(() => mode !== "inventory" && showBottomLine, [mode, showBottomLine]);
  const bottomLineIsMissingMode = mode === "missing";

  const showColour = React.useMemo(() => {
    return typeof part.color_id === "number" && Number.isFinite(part.color_id) && part.color_id >= 0
      ? String(part.color_id)
      : "—";
  }, [part.color_id]);

  const [fallbackImg, setFallbackImg] = React.useState<string | null>(null);
  const colorMissing = part.color_id === null || part.color_id === undefined;
  const baseImg = part.part_img_url ?? undefined;
  const imgSrc = baseImg ?? fallbackImg ?? undefined;

  React.useEffect(() => {
    if (!colorMissing) return;
    if (!part.part_num) return;
    if (baseImg) return;
    let alive = true;
    void fetchRandomImage(part.part_num).then((url) => {
      if (!alive) return;
      setFallbackImg(url);
    });
    return () => {
      alive = false;
    };
  }, [colorMissing, part.part_num, baseImg]);

  return (
    <div
      className="set-tile-frame"
      ref={infoRef}
      style={{
        borderRadius: 26,
        padding: 2,
        background:
          "linear-gradient(135deg,#f97316,#facc15,#22c55e,#38bdf8,#6366f1)",
        boxShadow: "0 16px 36px rgba(15,23,42,0.32)",
        width: "100%",
        height: "100%",
        minWidth: 0,
        position: "relative",
        contentVisibility: "auto" as any, // lets the browser skip offscreen paint work
        containIntrinsicSize: "260px 220px" as any,
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
          position: "relative",
        }}
      >
        {showInfoButton && (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setInfoOpen((v) => !v);
            }}
            title={infoText || part.part_num}
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              width: 24,
              height: 24,
              borderRadius: "50%",
              border: "1px solid rgba(148,163,184,0.6)",
              background: "rgba(15,23,42,0.06)",
              color: "#0f172a",
              fontWeight: 800,
              fontSize: "0.75rem",
              cursor: "pointer",
              zIndex: 2,
            }}
          >
            i
          </button>
        )}

        {/* Image */}
        <div
          style={{
            height: 120,
            borderRadius: 18,
            background: "#fffffff2",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
          }}
        >
          <SafeImg
            src={imgSrc}
            alt={part.part_num}
            loading="lazy"
            decoding="async"
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        </div>

        {/* Text + pills */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
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
                maxWidth: 110,
              }}
            >
              {part.part_num}
            </div>

            {editableQty ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={canDec ? () => onChangeQty && onChangeQty(-1) : undefined}
                  disabled={!canDec}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: "1px solid rgba(148,163,184,0.9)",
                    background: "rgba(15,23,42,0.95)",
                    color: "#e5e7eb",
                    cursor: canDec ? "pointer" : "default",
                    opacity: canDec ? 1 : 0.35,
                    fontWeight: 900,
                    lineHeight: "22px",
                  }}
                  aria-label="Decrease"
                >
                  −
                </button>

                <div
                  style={{
                    borderRadius: 999,
                    padding: "0.2rem 0.65rem",
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

                <button
                  type="button"
                  onClick={canInc ? () => onChangeQty && onChangeQty(1) : undefined}
                  disabled={!canInc}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: "1px solid rgba(148,163,184,0.9)",
                    background: "rgba(15,23,42,0.95)",
                    color: "#e5e7eb",
                    cursor: canInc ? "pointer" : "default",
                    opacity: canInc ? 1 : 0.35,
                    fontWeight: 900,
                    lineHeight: "22px",
                  }}
                  aria-label="Increase"
                >
                  +
                </button>
              </div>
            ) : (
              <div
                style={{
                  borderRadius: 999,
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
            )}
          </div>

          {partName ? (
            <div
              style={{
                fontSize: "0.78rem",
                color: "#64748b",
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={partName}
            >
              {partName}
            </div>
          ) : null}

          {/* Colour line */}
          <div style={{ fontSize: "0.78rem", color: "#6b7280" }}>
            Colour {showColour}
          </div>

          {/* Bottom slot */}
          {showBottomSlot && (
            <div
              style={{
                marginTop: "0.15rem",
                fontSize: "0.78rem",
                minHeight: BOTTOM_SLOT_MIN_HEIGHT,
                color: bottomLineIsMissingMode ? "#b91c1c" : "#4b5563",
              }}
            >
              {mode === "buildability" ? (
                <span>
                  Set needs <strong>{need}</strong> · You have <strong>{have}</strong>
                </span>
              ) : mode === "missing" ? (
                <span>
                  Missing <strong>{missing}</strong>
                </span>
              ) : (
                <span style={{ visibility: "hidden" }}>spacer</span>
              )}
            </div>
          )}
        </div>
      </div>

      {infoOpen && (
        <div
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 5,
            borderRadius: 12,
            background: "#ffffff",
            boxShadow: "0 12px 26px rgba(15,23,42,0.25)",
            border: "1px solid rgba(148,163,184,0.35)",
            padding: "0.55rem 0.7rem",
            minWidth: 220,
          }}
        >
          <div style={{ fontWeight: 800, color: "#0f172a", marginBottom: 4 }}>
            {part.part_num}
          </div>
          <div style={{ fontSize: "0.85rem", color: "#475569" }}>
            {infoText || "No description"}
          </div>
        </div>
      )}
    </div>
  );
};

// BIG WIN: stops re-render storms in huge grids
export default React.memo(BuildabilityPartsTile);
