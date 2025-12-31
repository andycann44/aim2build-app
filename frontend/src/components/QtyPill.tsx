import React from "react";

type QtyPillProps = {
  qty: number;                 // show this number (0..n)
  onInc?: () => void;          // + handler
  onDec?: () => void;          // - handler
  disabled?: boolean;          // disables whole pill (optional)
  min?: number;                // floor (default 0) – future-proof for set floors
};

export default function QtyPill(props: QtyPillProps) {
  const qty = Number.isFinite(props.qty) ? props.qty : 0;
  const min = props.min ?? 0;

  const decDisabled = props.disabled || qty <= min || !props.onDec;
  const incDisabled = props.disabled || !props.onInc;

  const pillBg = qty > 0 ? "rgba(34,197,94,0.18)" : "rgba(255,255,255,0.10)";
  const pillBorder = qty > 0 ? "rgba(34,197,94,0.55)" : "rgba(255,255,255,0.18)";
  const textColor = "#fff";

  const btnStyle: React.CSSProperties = {
    width: 28,
    height: 22,
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(0,0,0,0.25)",
    color: textColor,
    fontWeight: 900,
    lineHeight: "20px",
    cursor: "pointer",
    userSelect: "none",
  };

  const btnDisabledStyle: React.CSSProperties = {
    ...btnStyle,
    opacity: 0.35,
    cursor: "default",
  };

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 8px",
        borderRadius: 999,
        border: `1px solid ${pillBorder}`,
        background: pillBg,
        backdropFilter: "blur(6px)",
        color: textColor,
        fontWeight: 800,
        letterSpacing: "0.02em",
      }}
      title="Owned quantity"
    >
      <button
        type="button"
        onClick={
          decDisabled
            ? undefined
            : (e) => {
                e.stopPropagation();
                props.onDec && props.onDec();
              }
        }
        disabled={decDisabled}
        style={decDisabled ? btnDisabledStyle : btnStyle}
        aria-label="Decrease"
      >
        −
      </button>

      <div
        style={{
          minWidth: 28,
          textAlign: "center",
          fontVariantNumeric: "tabular-nums",
          fontSize: 14,
          opacity: 0.98,
        }}
      >
        {qty}
      </div>

      <button
        type="button"
        onClick={
          incDisabled
            ? undefined
            : (e) => {
                e.stopPropagation();
                props.onInc && props.onInc();
              }
        }
        disabled={incDisabled}
        style={incDisabled ? btnDisabledStyle : btnStyle}
        aria-label="Increase"
      >
        +
      </button>
    </div>
  );
}
