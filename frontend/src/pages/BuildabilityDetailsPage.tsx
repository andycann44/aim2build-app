import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation, useParams, useNavigate } from "react-router-dom";
import type { SortMode } from "../components/SortMenu";
import { authHeaders } from "../utils/auth";

type SetMeta = {
  set_num: string;
  name?: string;
  year?: number;
  img_url?: string;
};

type SetPartRow = {
  part_num: string;
  color_id: number;
  need: number;
  have: number;
  short: number;
  img_url?: string;
};

const API_BASE: string =
  (import.meta as any)?.env?.VITE_API_BASE || "http://127.0.0.1:8000";

const BuildabilityDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { setNum: rawSetParam } = useParams<{ setNum: string }>();
  const setNum = decodeURIComponent(rawSetParam || "");

  const location = useLocation() as any;

  const [meta, setMeta] = useState<SetMeta>({ set_num: setNum });
  const [parts, setParts] = useState<SetPartRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<number | null>(null);
  const [totalHave, setTotalHave] = useState<number | null>(null);
  const [totalNeed, setTotalNeed] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  // pick up set meta from navigation state (tile → details)
  useEffect(() => {
    const item = location.state?.item as SetMeta | undefined;
    if (item && item.set_num === setNum) {
      setMeta({
        set_num: item.set_num,
        name: item.name,
        year: item.year,
        img_url: item.img_url,
      });
    } else if (setNum) {
      setMeta((prev) => ({ ...prev, set_num: setNum }));
    }
  }, [location.state, setNum]);

  const load = useCallback(async () => {
    if (!setNum) return;

    setLoading(true);
    setError(null);

    type BuildabilityResultWithDisplay = {
      set_num: string;
      coverage?: number;
      total_have?: number;
      total_needed?: number;
      display_total?: number | null;
    };

    try {
      // 1) SET PARTS FROM CATALOG
      const partsRes = await fetch(
        `${API_BASE}/api/catalog/parts?set=${encodeURIComponent(setNum)}`
      );
      if (!partsRes.ok) {
        const msg = await partsRes.text();
        throw new Error(`Failed to load set parts: ${msg}`);
      }

      const partsData = await partsRes.json();
      const setPartsData: any[] = Array.isArray((partsData as any).parts)
        ? (partsData as any).parts
        : Array.isArray(partsData)
        ? (partsData as any[])
        : [];

      // 2) INVENTORY PARTS (WITH IMAGES)
      const invRes = await fetch(
        `${API_BASE}/api/inventory/parts_with_images`,
        {
          headers: { ...authHeaders() },
        }
      );
      if (!invRes.ok) {
        const msg = await invRes.text();
        throw new Error(`Failed to load inventory parts: ${msg}`);
      }
      const inventory = await invRes.json();

      const invQtyMap = new Map<string, number>();
      const invImgMap = new Map<string, string | undefined>();

      for (const row of inventory) {
        const key = `${row.part_num}|${row.color_id}`;
        invQtyMap.set(key, Number(row.qty_total ?? row.qty ?? 0));

        const img =
          row.img_url ?? row.part_img_url ?? row.image ?? undefined;
        if (img) invImgMap.set(key, String(img));
      }

      // 3) BUILDABILITY SUMMARY
      try {
        const bRes = await fetch(
          `${API_BASE}/api/buildability/compare?set=${encodeURIComponent(
            setNum
          )}`,
          {
            headers: { ...authHeaders() },
          }
        );

        if (bRes.ok) {
          const b = (await bRes.json()) as BuildabilityResultWithDisplay;
          const cov = typeof b.coverage === "number" ? b.coverage : 0;
          const have =
            typeof b.total_have === "number" ? b.total_have : null;

          const displayTotal =
            typeof b.display_total === "number"
              ? b.display_total
              : typeof b.total_needed === "number"
              ? b.total_needed
              : null;

          setCoverage(cov);
          setTotalHave(have);
          setTotalNeed(displayTotal);
        }
      } catch (err) {
        console.warn("Buildability compare failed", err);
      }

      // 4) MERGE SET + INVENTORY
      const rows: SetPartRow[] = [];

      for (const p of setPartsData) {
        const partNum = String(p.part_num);
        const colorId = Number(p.color_id);

        const need =
          Number(
            p.quantity ??
              p.qty ??
              p.quantity_total ??
              p.qty_total ??
              0
          ) || 0;

        const key = `${partNum}|${colorId}`;
        const have = invQtyMap.get(key) ?? 0;
        const short = Math.max(need - have, 0);

        const imgFromPart =
          p.part_img_url ?? p.img_url ?? p.image ?? undefined;
        const imgFromInv = invImgMap.get(key);
        const finalImg =
          (imgFromPart && imgFromPart.trim()) ||
          (imgFromInv && imgFromInv.trim()) ||
          undefined;

        rows.push({
          part_num: partNum,
          color_id: colorId,
          need,
          have,
          short,
          img_url: finalImg,
        });
      }

      rows.sort((a, b) => b.short - a.short || b.need - a.need);
      setParts(rows);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to load set breakdown");
    } finally {
      setLoading(false);
    }
  }, [setNum]);

  useEffect(() => {
    void load();
  }, [load]);

  const covPercent =
    coverage !== null ? Math.round((coverage || 0) * 100) : null;

  const sortedParts = useMemo(() => {
    const byPartThenColor = (a: SetPartRow, b: SetPartRow) => {
      const byPart = a.part_num.localeCompare(b.part_num);
      return byPart !== 0 ? byPart : a.color_id - b.color_id;
    };

    const byMissingThenNeed = (a: SetPartRow, b: SetPartRow) => {
      const diff = (b.short ?? 0) - (a.short ?? 0);
      return diff !== 0 ? diff : (b.need ?? 0) - (a.need ?? 0);
    };

    switch (sortMode) {
      case "qty_desc":
        return [...parts].sort((a, b) => (b.have ?? 0) - (a.have ?? 0));
      case "qty_asc":
        return [...parts].sort((a, b) => (a.have ?? 0) - (b.have ?? 0));
      case "color_asc":
        return [...parts].sort((a, b) => {
          if (a.color_id !== b.color_id) return a.color_id - b.color_id;
          return byPartThenColor(a, b);
        });
      default:
        return [...parts].sort(byMissingThenNeed);
    }
  }, [parts, sortMode]);

  return (
    <div className="page buildability-details-page">
      {/* Hero */}
      <div className="page-hero">
        <div className="page-hero-inner">
          <button
            type="button"
            className="pill-button pill-button--secondary"
            onClick={() => navigate("/buildability")}
          >
            ← Back to Buildability
          </button>

          <h1 style={{ marginTop: 16 }}>
            Set {meta.set_num}
            {meta.name ? ` – ${meta.name}` : ""}
          </h1>

          {covPercent !== null && (
            <p style={{ marginTop: 8 }}>
              Coverage:&nbsp;
              <strong>{covPercent}%</strong>
              {typeof totalHave === "number" &&
                typeof totalNeed === "number" &&
                ` (${totalHave}/${totalNeed} parts)`}
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="page-inner">
        {/* Sort & summary row */}
        <div
          className="buildability-details-toolbar"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            marginBottom: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
              View all parts required for this set, matched against your
              inventory.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <label style={{ fontSize: "0.85rem" }}>
              Sort by:&nbsp;
              <select
                value={sortMode}
                onChange={(e) =>
                  setSortMode(e.target.value as SortMode)
                }
              >
                <option value="default">Most missing</option>
                <option value="qty_desc">Quantity (high → low)</option>
                <option value="qty_asc">Quantity (low → high)</option>
                <option value="color_asc">Colour</option>
              </select>
            </label>
          </div>
        </div>

        {/* Error / loading */}
        {error && (
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: "rgba(255,0,0,0.08)",
              color: "#b00020",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        {loading && <div>Loading parts…</div>}

        {/* Parts list */}
        {!loading && !error && (
          <div
            className="buildability-parts-list"
            style={{ display: "grid", gap: 8 }}
          >
            {sortedParts.map((p) => (
              <div
                key={`${p.part_num}-${p.color_id}`}
                className="buildability-part-row"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 8,
                  borderRadius: 8,
                  background: "rgba(0,0,0,0.04)",
                }}
              >
                {p.img_url && (
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      overflow: "hidden",
                      flexShrink: 0,
                      background: "#fff",
                    }}
                  >
                    <img
                      src={p.img_url}
                      alt={`${p.part_num} (${p.color_id})`}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "contain",
                      }}
                    />
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>
                    {p.part_num}{" "}
                    <span style={{ opacity: 0.7 }}>
                      (colour {p.color_id})
                    </span>
                  </div>
                  <div style={{ fontSize: "0.85rem", opacity: 0.85 }}>
                    Need <strong>{p.need}</strong>, have{" "}
                    <strong>{p.have}</strong>, short{" "}
                    <strong>{p.short}</strong>
                  </div>
                </div>
              </div>
            ))}

            {sortedParts.length === 0 && (
              <div>No parts to display for this set.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildabilityDetailsPage;