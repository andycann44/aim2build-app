import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import PartsTile, { InventoryPart } from "../components/PartsTile";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";

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

const API =
  (import.meta as any)?.env?.VITE_API_BASE || "http://127.0.0.1:8000";

const BuildabilityDetailsPage: React.FC = () => {
  const { setNum: rawSetParam } = useParams<{ setNum: string }>();
  const setNum = decodeURIComponent(rawSetParam || "");
  const navigate = useNavigate();
  const location = useLocation() as any;

  const [meta, setMeta] = useState<SetMeta>({ set_num: setNum });
  const [parts, setParts] = useState<SetPartRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [coverage, setCoverage] = useState<number | null>(null);
  const [totalHave, setTotalHave] = useState<number | null>(null);
  const [totalNeed, setTotalNeed] = useState<number | null>(null);

  // pick up meta from the tile we double-clicked, if present
  useEffect(() => {
    const item = location.state?.item as
      | { set_num: string; name?: string; year?: number; img_url?: string }
      | undefined;

    if (item && item.set_num === setNum) {
      setMeta({
        set_num: item.set_num,
        name: item.name,
        year: item.year,
        img_url: item.img_url,
      });
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
      // 1) Parts the SET needs
      const partsRes = await fetch(
        `${API}/api/catalog/parts?set=${encodeURIComponent(setNum)}`
      );
      if (!partsRes.ok) {
        const msg = await partsRes.text();
        throw new Error(
          `Failed to load set parts: ${msg || partsRes.statusText}`
        );
      }
      const partsData = await partsRes.json();
      const setPartsData: any[] = Array.isArray((partsData as any).parts)
        ? (partsData as any).parts
        : Array.isArray(partsData)
          ? (partsData as any[])
          : [];

      // 2) Your inventory library (with images)
      const invRes = await fetch(`${API}/api/inventory/parts_with_images`);
      if (!invRes.ok) {
        const msg = await invRes.text();
        throw new Error(
          `Failed to load inventory parts: ${msg || invRes.statusText}`
        );
      }
      const inventory: any[] = await invRes.json();

      const invQtyMap = new Map<string, number>();
      const invImgMap = new Map<string, string | undefined>();

      for (const row of inventory) {
        const key = `${row.part_num}|${row.color_id}`;
        invQtyMap.set(
          key,
          Number(row.qty_total ?? row.qty ?? row.quantity ?? 0)
        );
        const rowImg =
          (row as any).img_url ??
          (row as any).part_img_url ??
          (row as any).image ??
          undefined;
        if (rowImg) {
          invImgMap.set(key, String(rowImg));
        }
      }

      // 3) summary from /api/buildability/compare (coverage etc.)
      try {
        const bRes = await fetch(
          `${API}/api/buildability/compare?set=${encodeURIComponent(setNum)}`
        );
        if (bRes.ok) {
          const b = (await bRes.json()) as BuildabilityResultWithDisplay;

          const coverage =
            typeof b.coverage === "number" ? b.coverage : 0;
          const totalHave =
            typeof b.total_have === "number" ? b.total_have : null;

          const displayTotal =
            typeof b.display_total === "number"
              ? b.display_total
              : typeof b.total_needed === "number"
              ? b.total_needed
              : null;

          setCoverage(coverage);
          setTotalHave(totalHave);
          setTotalNeed(displayTotal);
        }
      } catch (err) {
        console.warn("Buildability compare failed in details page", err);
      }

      // 4) Combine set parts + inventory + choose an image
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
          (p as any).part_img_url ??
          (p as any).img_url ??
          (p as any).image ??
          undefined;
        const imgFromInventory = invImgMap.get(key);

        const finalImg =
          (typeof imgFromPart === "string" && imgFromPart.trim().length > 0
            ? imgFromPart
            : undefined) ??
          (typeof imgFromInventory === "string" &&
            imgFromInventory.trim().length > 0
            ? imgFromInventory
            : undefined);

        rows.push({
          part_num: partNum,
          color_id: colorId,
          need,
          have,
          short,
          img_url: finalImg,
        });
      }

      // sort: most missing first
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

  return (
    <div className="page page-buildability-details">
      {/* HERO HEADER – copied from Inventory/My Sets style */}
      <div
        className="search-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          borderRadius: "18px",
          padding: "1.75rem 1.5rem 1.5rem",
          background:
            "linear-gradient(135deg, #0b1120 0%, #1d4ed8 35%, #fbbf24 70%, #dc2626 100%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
          marginTop: "1.5rem",
          marginRight: "2.5rem",
          marginBottom: "1.5rem",
          marginLeft: 0,
        }}
      >
        {/* studs strip */}
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
          {/* back button */}
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              borderRadius: "999px",
              border: "none",
              padding: "0.35rem 0.85rem",
              fontSize: "0.8rem",
              background: "rgba(15,23,42,0.75)",
              color: "#e5e7eb",
              display: "inline-flex",
              alignItems: "center",
              gap: "0.4rem",
              cursor: "pointer",
              marginBottom: "0.9rem",
            }}
          >
            <span style={{ fontSize: "1.05rem", lineHeight: 1 }}>←</span>
            <span>Back to Buildability</span>
          </button>

          <div
            style={{
              display: "flex",
              gap: "1.75rem",
              alignItems: "flex-start",
            }}
          >
            {/* text block */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "0.75rem",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  opacity: 0.85,
                  marginBottom: "0.25rem",
                }}
              >
                Buildability breakdown
              </div>
              <h1
                style={{
                  fontSize: "2rem",
                  fontWeight: 800,
                  marginTop: "0.15rem",
                  marginBottom: "0.15rem",
                }}
              >
                {meta.name || "Set details"}
              </h1>
              <div
                style={{
                  fontSize: "0.95rem",
                  opacity: 0.9,
                  marginBottom: "0.5rem",
                }}
              >
                {meta.set_num}
                {meta.year ? ` • ${meta.year}` : null}
              </div>

              {covPercent !== null &&
                totalNeed !== null &&
                totalHave !== null && (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.75rem",
                      marginTop: "0.35rem",
                      padding: "0.35rem 0.9rem",
                      borderRadius: "999px",
                      background: "rgba(15,23,42,0.5)",
                      border: "1px solid rgba(148,163,184,0.65)",
                      fontSize: "0.85rem",
                    }}
                  >
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "1.15rem",
                        height: "1.15rem",
                        borderRadius: "999px",
                        background:
                          covPercent >= 95
                            ? "#22c55e"
                            : covPercent >= 60
                              ? "#eab308"
                              : "#ef4444",
                      }}
                    />
                    <span>
                      {covPercent}% of parts covered ·{" "}
                      {totalHave.toLocaleString()} of{" "}
                      {totalNeed.toLocaleString()} pieces you own
                    </span>
                  </div>
                )}
            </div>

            {/* set image on the right, if we have one */}
            {meta.img_url && (
              <div
                style={{
                  flex: "0 0 auto",
                  width: "160px",
                  height: "120px",
                  borderRadius: "18px",
                  overflow: "hidden",
                  background: "#020617",
                  boxShadow: "0 14px 30px rgba(15,23,42,0.7)",
                }}
              >
                <img
                  src={meta.img_url}
                  alt={meta.name || meta.set_num}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    display: "block",
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* BODY */}
      <div style={{ padding: "0 1.5rem 2.5rem" }}>
        {error && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              borderRadius: "0.75rem",
              background: "rgba(239,68,68,0.08)",
              border: "1px solid rgba(239,68,68,0.55)",
              color: "#b91c1c",
              fontSize: "0.9rem",
            }}
          >
            {error}
          </div>
        )}

        {loading && (
          <p style={{ fontSize: "0.9rem", opacity: 0.8 }}>Loading parts…</p>
        )}

        {parts.length > 0 && (
          <div
            className="tile-grid"
            style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}
          >
            {parts.map((p) => {
              const inventoryPart: InventoryPart = {
                part_num: p.part_num,
                color_id: p.color_id,
                qty_total: p.have,
                part_img_url: p.img_url,
              };

              return (
                <BuildabilityPartsTile
                  key={`${p.part_num}-${p.color_id}`}
                  part={inventoryPart}
                  need={p.need}
                  have={p.have}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default BuildabilityDetailsPage;
