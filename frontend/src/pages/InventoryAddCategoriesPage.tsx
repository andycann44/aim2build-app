// frontend/src/pages/InventoryAddCategoriesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import InventoryCategoryTile, {
  InventoryCategory,
} from "../components/InventoryCategoryTile";
import { authHeaders } from "../utils/auth";

import { API_BASE } from "../api/client";

const API = API_BASE;

type PartCategory = {
  part_cat_id: number;
  name: string;
  parent_id: number | null;
  sample_img_url?: string | null;
};

const InventoryAddCategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const qs = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholderImg =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const url = new URL(`${API}/api/catalog/part-categories/top`);
        const res = await fetch(url.toString(), {
          headers: {
            ...authHeaders(),
          },
        });
        if (res.status === 401) {
          localStorage.removeItem("a2b_token");
          window.location.href = "/login";
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as PartCategory[];

        const tiles: InventoryCategory[] = data.map((row) => ({
          key: String(row.part_cat_id),
          label: row.name,
          sampleImgUrl: row.sample_img_url || placeholderImg,
          onClick: () => {
            const params = new URLSearchParams(location.search);
            params.delete("parent_id");
            params.set("category_id", String(row.part_cat_id));
            navigate(`/inventory/add/bricks?${params.toString()}`);
          },
        }));
        setCategories(tiles);
      } catch (err: any) {
        console.error(err);
        setError(err?.message ?? "Failed to load categories.");
        setCategories([]);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [location.search, navigate]);

  return (
    <div className="a2b-page a2b-page-inventory-add-categories">
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

        </div>
      </div>

      <div
        style={{
          marginRight: "2.5rem",
          marginLeft: 0,
          paddingBottom: "2.5rem",
        }}
      >
        {error && (
          <p style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</p>
        )}
        {loading && <p style={{ marginBottom: "1rem" }}>Loading categories…</p>}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
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
