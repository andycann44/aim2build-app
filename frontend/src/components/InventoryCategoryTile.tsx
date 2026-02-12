// frontend/src/components/InventoryCategoryTile.tsx
import React from "react";
export type InventoryCategory = {
  key: string;
  label: string;
  description?: string;
  sampleImgUrl?: string | null;
  onClick: () => void;
};

const InventoryCategoryTile: React.FC<{ category: InventoryCategory }> = ({
  category,
}) => {
  return (
    <button
      type="button"
      className="a2b-filter-tile"
      onClick={category.onClick}
      aria-label={category.label}
      title={category.label}
    >
      <div className="a2b-filter-tile-inner">
        <div className="a2b-filter-img">
          {category.sampleImgUrl ? (
            <img src={category.sampleImgUrl} alt={category.label} loading="lazy" decoding="async" />
          ) : (
            <div className="a2b-filter-placeholder" />
          )}
        </div>
        <span className="a2b-filter-label">{category.label}</span>
      </div>
    </button>
  );
};

export default InventoryCategoryTile;
