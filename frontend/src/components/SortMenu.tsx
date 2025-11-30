import React, { useMemo, useState } from "react";

export type SortMode = "default" | "qty_desc" | "qty_asc" | "color_asc";

type SortMenuProps = {
  sortMode: SortMode;
  onChange: (mode: SortMode) => void;
};

const OPTIONS: { id: SortMode; label: string }[] = [
  { id: "default", label: "Default" },
  { id: "qty_desc", label: "Quantity (high → low)" },
  { id: "qty_asc", label: "Quantity (low → high)" },
  { id: "color_asc", label: "Colour (ascending)" },
];

const SortMenu: React.FC<SortMenuProps> = ({ sortMode, onChange }) => {
  const [open, setOpen] = useState(false);

  const activeLabel = useMemo(() => {
    const match = OPTIONS.find((o) => o.id === sortMode);
    return match ? match.label : "Default";
  }, [sortMode]);

  const handleSelect = (mode: SortMode) => {
    onChange(mode);
    setOpen(false);
  };

  return (
    <div className="hero-sort">
      <button
        type="button"
        className="hero-pill hero-pill--sort"
        onClick={() => setOpen((v) => !v)}
      >
        Sort: <span className="hero-pill__value">{activeLabel}</span>
      </button>

      {open && (
        <div className="hero-sort-menu">
          {OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              className={
                "hero-sort-option" + (opt.id === sortMode ? " hero-sort-option--active" : "")
              }
              onClick={() => handleSelect(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default SortMenu;