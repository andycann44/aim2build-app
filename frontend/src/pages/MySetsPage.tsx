import React, { useCallback, useEffect, useState } from "react";
import SetTile from "../components/SetTile";
import { getMySets, SetSummary } from "../api/client";

const API =
  (import.meta as any)?.env?.VITE_API_BASE || "http://127.0.0.1:8000";

async function addSetToInventory(setNum: string) {
  console.log("Adding set to inventory:", setNum);

  // 1) Get all parts for this set
  const partsRes = await fetch(
    `${API}/api/catalog/parts?set=${encodeURIComponent(setNum)}`
  );

  if (!partsRes.ok) {
    const msg = await partsRes.text();
    throw new Error(
      `Failed to load set parts: ${msg || partsRes.statusText}`
    );
  }

  const data = await partsRes.json();
  console.log("catalog/parts response (add):", data);

  const parts: any[] = Array.isArray((data as any).parts)
    ? (data as any).parts
    : [];

  if (!parts.length) {
    throw new Error("No parts returned from /api/catalog/parts");
  }

  // 2) Add each part into inventory using qty_total / quantity
  for (const part of parts) {
    const partNum = part.part_num;
    const colorId = part.color_id;
    const qty =
      part.quantity ??
      part.qty ??
      part.quantity_total ??
      part.qty_total ??
      0;

    if (!partNum || colorId === undefined || !qty) {
      console.warn("Skipping malformed part row (add)", part);
      continue;
    }

    const addRes = await fetch(`${API}/api/inventory/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        part_num: partNum,
        color_id: Number(colorId),
        qty_total: Number(qty),
      }),
    });

    if (!addRes.ok) {
      const msg = await addRes.text();
      throw new Error(
        `Failed to add part ${partNum}/${colorId}: ${
          msg || addRes.statusText
        }`
      );
    }
  }

  console.log("Finished adding set to inventory:", setNum);
}

async function removeSetFromInventory(setNum: string) {
  console.log("Removing set contribution from inventory:", setNum);

  // 1) Get all parts for this set (same as add)
  const partsRes = await fetch(
    `${API}/api/catalog/parts?set=${encodeURIComponent(setNum)}`
  );

  if (!partsRes.ok) {
    const msg = await partsRes.text();
    throw new Error(
      `Failed to load set parts for removal: ${
        msg || partsRes.statusText
      }`
    );
  }

  const data = await partsRes.json();
  console.log("catalog/parts response (remove):", data);

  const parts: any[] = Array.isArray((data as any).parts)
    ? (data as any).parts
    : [];

  if (!parts.length) {
    throw new Error("No parts returned from /api/catalog/parts for removal");
  }

  // 2) Decrement each part from inventory.
  // Backend is responsible for "no negative qty, auto-remove zeros".
  for (const part of parts) {
    const partNum = part.part_num;
    const colorId = part.color_id;
    const qty =
      part.quantity ??
      part.qty ??
      part.quantity_total ??
      part.qty_total ??
      0;

    if (!partNum || colorId === undefined || !qty) {
      console.warn("Skipping malformed part row (remove)", part);
      continue;
    }

    const decRes = await fetch(`${API}/api/inventory/decrement`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        part_num: partNum,
        color_id: Number(colorId),
        qty: Number(qty),
      }),
    });

    if (!decRes.ok) {
      const msg = await decRes.text();
      throw new Error(
        `Failed to decrement part ${partNum}/${colorId}: ${
          msg || decRes.statusText
        }`
      );
    }
  }

  console.log("Finished removing set contribution from inventory:", setNum);
}

const MySetsPage: React.FC = () => {
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // which sets are currently "in inventory" (for the green pill)
  const [addedInventory, setAddedInventory] = useState<Set<string>>(
    () => new Set()
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1) load my sets
      const data = await getMySets();
      setSets(data);

      // 2) for each set, ask buildability/compare if it's fully covered
      const inInv = new Set<string>();

      await Promise.all(
        data.map(async (s) => {
          try {
            const res = await fetch(
              `${API}/api/buildability/compare?set=${encodeURIComponent(
                s.set_num
              )}`
            );
            if (!res.ok) {
              return;
            }
            const cmp = (await res.json()) as any;
            const cov =
              typeof cmp.coverage === "number" ? cmp.coverage : 0;
            if (cov >= 0.999) {
              inInv.add(s.set_num);
            }
          } catch (err) {
            console.warn(
              "Failed to check buildability for set",
              s.set_num,
              err
            );
          }
        })
      );

      setAddedInventory(inInv);
    } catch (err: any) {
      console.error(err);
      setError(err?.message ?? "Failed to load My Sets");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleAddInventory = useCallback(
    async (setNum: string) => {
      // if we already think it's in inventory, don't double-pour
      if (addedInventory.has(setNum)) {
        return;
      }

      try {
        await addSetToInventory(setNum);

        // mark as in inventory locally so pill goes green
        setAddedInventory((prev) => {
          const next = new Set(prev);
          next.add(setNum);
          return next;
        });
      } catch (err: any) {
        console.error(err);
        alert(err?.message ?? "Failed to add to inventory");
      }
    },
    [addedInventory]
  );

  const handleRemoveMySet = useCallback(async (setNum: string) => {
    try {
      // 1) best-effort: remove this set's contribution from inventory
      await removeSetFromInventory(setNum);

      // 2) remove from My Sets list
      const res = await fetch(
        `${API}/api/mysets/remove?set=${encodeURIComponent(setNum)}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(
          `Failed to remove set: ${msg || res.statusText}`
        );
      }

      setSets((prev) => prev.filter((s) => s.set_num !== setNum));

      // 3) clear inventory flag for this view
      setAddedInventory((prev) => {
        const next = new Set(prev);
        next.delete(setNum);
        return next;
      });
    } catch (err: any) {
      console.error(err);
      alert(err?.message ?? "Failed to remove set / inventory");
    }
  }, []);

  return (
    <div className="page page-mysets">
      {/* HERO HEADER – styling unchanged */}
      <div
        className="sets-hero"
        style={{
          width: "100%",
          maxWidth: "100%",
          boxSizing: "border-box",
          marginTop: "1.5rem",
          marginRight: "2.5rem",
          marginBottom: "1.5rem",
          marginLeft: "0",
          borderRadius: "18px",
          padding: "1.75rem 1.5rem 1.5rem",
          background:
            "linear-gradient(135deg, #0b1120 0%, #1d4ed8 35%, #fbbf24 70%, #dc2626 100%)",
          boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
          color: "#fff",
          position: "relative",
          overflow: "hidden",
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
          {[
            "#dc2626",
            "#f97316",
            "#fbbf24",
            "#22c55e",
            "#0ea5e9",
            "#6366f1",
          ].map((c, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                borderRadius: "99px",
                background: c,
                opacity: 0.9,
              }}
            />
          ))}
        </div>

        <h1
          style={{
            fontSize: "2.1rem",
            fontWeight: 800,
            marginTop: "1.2rem",
          }}
        >
          My Sets
        </h1>
        <p
          style={{
            opacity: 0.95,
            marginTop: "0.5rem",
            fontSize: "1rem",
          }}
        >
          Click &quot;Add to Inventory&quot; to pour all parts from a set
          into your collection. Removing a set will try to take those
          bricks back out again.
        </p>
      </div>

      {/* BODY */}
      <div className="search-results">
        {loading && <p className="search-status">Loading…</p>}
        {error && !loading && <p className="search-error">{error}</p>}

        {!loading && !error && sets.length === 0 && (
          <p className="search-empty">
            You haven&apos;t added any sets yet. Use the Search page and
            click &quot;+ My Sets&quot; on a tile to see it here.
          </p>
        )}

        {sets.length > 0 && (
          <div className="tile-grid">
            {sets.map((s) => {
              const inInv = addedInventory.has(s.set_num);
              return (
                <SetTile
                  key={s.set_num}
                  set={{
                    ...s,
                    in_inventory: inInv,
                  }}
                  inMySets={true}
                  onAddInventory={inInv ? undefined : handleAddInventory}
                  onRemoveMySet={handleRemoveMySet}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MySetsPage;