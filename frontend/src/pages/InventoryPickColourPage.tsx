/// <reference types="vite/client" />
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import RequireAuth from "../components/RequireAuth";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import { API_BASE } from "../api/client";
import { authHeaders } from "../utils/auth";
import NoticeBanner from "../components/NoticeBanner";
import PageHero from "../components/PageHero";

type ElementRow = {
  part_num: string;
  color_id: number;
  color_name?: string | null;
  part_img_url?: string | null;
  img_url?: string | null;
};

type InventoryRow = {
  part_num: string;
  color_id: number;
  qty?: number;
  qty_total?: number;
};

const API = API_BASE;
const key = (p: string, c: number) => `${p}::${c}`;

const extractLockedSets = (err: unknown): string[] => {
  const candidates =
    (err as any)?.locked_sets ??
    (err as any)?.lockedSets ??
    (err as any)?.set_nums ??
    (err as any)?.poured_sets;

  const sets: string[] = Array.isArray(candidates)
    ? candidates.map((s) => String(s)).filter(Boolean)
    : [];

  const msg = (err as any)?.message || "";
  const found = [
    ...msg.matchAll(/(\d{4,6}-\d)\b/g),
    ...msg.matchAll(/(\d{4,6})\b/g),
  ].map((m) => m[1]);

  const all = [...sets, ...found];
  const dedup = Array.from(new Set(all.map((s) => s.trim()).filter(Boolean)));
  return dedup;
};

const formatLockMessage = (sets: string[]) =>
  sets.length
    ? `Remove from My Sets: ${sets.join(", ")}`
    : "Remove the set from My Sets to go lower.";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

async function fetchElementsByPart(part_num: string): Promise<ElementRow[]> {
  const res = await fetch(
    `${API}/api/catalog/elements/by-part?part_num=${encodeURIComponent(part_num)}`,
    { headers: { ...authHeaders() } }
  );
  if (!res.ok) throw new Error(`Failed to load colours (${res.status})`);
  return (await res.json()) as ElementRow[];
}

async function fetchCanonicalInventory(): Promise<InventoryRow[]> {
  const res = await fetch(`${API}/api/inventory/canonical-parts`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) throw new Error(`Failed to load inventory (${res.status})`);
  return (await res.json()) as InventoryRow[];
}

async function postAddCanonical(part_num: string, color_id: number, qty: number) {
  const res = await fetch(`${API}/api/inventory/add-canonical`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ part_num, color_id, qty }),
  });
  if (!res.ok) throw new Error(`Add failed (${res.status})`);
  return await res.json().catch(() => null);
}

async function postDecCanonical(part_num: string, color_id: number, qty: number) {
  const res = await fetch(`${API}/api/inventory/decrement-canonical`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ part_num, color_id, qty }),
  });

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}

  const lockedCandidates = (data?.locked_sets ??
    data?.lockedSets ??
    data?.set_nums ??
    data?.poured_sets) as any;

  const sets = Array.isArray(lockedCandidates)
    ? lockedCandidates.map((s) => String(s))
    : [];

  if (!res.ok || (data && data.blocked)) {
    const msg =
      data?.detail?.message ||
      data?.message ||
      text ||
      `Decrement failed (${res.status})`;
    const err: any = new Error(msg);
    if (sets.length) err.locked_sets = sets;
    throw err;
  }

  return data;
}

