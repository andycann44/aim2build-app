import React from "react";

type Props = {
  kind?: "info" | "warn" | "error" | "success";
  title?: string;
  message: string;
  onClose?: () => void;
  compact?: boolean;
  overlay?: boolean; // legacy alias for tile overlay
  variant?: "default" | "tileOverlay";
};

export default function NoticeBanner({
  kind = "info",
  title,
  message,
  onClose,
  compact = false,
  overlay = false,
  variant = "default",
}: Props) {
  const isTileOverlay = variant === "tileOverlay" || overlay;
  const tone =
    kind === "success"
      ? { bg: "rgba(46, 204, 113, 0.14)", brd: "rgba(46, 204, 113, 0.45)", fg: "#1f8f4a" }
      : kind === "warn"
      ? { bg: "rgba(241, 196, 15, 0.14)", brd: "rgba(241, 196, 15, 0.45)", fg: "#9a7b00" }
      : kind === "error"
      ? { bg: "rgba(231, 76, 60, 0.12)", brd: "rgba(231, 76, 60, 0.45)", fg: "#b23b2f" }
      : { bg: "rgba(52, 152, 219, 0.12)", brd: "rgba(52, 152, 219, 0.45)", fg: "#1f6fa5" };

  const overlayStyle: React.CSSProperties = isTileOverlay
    ? {
        position: "absolute",
        top: 10,
        left: 10,
        right: 10,
        zIndex: 2,
        pointerEvents: "none",
        padding: "0.55rem 0.7rem",
        borderRadius: "14px",
        border: "1px solid rgba(255,193,7,0.38)",
        background: "rgba(255,193,7,0.32)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        boxShadow: "0 10px 28px rgba(0,0,0,0.18)",
        color: "#2f2300",
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        maxWidth: "calc(100% - 20px)",
      }
    : {};

  const baseStyle: React.CSSProperties = isTileOverlay
    ? overlayStyle
    : {
        margin: compact ? "8px 0 0" : "12px 0 0",
        padding: compact ? "6px 8px" : "10px 12px",
        borderRadius: compact ? 10 : 14,
        border: `1px solid ${tone.brd}`,
        background: tone.bg,
        color: tone.fg,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        boxShadow: compact ? "0 2px 8px rgba(0,0,0,0.08)" : "0 6px 18px rgba(0,0,0,0.10)",
        fontSize: compact ? "0.85rem" : undefined,
        lineHeight: compact ? 1.3 : undefined,
      };

  return (
    <div
      role="alert"
      style={baseStyle}
    >
      <div style={{ fontSize: 18, lineHeight: "18px", marginTop: 1 }}>
        {isTileOverlay
          ? "🔒"
          : kind === "success"
          ? "✓"
          : kind === "warn"
          ? "!"
          : kind === "error"
          ? "×"
          : "i"}
      </div>

      <div style={{ flex: 1 }}>
        {title ? (
          <div
            style={{
              fontWeight: isTileOverlay ? 700 : 800,
              marginBottom: 2,
              fontSize: isTileOverlay ? "0.95rem" : undefined,
            }}
          >
            {title}
          </div>
        ) : null}
        <div
          style={{
            fontWeight: isTileOverlay ? 600 : 600,
            opacity: isTileOverlay ? 0.92 : 0.95,
            fontSize: isTileOverlay ? "0.85rem" : undefined,
            display: isTileOverlay ? "-webkit-box" : undefined,
            WebkitLineClamp: isTileOverlay ? 2 : undefined,
            WebkitBoxOrient: isTileOverlay ? "vertical" : undefined,
            overflow: isTileOverlay ? "hidden" : undefined,
          }}
        >
          {message}
        </div>
      </div>

      {!overlay && onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            border: "none",
            background: "transparent",
            cursor: "pointer",
            color: tone.fg,
            fontSize: 18,
            lineHeight: "18px",
            padding: "2px 6px",
            borderRadius: 10,
          }}
          title="Dismiss"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}
