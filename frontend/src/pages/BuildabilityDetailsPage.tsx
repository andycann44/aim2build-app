import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
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

// 🔥 FIXED API DEFAULT – server first, can be overridden by VITE_API_BASE
const API =
  (import.meta as any)?.env?.VITE_API_BASE || "http://35.178.138.33:8000";

const BuildabilityDetailsPage: React.FC = () => {
  const { setNum: rawSetParam } = useParams<{ setNum: string }>();
  const setNum = decodeURIComponent(rawSetParam || "");
  const location = useLocation() as { state?: { item?: SetMeta } };

  const [meta, setMeta] = useState<SetMeta>({ set_num: setNum });
  const [parts, setParts] = useState<SetPartRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<number | null>(null);
  const [totalHave, setTotalHave] = useState<number | null>(null);
  const [totalNeed, setTotalNeed] = useState<number | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("default");

  // pick up meta from the tile we double-clicked, if it was passed via route state
  useEffect(() => {
    const item = location.state?.item;
    if (item && item.set_num) {
      setMeta({
        set_num: item.set_num,
        name: item.name,
        year: item.year,
        img_url: item.img_url,
      });
    } else if (setNum) {
      // make sure set_num at least matches the URL
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
      // 1) SET PARTS
      const partsRes = await fetch(
        `${API}/api/catalog/parts?set=${encodeURIComponent(setNum)}`
      );
      if (!partsRes.ok) {
        const msg = await partsRes.text();
        throw new Error(`Failed to load set parts: ${msg || partsRes.statusText}`);
      }
      const partsData = await partsRes.json();
      const setPartsData: any[] = Array.isArray((partsData as any).parts)
        ? (partsData as any).parts
        : Array.isArray(partsData)
        ? (partsData as any[])
        : [];

      // 2) INVENTORY PARTS
      const invRes = await fetch(`${API}/api/inventory/parts_with_images`, {
        headers: { ...authHeaders() },
      });
      if (!invRes.ok) {
        const msg = await invRes.text();
        throw new Error(
          `Failed to load inventory parts: ${msg || invRes.statusText}`
        );
      }
      const inventory = await invRes.json();

      const invQtyMap = new Map<string, number>();
      const invImgMap = new Map<string, string | undefined>();

      for (const row of inventory as any[]) {
        const key = `${row.part_num}|${row.color_id}`;
        invQtyMap.set(key, Number(row.qty_total ?? row.qty ?? 0));
        const img =
          row.img_url ?? row.part_img_url ?? row.image ?? undefined;
        if (img) invImgMap.set(key, String(img));
      }

      // 3) BUILDABILITY SUMMARY
      try {
        const bRes = await fetch(
          `${API}/api/buildability/compare?set=${encodeURIComponent(setNum)}`,
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

        if (!partNum || Number.isNaN(colorId) || need <= 0) continue;

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

      // most missing first
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
    <div style={{ padding: 16 }}>
      <h1>Set {meta.set_num || "Unknown Set"}</h1>

      {meta.name && (
        <h2>
          {meta.name}
          {meta.year ? ` (${meta.year})` : ""}
        </h2>
      )}

      {covPercent !== null && (
        <p>
          Coverage: {covPercent}%
          {typeof totalHave === "number" &&
          typeof totalNeed === "number"
            ? ` (${totalHave}/${totalNeed})`
            : ""}
        </p>
      )}

      {error && (
        <div style={{ color: "red", marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading ? (
        <div>Loading…</div>
      ) : (
        <ul style={{ listStyle: "none", padding: 0 }}>
          {sortedParts.map((p) => (
            <li key={`${p.part_num}-${p.color_id}`} style={{ marginBottom: 8 }}>
              <div>
                <strong>{p.part_num}</strong> (color {p.color_id}) — need{" "}
                {p.need}, have {p.have}, short {p.short}
              </div>
              {p.img_url && (
                <img
                  alt={`${p.part_num} (${p.color_id})`}
                  src={p.img_url}
                  style={{ maxHeight: 50, marginTop: 4 }}
                />
              )}
            </li>
          ))}
          {sortedParts.length === 0 && <li>No parts to display.</li>}
        </ul>
      )}
    </div>
  );
};

export default BuildabilityDetailsPage;