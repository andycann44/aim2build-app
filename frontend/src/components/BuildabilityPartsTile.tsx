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

      <div
        style={{
          marginTop: "0.35rem",
          fontSize: "0.8rem",
          color: "#e5e7eb",
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
            <span style={{ color: "#f97316" }}>
              Missing <strong>{missing}</strong>
            </span>
          </>
        )}
      </div>
    </div>
  );
};

export default BuildabilityPartsTile;
