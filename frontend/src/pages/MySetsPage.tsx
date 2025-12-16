/// <reference types="vite/client" />
import React, { useCallback, useEffect, useMemo, useState } from "react";
import SetTile from "../components/SetTile";
import RequireAuth from "../components/RequireAuth";

import {
  getMySets,
  removeMySet,
  getInventorySets,
  addInventorySetCanonical,
  removeInventorySetCanonical,
  SetSummary,
  getBuildability,
  BuildabilityResult,
} from "../api/client";

type BuildabilityResultWithDisplay = BuildabilityResult & {
  display_total?: number | null;
};

const MySetsPage: React.FC = () => {
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // TRUE meaning: "this set has been poured into inventory" (user_sets marker)
  const [inventorySetIds, setInventorySetIds] = useState<Set<string>>(
    () => new Set()
  );

  // Optional: show better part counts / buildability totals
  const [effectiveParts, setEffectiveParts] = useState<Record<string, number>>(
    {}
  );

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1) My Sets
      const my = await getMySets();
      setSets(my);

      // 2) Inventory markers (user_sets)
      const invSets = await getInventorySets();
      setInventorySetIds(new Set(invSets.map((s) => String(s))));

      // 3) Optional: ask buildability for totals ONLY (not for in_inventory)
      const partsMap: Record<string, number> = {};
      await Promise.all(
        my.map(async (s) => {
          try {
            const cmp = (await getBuildability(
              s.set_num
            )) as BuildabilityResultWithDisplay;

            const totalNeeded =
              typeof cmp.total_needed === "number"
                ? cmp.total_needed
                : typeof cmp.display_total === "number"
                  ? cmp.display_total
                  : typeof s.num_parts === "number"
                    ? s.num_parts
                    : 0;

            partsMap[s.set_num] = totalNeeded;
          } catch {
            // ignore
          }
        })
      );
      setEffectiveParts(partsMap);
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
      if (inventorySetIds.has(setNum)) return;

      try {
        await addInventorySetCanonical(setNum);

  const handleRemoveInventory = useCallback(
    async (setNum: string) => {
      if (!inventorySetIds.has(setNum)) return;
      try {
        await removeInventorySetCanonical(setNum);
        setInventorySetIds((prev) => {
          const next = new Set(prev);
          next.delete(setNum);
          return next;
        });
      } catch (err: any) {
        console.error(err);
        alert(err?.message ?? "Failed to remove from inventory");
      }
    },
    [inventorySetIds]
  );

        setInventorySetIds((prev) => {
          const next = new Set(prev);
          next.add(setNum);
          return next;
        });
      } catch (err: any) {
        console.error(err);
        alert(err?.message ?? "Failed to add to inventory");
      }
    },
    [inventorySetIds]
  );

  const handleRemoveMySet = useCallback(
    async (setNum: string) => {
      try {
        // IMPORTANT: remove from My Sets, not Inventory
        await removeMySet(setNum);

        // Refresh list
        await load();
      } catch (err: any) {
        console.error(err);
        alert(err?.message ?? "Failed to remove set, please try again.");
      }
    },
    [load]
  );

  const heroCopy = useMemo(() => {
    return `Click "Add to Inventory" to pour all parts from a set into your collection.
Removing a set removes it from My Sets (inventory removal is a separate step).`;
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
            whiteSpace: "pre-line",
          }}
        >
          {heroCopy}
        </p>
      </div>

      {/* BODY */}
      <div className="search-results">
        {loading && <p className="search-status">Loading…</p>}
        {error && !loading && <p className="search-error">{error}</p>}

        {!loading && !error && sets.length === 0 && (
          <p className="search-empty">
            You haven&apos;t added any sets yet. Use the Search page and click
            &quot;+ My Sets&quot; on a tile to see it here.
          </p>
        )}

        {sets.length > 0 && (
          <div className="tile-grid">
            {sets.map((s) => {
              const inInv = inventorySetIds.has(s.set_num);
              const numPartsOverride = effectiveParts[s.set_num];

              const setWithOverride = {
                ...s,
                num_parts:
                  typeof numPartsOverride === "number"
                    ? numPartsOverride
                    : s.num_parts,
              };

              return (
                <SetTile
                  key={s.set_num}
                  set={{
                    ...setWithOverride,
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

const MySetsPageWrapper: React.FC = () => (
  <RequireAuth pageName="My Sets">
    <MySetsPage />
  </RequireAuth>
);

export default MySetsPageWrapper;