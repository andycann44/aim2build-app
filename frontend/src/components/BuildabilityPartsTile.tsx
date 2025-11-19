import React from "react";
import PartsTile, { InventoryPart } from "./PartsTile";

type BuildabilityPartsTileProps = {
  part: InventoryPart;
  need: number;
  have: number;
};

const BuildabilityPartsTile: React.FC<BuildabilityPartsTileProps> = ({
  part,
  need,
  have,
}) => {
  const missing = Math.max(need - have, 0);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.35rem",
      }}
    >
      {/* your existing styled card */}
      <PartsTile part={part} />

      {/* tiny line underneath with the buildability numbers */}
      <div
        style={{
          fontSize: "0.78rem",
          textAlign: "center",
          color: "#4b5563",
        }}
      >
        <span>
          Set needs <strong>{need}</strong>
        </span>
        {" · "}
        <span>
          You have <strong>{have}</strong>
        </span>
        {missing > 0 && (
          <>
            {" · "}
            <span style={{ color: "#b91c1c" }}>
              Missing <strong>{missing}</strong>
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default BuildabilityPartsTile;