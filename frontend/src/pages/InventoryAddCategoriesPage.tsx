// frontend/src/pages/InventoryAddCategoriesPage.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import InventoryCategoryTile, {
  InventoryCategory,
} from "../components/InventoryCategoryTile";
import { authHeaders } from "../utils/auth";

import { API_BASE } from "../api/client";
import PageHero from "../components/PageHero";

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
        const url = `/api/catalog/part-categories/top`;
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
      <PageHero
        title="Add Bricks to Inventory"
        subtitle="Choose what type of brick you want to add before selecting parts and quantities."
      />

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