const InventoryPickColourInner: React.FC = () => {
  const { partNum } = useParams();
  const navigate = useNavigate();
  const q = useQuery();

  const categoryId = q.get("category_id") || "";
  const backTo =
    categoryId && categoryId.trim()
      ? `/inventory/add/bricks?category_id=${encodeURIComponent(categoryId)}`
      : "/inventory/add/bricks";

  const [elements, setElements] = useState<ElementRow[]>([]);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tileNotice, setTileNotice] = useState<Record<string, string>>({});

  const loadInventory = useCallback(async () => {
    try {
      const rows = await fetchCanonicalInventory();
      const map: Record<string, number> = {};
      (rows || []).forEach((r) => {
        const pn = String(r.part_num);
        const cid = Number(r.color_id);
        const qty =
          typeof r.qty_total === "number"
            ? r.qty_total
            : typeof r.qty === "number"
            ? r.qty
            : 0;
        map[key(pn, cid)] = qty;
      });
      setOwned(map);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load inventory.");
    }
  }, []);

  const loadElements = useCallback(async () => {
    if (!partNum) return;
    setLoading(true);
    setError("");
    try {
      const data = await fetchElementsByPart(partNum);
      setElements(data || []);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load colours.");
      setElements([]);
    } finally {
      setLoading(false);
    }
  }, [partNum]);

  useEffect(() => {
    void loadInventory();
  }, [loadInventory]);

  useEffect(() => {
    void loadElements();
  }, [loadElements]);

  const changeQty = useCallback(
    async (pn: string, cid: number, delta: number) => {
      const k = key(pn, cid);
      const prev = owned[k] ?? 0;
      const optimistic = Math.max(prev + delta, 0);

      setOwned((m) => ({ ...m, [k]: optimistic }));
      setTileNotice((prev2) => {
        const next = { ...prev2 };
        delete next[k];
        return next;
      });

      try {
        if (delta > 0) {
          const resp = await postAddCanonical(pn, cid, delta);
          const serverQty =
            resp && typeof resp.qty === "number"
              ? resp.qty
              : resp && typeof resp.qty_total === "number"
              ? resp.qty_total
              : optimistic;
          setOwned((m) => ({ ...m, [k]: serverQty }));
        } else if (delta < 0) {
          const resp = await postDecCanonical(pn, cid, Math.abs(delta));
          const serverQty =
            resp && typeof resp.qty === "number"
              ? resp.qty
              : resp && typeof resp.qty_total === "number"
              ? resp.qty_total
              : optimistic;
          setOwned((m) => ({ ...m, [k]: serverQty }));
        }
      } catch (e: any) {
        setOwned((m) => ({ ...m, [k]: prev }));

        const msg = e?.message ?? "Locked by poured set floor.";
        const lockedSets = extractLockedSets(e);
        const isLock =
          (typeof msg === "string" && msg.toLowerCase().includes("locked")) ||
          lockedSets.length > 0;

        if (isLock) {
          const text = formatLockMessage(lockedSets);
          setTileNotice((prev2) => ({ ...prev2, [k]: text }));
        } else {
          setError(msg);
        }
      }
    },
    [owned]
  );

  return (
    <div className="a2b-page a2b-page-inventory-pick-colour">
      <PageHero
        title="Pick a colour"
        subtitle={
          <span>
            Part: <strong>{partNum || "—"}</strong>
          </span>
        }
        left={
          <button
            type="button"
            className="a2b-hero-button a2b-cta-dark"
            onClick={() => navigate(backTo)}
          >
            ← Back
          </button>
        }
      />

      {error && (
        <NoticeBanner
          kind="warn"
          title="Inventory locked"
          message={error}
          onClose={() => setError("")}
        />
      )}

      {loading && <div style={{ padding: "0.75rem 1rem" }}>Loading…</div>}

      <div className="parts-grid" style={{ paddingBottom: "2.5rem" }}>
        {elements.map((e) => {
          const pn = String(e.part_num);
          const cid = Number(e.color_id);
          const have = owned[key(pn, cid)] ?? 0;
          const notice = tileNotice[key(pn, cid)];

          return (
            <div
              key={`${pn}-${cid}`}
              style={{ position: "relative", overflow: "visible", borderRadius: 24 }}
            >
              <BuildabilityPartsTile
                part={{
                  part_num: pn,
                  color_id: cid,
                  part_img_url: e.part_img_url ?? e.img_url ?? null,
                }}
                mode="inventory"
                have={have}
                need={0}
                editableQty={true}
                onChangeQty={(delta) => changeQty(pn, cid, delta)}
                showBottomLine={false}
                showInfoButton={true}
                infoText={e.color_name || `${pn} / ${cid}`}
              />

              {notice && (
                <div className="a2b-lockOverlay">
                  <div className="a2b-lockTitleRow">
                    <span aria-hidden="true">🔒</span>
                    <span>Locked</span>
                    <span className="a2b-lockSpark" aria-hidden="true"></span>
                  </div>
                  <div className="a2b-marquee">
                    <div className="a2b-marqueeTrack">
                      <span>{notice}</span>
                      <span>{notice}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!loading && elements.length === 0 && !error && (
          <div style={{ padding: "0.75rem 1rem", opacity: 0.8 }}>
            No colours found for this part.
          </div>
        )}
      </div>
    </div>
  );
};

const InventoryPickColourPage: React.FC = () => (
  <RequireAuth pageName="inventory-pick-colour">
    <InventoryPickColourInner />
  </RequireAuth>
);

export default InventoryPickColourPage;