/// <reference types="vite/client" />
import { API_BASE } from "../api/client";
import React, { useCallback, useEffect, useState } from "react";
import SetTile from "../components/SetTile";
import {
  getMySets,
  SetSummary,
  getBuildability,
  BuildabilityResult,
  // future: reuse common settings if lifted to context
} from "../api/client";
import { authHeaders } from "../utils/auth";
import RequireAuth from "../components/RequireAuth";

// Use server if env not set
const API = API_BASE;

type BuildabilityResultWithDisplay = BuildabilityResult & {
  display_total?: number | null;
};

async function addSetToInventory(setNum: string) {
  const res = await fetch(
    `${API}/api/inventory/add?set=${encodeURIComponent(setNum)}`,
    {
      method: "POST",
      headers: {
        ...authHeaders(),
      },
    }
  );

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(
      msg
        ? `Error adding to inventory: ${res.status} \u2013 ${msg}`
        : `Error adding to inventory: ${res.status}`
    );
  }
}

const MySetsPage: React.FC = () => {
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // which sets are currently "in inventory" (for the green pill)
  const [addedInventory, setAddedInventory] = useState<Set<string>>(
    () => new Set()
  );
  const [effectiveParts, setEffectiveParts] = useState<Record<string, number>>(
    {}
  );
  const [removeAffectsInventory, setRemoveAffectsInventory] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("removeAffectsInventory");
      if (stored === null) return true;
      return stored === "true";
    } catch {
      return true;
    }
  });

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1) load my sets
      const data = await getMySets();
      setSets(data);

      // 2) for each set, ask buildability/compare if it's fully covered
      const inInv = new Set<string>();
      const partsMap: Record<string, number> = {};

      await Promise.all(
        data.map(async (s) => {
          try {
            const cmp = (await getBuildability(
              s.set_num
            )) as BuildabilityResultWithDisplay;

            const cov =
              typeof cmp.coverage === "number" ? cmp.coverage : 0;
            if (cov >= 0.999) {
              inInv.add(s.set_num);
            }

            const totalNeeded =
              typeof cmp.total_needed === "number"
                ? cmp.total_needed
                : typeof cmp.display_total === "number"
                ? cmp.display_total
                : typeof s.num_parts === "number"
                ? s.num_parts
                : 0;
            partsMap[s.set_num] = totalNeeded;
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

  useEffect(() => {
    try {
      localStorage.setItem("removeAffectsInventory", String(removeAffectsInventory));
    } catch {
      // ignore
    }
  }, [removeAffectsInventory]);

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

  const handleRemoveMySetWithToggle = useCallback(
    async (setNum: string, inInventory: boolean) => {
      try {
        // 1) Always remove from My Sets
        const res = await fetch(
          `${API}/api/mysets/remove?set=${encodeURIComponent(setNum)}`,
          {
            method: "DELETE",
            headers: {
              ...authHeaders(),
            },
          }
        );
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          alert(
            msg
              ? `Error removing set: ${res.status} \u2013 ${msg}`
              : `Error removing set: ${res.status}`
          );
          return;
        }

        // 2) Optionally adjust inventory
        if (removeAffectsInventory && inInventory) {
          const invRes = await fetch(
            `${API}/api/inventory/remove_set?set=${encodeURIComponent(setNum)}`,
            {
              method: "POST",
              headers: {
                ...authHeaders(),
              },
            }
          );
          if (!invRes.ok) {
            console.warn("inventory remove_set failed", invRes.status);
          }
        }

        // 3) Refresh local view
        await load();
      } catch (err) {
        console.error(err);
        alert("Failed to remove set, please try again.");
      }
    },
    [load, removeAffectsInventory]
  );

  const handleRemoveFromInventory = useCallback(
    async (setNum: string) => {
      try {
        const res = await fetch(
          `${API}/api/inventory/remove_set?set=${encodeURIComponent(setNum)}`,
          {
            method: "POST",
            headers: {
              ...authHeaders(),
            },
          }
        );
        if (!res.ok) {
          const msg = await res.text().catch(() => "");
          alert(
            msg
              ? `Error removing from inventory: ${res.status} \u2013 ${msg}`
              : `Error removing from inventory: ${res.status}`
          );
          return;
        }
        await load();
      } catch (err) {
        console.error(err);
        alert("Failed to remove parts from inventory. Please try again.");
      }
    },
    [load]
  );

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
                  onRemoveFromInventory={(setNum) =>
                    handleRemoveFromInventory(setNum)
                  }
                  onRemoveMySet={(setNum) =>
                    handleRemoveMySetWithToggle(setNum, inInv)
                  }
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
