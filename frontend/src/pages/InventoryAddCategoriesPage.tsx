// frontend/src/pages/InventoryAddCategoriesPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import InventoryCategoryTile, { InventoryCategory } from "../components/InventoryCategoryTile";
import { authHeaders } from "../utils/auth";

import { API_BASE } from "../api/client";
import PageHero from "../components/PageHero";

const API = API_BASE;

type BrickCategory = {
  key: string;
  label: string;
  sort_order?: number | null;
  img_url?: string | null;
  part_cat_id: number | null;
};

const InventoryAddCategoriesPage: React.FC = () => {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API}/api/catalog/categories/parents`, {
          headers: {
            ...authHeaders(),
          },
        });
        if (res.status === 401) {
          localStorage.removeItem("a2b_token");
          window.location.href = "/account?mode=login&reason=expired";
          return;
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as BrickCategory[];

        const tiles = (data || []).map((row: any) => ({
          key: String(row.key),
          label: String(row.label ?? row.key),
          sampleImgUrl: row.img_url ?? null,
          onClick: () =>
            navigate(
              `/inventory/add/bricks?parent_key=${encodeURIComponent(String(row.key))}&cat=${encodeURIComponent(String(row.key))}`
            ),
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
  }, [navigate]);

  return (
    <div className="a2b-page a2b-page-inventory-add-categories">
      <PageHero
        title="Add Bricks to Inventory"
        subtitle="Choose what type of brick you want to add before selecting parts and quantities."
      />

      <div style={{ marginLeft: 0, paddingBottom: "2.5rem" }}>
        {error && <p style={{ color: "#dc2626", marginBottom: "1rem" }}>{error}</p>}
        {loading && <p style={{ marginBottom: "1rem" }}>Loading categories…</p>}

        {/* Horizontal category conveyor */}
        <div className="a2b-conveyor a2b-conveyor--tight" aria-label="Brick categories">
          <div className="a2b-conveyor-track a2b-filter-track">
            {categories.map((cat) => (
              <InventoryCategoryTile key={cat.key} category={cat} />
            ))}
          </div>
        </div>

        <div className="a2b-cat-placeholder">Select a category above to continue</div>
      </div>
    </div>
  );
};

export default InventoryAddCategoriesPage;
