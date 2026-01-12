import React from "react";

type Props = {
  setNum: string;
  imgUrl?: string | null;
  className?: string;
};

const FRAME_SRC = "/branding/instructions_frame.png";

// Convert e.g. 21330-1 -> 21330 for LEGO instructions search
function normalizeSetForLegoSearch(setNum: string) {
  return (setNum || "").trim().replace(/-\d+$/, "");
}

// LEGO building instructions search (UK)
function legoInstructionsUrl(setNum: string) {
  const q = normalizeSetForLegoSearch(setNum);
  return `https://www.lego.com/en-gb/service/buildinginstructions/search?q=${encodeURIComponent(
    q
  )}`;
}

const InstructionsTile: React.FC<Props> = ({ setNum, imgUrl, className }) => {
  const safeSetNum = (setNum || "").trim();
  const href = safeSetNum ? legoInstructionsUrl(safeSetNum) : "#";

  const Wrapper: any = safeSetNum ? "a" : "div";
  const wrapperProps = safeSetNum
    ? {
      href,
      target: "_blank",
      rel: "noopener noreferrer",
      "aria-label": "Open LEGO building instructions",
    }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      className={`instructionsTile ${className || ""}`.trim()}
      style={{
        position: "relative",
        display: "inline-block",
        width: "100%",
        height: "100%",
        textDecoration: "none",
        background: "transparent",
        border: 0,
        padding: 0,
        margin: 0,
        cursor: safeSetNum ? "pointer" : "default",
      }}
    >
      {/* White inner window + optional set image, This is set for the new inset values Do Not Change */}
      <div
        className="instructionsTile__window"
        style={{
          position: "absolute",
          inset: "15% 27% 18% 27%",
          background: "#fff",
          borderRadius: 8,
          zIndex: 1,
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", top: 4, left: 4, fontSize: 10, color: "#111" }}>
          {imgUrl ? "HAS IMG" : "NO IMG"}
        </div>

        {imgUrl ? (
          <img
            src={imgUrl}
            alt=""
            aria-hidden="true"
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              objectFit: "contain",
              background: "#fff",
            }}
          />
        ) : null}
      </div>

      {/* Frame overlay on top (must not steal clicks) */}
      <img
        src={FRAME_SRC}
        alt=""
        aria-hidden="true"
        style={{
          display: "block",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          position: "relative",
          zIndex: 2,
          pointerEvents: "none",
        }}
      />
    </Wrapper>
  );
};

export default InstructionsTile;
