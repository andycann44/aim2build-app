import React, { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SetTile from "../components/SetTile";
import {
  API_BASE,
  getMySets,
  SetSummary,
  getBuildability,
  BuildabilityResult,
  getPouredSets,
  pourSet,
  unpourSet,
} from "../api/client";
import { authHeaders } from "../utils/auth";
import RequireAuth from "../components/RequireAuth";
import PageHero from "../components/PageHero";

const API = API_BASE;

type BuildabilityResultWithDisplay = BuildabilityResult & {
  display_total?: number | null;
};

const MySetsPage: React.FC = () => {
  const nav = useNavigate();
  const loc = useLocation();
  const fromDiscover = new URLSearchParams(loc.search).get("from") === "discover";

  const [sets, setSets] = useState<SetSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Green pill = poured sets from backend
  const [pouredSets, setPouredSets] = useState<Set<string>>(() => new Set());

  const [effectiveParts, setEffectiveParts] = useState<Record<string, number>>(
    {}
  );

  const refreshPouredSets = useCallback(async () => {
    try {
      const poured = await getPouredSets();
      setPouredSets(new Set(poured));
    } catch (err) {
      console.warn("Failed to refresh poured sets", err);
    }
  }, []);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // 1) load my sets + poured sets
      const [data, poured] = await Promise.all([getMySets(), getPouredSets()]);
      setSets(data);
      setPouredSets(new Set(poured));

      // 2) compute "parts needed" for display only
      const partsMap: Record<string, number> = {};
      await Promise.all(
        data.map(async (s) => {
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
          } catch (err) {
            console.warn(
              "Failed to check buildability for set",
              s.set_num,
              err
            );
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
      try {
        await pourSet(setNum);
        await refreshPouredSets();
      } catch (err: any) {
        console.error(err);
        alert(err?.message ?? "Failed to add to inventory");
      }
    },
    [refreshPouredSets]
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
              ? `Error removing set: ${res.status} – ${msg}`
              : `Error removing set: ${res.status}`
          );
          return;
        }

        // 2) If poured, unpour it
        if (inInventory) {
          await unpourSet(setNum);
        }

        // 3) Refresh
        await load();
      } catch (err) {
        console.error(err);
        alert("Failed to remove set, please try again.");
      }
    },
    [load]
  );

  const handleRemoveFromInventory = useCallback(
    async (setNum: string) => {
      try {
        await unpourSet(setNum);
        await refreshPouredSets();
      } catch (err: any) {
        console.error(err);
        alert(err?.message ?? "Failed to remove from inventory");
      }
    },
    [refreshPouredSets]
  );

  return (
    <div className="page page-mysets">
      <PageHero
        title="My Sets"
        subtitle='Click "Add to Inventory" to pour all buildable parts (non-spares) from a set into your collection.'
        left={
          fromDiscover ? (
            <button
              type="button"
              onClick={() => nav("/buildability/discover")}
              className="a2b-hero-button a2b-cta-dark"
            >
              Back to Discover
            </button>
          ) : null
        }
      />

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
              const inInv = pouredSets.has(s.set_num);
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
                  onAddInventory={
                    inInv
                      ? undefined
                      : (setNum) => {
                          handleAddInventory(setNum);
                        }
                  }
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