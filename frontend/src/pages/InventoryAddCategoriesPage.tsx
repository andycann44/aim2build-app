// frontend/src/pages/InventoryAddCategoriesPage.tsx
import { authHeaders } from "../utils/auth";
import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import InventoryCategoryTile, {
  InventoryCategory,
} from "../components/InventoryCategoryTile";

const API = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const InventoryAddCategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const passthrough = location.search || "";

  const [busy, setBusy] = React.useState(false);
  const [msg, setMsg] = React.useState<string>("");

  async function addCanonicalTest() {
    setBusy(true);
    setMsg("");

    try {
      const res = await fetch(`${API}/api/inventory/add-canonical`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ part_num: "3005", color_id: 1, qty: 1 }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMsg(`Error ${res.status}: ${JSON.stringify(data)}`);
        return;
      }

      setMsg(`OK: 3005/1 qty now = ${data.qty ?? "?"}`);
    } catch (e: any) {
      setMsg(`Fetch failed: ${String(e?.message || e)}`);
    } finally {
      setBusy(false);
    }
  }

  const categories: InventoryCategory[] = [
    {
      key: "bricks",
      label: "Bricks",
      description: "Standard bricks (1x1, 2x4, etc.)",
      sampleImgUrl: "https://cdn.rebrickable.com/media/parts/ldraw/21/3001.png",
      onClick: () => navigate(`/inventory/add/bricks?category_id=11${passthrough ? `&${passthrough.replace(/^\?/, "")}` : ""}`),
    },
    {
      key: "plates",
      label: "Plates",
      description: "Thin plates and base pieces.",
      sampleImgUrl: "https://cdn.rebrickable.com/media/parts/ldraw/21/3020.png",
      onClick: () => navigate(`/inventory/add/bricks?category_id=14${passthrough ? `&${passthrough.replace(/^\?/, "")}` : ""}`),
    },
    {
      key: "tiles",
      label: "Tiles & Slopes",
      description: "Smooth tiles and slopes.",
      sampleImgUrl: "https://cdn.rebrickable.com/media/parts/ldraw/1/3068b.png",
      onClick: () => navigate(`/inventory/add/bricks?category_id=19${passthrough ? `&${passthrough.replace(/^\?/, "")}` : ""}`),
    },
    {
      key: "baseplates",
      label: "Baseplates",
      description: "Big flat baseplates.",
      sampleImgUrl: "https://cdn.rebrickable.com/media/sets/ldraw/3811.png",
      onClick: () => navigate(`/inventory/add/bricks?category_id=1${passthrough ? `&${passthrough.replace(/^\?/, "")}` : ""}`),
    },
    {
      key: "minifig",
      label: "Minifig & Accessories",
      description: "Heads, torsos, hats, tools, etc.",
      sampleImgUrl:
        "https://cdn.rebrickable.com/media/parts/ldraw/24/3626cpr0096.png",
      onClick: () => navigate(`/inventory/add/bricks?category_ids=13,27${passthrough ? `&${passthrough.replace(/^\?/, "")}` : ""}`),
    },
    {
      key: "other",
      label: "Other / Everything",
      description: "Anything that doesn’t fit above.",
      sampleImgUrl: "https://cdn.rebrickable.com/media/parts/ldraw/21/3005.png",
      onClick: () => navigate(`/inventory/add/bricks?category_id=22${passthrough ? `&${passthrough.replace(/^\?/, "")}` : ""}`),
    },
  ];

  return (
    <div className="a2b-page a2b-page-inventory-add-categories">
      {/* HERO BAR stays almost exactly as you had it */}
      <div
        className="search-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          marginTop: "1.5rem",
          marginRight: "2.5rem",
          marginBottom: "1.5rem",
          marginLeft: 0,
          borderRadius: "18px",
          padding: "1.75rem 1.5rem 1.5rem",
          background:
            "linear-gradient(135deg, #0b1120 0%, #1d4ed8 35%, #fbbf24 70%, #dc2626 100%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "#fff",
          position: "relative",
          overflow: "visible",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            inset: "0 0 auto 0",
            height: "10px",
            display: "flex",
            gap: "2px",
            padding: "0 8px",
          }}
        >
          {["#dc2626", "#f97316", "#fbbf24", "#22c55e", "#0ea5e9", "#6366f1"].map(
            (c, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  borderRadius: "99px",
                  background: c,
                  opacity: 0.9,
                }}
              />
            )
          )}
        </div>

        <div style={{ position: "relative", zIndex: 1, marginTop: "1.75rem" }}>
          <h1
            style={{
              fontSize: "1.9rem",
              fontWeight: 800,
              letterSpacing: "0.03em",
              margin: 0,
              textShadow: "0 2px 6px rgba(0,0,0,0.45)",
            }}
          >
            Add Bricks to Inventory
          </h1>
          <p
            style={{
              margin: "0.35rem 0 0",
              fontSize: "0.92rem",
              opacity: 0.92,
              maxWidth: "620px",
            }}
          >
            Choose what type of brick you want to add before selecting parts and
            quantities.
          </p>

          {/* Step 1: tiny dev proof button */}
          <div
            style={{
              marginTop: "0.9rem",
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <button
              onClick={addCanonicalTest}
              disabled={busy}
              style={{
                borderRadius: 12,
                padding: "0.55rem 0.9rem",
                border: "1px solid rgba(255,255,255,0.35)",
                background: "rgba(0,0,0,0.25)",
                color: "#fff",
                cursor: busy ? "default" : "pointer",
                fontWeight: 700,
              }}
              title="DEV: Adds 1x part 3005, color 1 via /api/inventory/add-canonical"
            >
              {busy ? "Adding…" : "DEV: Add 1x 3005 (color 1)"}
            </button>

            <span style={{ fontSize: "0.9rem", opacity: 0.95 }}>
              {msg}
            </span>
          </div>
        </div>
      </div>

      {/* category tiles that look like parts tiles */}
      <div
        style={{
          marginRight: "2.5rem",
          marginLeft: 0,
          paddingBottom: "2.5rem",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "1.6rem",
          }}
        >
          {categories.map((cat) => (
            <InventoryCategoryTile key={cat.key} category={cat} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default InventoryAddCategoriesPage;