import React from "react";

type Props = {
  kind?: "info" | "warn" | "error" | "success";
  title?: string;
  message: string;
  onClose?: () => void;
};

export default function NoticeBanner({
  kind = "info",
  title,
  message,
  onClose,
}: Props) {
  const tone =
    kind === "success"
      ? { bg: "rgba(46, 204, 113, 0.14)", brd: "rgba(46, 204, 113, 0.45)", fg: "#1f8f4a" }
      : kind === "warn"
      ? { bg: "rgba(241, 196, 15, 0.14)", brd: "rgba(241, 196, 15, 0.45)", fg: "#9a7b00" }
      : kind === "error"
      ? { bg: "rgba(231, 76, 60, 0.12)", brd: "rgba(231, 76, 60, 0.45)", fg: "#b23b2f" }
      : { bg: "rgba(52, 152, 219, 0.12)", brd: "rgba(52, 152, 219, 0.45)", fg: "#1f6fa5" };

  return (
    <div
      role="alert"
      style={{
        margin: "12px 0 0",
        padding: "10px 12px",
        borderRadius: 14,
        border: `1px solid ${tone.brd}`,
        background: tone.bg,
        color: tone.fg,
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        boxShadow: "0 6px 18px rgba(0,0,0,0.10)",
      }}
    >
      <div style={{ fontSize: 18, lineHeight: "18px", marginTop: 1 }}>
        {kind === "success" ? "✓" : kind === "warn" ? "!" : kind === "error" ? "×" : "i"}
      </div>

      <div style={{ flex: 1 }}>
        {title ? (
          <div style={{ fontWeight: 800, marginBottom: 2 }}>{title}</div>
        ) : null}
        <div style={{ fontWeight: 600, opacity: 0.95 }}>{message}</div>
      </div>

      {onClose ? (
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