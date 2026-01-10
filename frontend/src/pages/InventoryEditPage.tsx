import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import RequireAuth from "../components/RequireAuth";
import BuildabilityPartsTile from "../components/BuildabilityPartsTile";
import NoticeBanner from "../components/NoticeBanner";
import PageHero from "../components/PageHero";
import { API_BASE } from "../api/client";
import { authHeaders } from "../utils/auth";

type InventoryRow = {
  part_num: string;
  color_id: number;
  qty?: number;
  qty_total?: number;
  part_img_url?: string | null;
};

const key = (part: string, color: number) => `${part}::${color}`;

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
  const found = [...msg.matchAll(/(\d{4,6}-\d)\b/g), ...msg.matchAll(/(\d{4,6})\b/g)].map(
    (m) => m[1]
  );

  const all = [...sets, ...found];
  const dedup = Array.from(new Set(all.map((s) => s.trim()).filter(Boolean)));
  return dedup;
};

const formatLockMessage = (sets: string[]) =>
  sets.length ? `Remove from My Sets: ${sets.join(", ")}` : "Remove the set from My Sets to go lower.";

async function fetchInventoryWithImages(): Promise<InventoryRow[]> {
  const res = await fetch(`${API_BASE}/api/inventory/parts_with_images`, {
    headers: { ...authHeaders() },
  });

  // ✅ hard redirect on expired/invalid session
  if (res.status === 401) {
    localStorage.removeItem("a2b_token");
    window.location.href = "/login";
    throw new Error("401 Unauthorized");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to load inventory (${res.status})`);
  }

  return res.json();
}

async function postAddCanonical(part_num: string, color_id: number, qty: number) {
  const res = await fetch(`${API_BASE}/api/inventory/add-canonical`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ part_num, color_id, qty }),
  });

  // ✅ hard redirect on expired/invalid session
  if (res.status === 401) {
    localStorage.removeItem("a2b_token");
    window.location.href = "/login";
    throw new Error("401 Unauthorized");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Add failed (${res.status})`);
  }

  return res.json().catch(() => null);
}

async function postDecCanonical(part_num: string, color_id: number, qty: number) {
  const res = await fetch(`${API_BASE}/api/inventory/decrement-canonical`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ part_num, color_id, qty }),
  });

  // ✅ hard redirect on expired/invalid session
  if (res.status === 401) {
    localStorage.removeItem("a2b_token");
    window.location.href = "/login";
    throw new Error("401 Unauthorized");
  }

  const text = await res.text().catch(() => "");
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  const lockedCandidates =
    (data?.locked_sets ?? data?.lockedSets ?? data?.set_nums ?? data?.poured_sets) as any;
  const sets = Array.isArray(lockedCandidates) ? lockedCandidates.map((s) => String(s)) : [];

  if (!res.ok) {
    const msg =
      data?.detail?.message ||
      data?.detail?.message?.toString?.() ||
      data?.detail?.toString?.() ||
      data?.message ||
      text ||
      `Decrement failed (${res.status})`;
    const err: any = new Error(msg);
    if (sets.length) err.locked_sets = sets;
    throw err;
  }

  if (data && data.blocked) {
    const msg =
      typeof data.message === "string" && data.message.trim()
        ? data.message
        : "Locked by poured set. Unpour to remove.";
    const err: any = new Error(msg);
    if (sets.length) err.locked_sets = sets;
    throw err;
  }

  return data;
}

const InventoryEditInner: React.FC = () => {
  const navigate = useNavigate();

  const [rows, setRows] = useState<InventoryRow[]>([]);
  const [owned, setOwned] = useState<Record<string, number>>({});
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [tileNotice, setTileNotice] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchInventoryWithImages();
      const map: Record<string, number> = {};
      (data || []).forEach((r: any) => {
        const pn = String(r.part_num ?? "").trim();
        const cid = Number(r.color_id ?? 0);
        const qty = Number(r.qty_total ?? r.qty ?? 0);
        if (!pn) return;
        map[key(pn, cid)] = qty;
      });
      setRows(Array.isArray(data) ? data : []);
      setOwned(map);
    } catch (e: any) {
      setRows([]);
      setOwned({});
      setError(e?.message || "Failed to load inventory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = term.trim().toLowerCase();
    const base = rows.slice().sort((a, b) => {
      const ap = String(a.part_num || "");
      const bp = String(b.part_num || "");
      if (ap !== bp) return ap.localeCompare(bp);
      return Number(a.color_id ?? 0) - Number(b.color_id ?? 0);
    });

    if (!q) return base;

    return base.filter((r) => {
      const pn = String(r.part_num || "").toLowerCase();
      const cid = String(r.color_id ?? "");
      return pn.includes(q) || cid.includes(q);
    });
  }, [rows, term]);

  const changeQty = useCallback(
    async (part_num: string, color_id: number, delta: number) => {
      const k = key(part_num, color_id);
      const prev = owned[k] ?? 0;
      const optimistic = Math.max(prev + delta, 0);
      setOwned((m) => ({ ...m, [k]: optimistic }));
      setTileNotice((prev) => {
        const next = { ...prev };
        delete next[k];
        return next;
      });

      try {
        if (delta > 0) {
          const resp = await postAddCanonical(part_num, color_id, delta);
          const serverQty =
            resp && typeof resp.qty === "number"
              ? resp.qty
              : resp && typeof resp.qty_total === "number"
                ? resp.qty_total
                : optimistic;

          setOwned((m) => ({ ...m, [k]: serverQty }));
        } else if (delta < 0) {
          const resp = await postDecCanonical(part_num, color_id, Math.abs(delta));
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
        const msg = e?.message || "Failed to update inventory.";
        const lockedSets = extractLockedSets(e);
        const isLock =
          typeof msg === "string" && msg.toLowerCase().includes("locked") || lockedSets.length > 0;
        if (isLock) {
          const text = formatLockMessage(lockedSets);
          setTileNotice((prev) => ({ ...prev, [k]: text }));
        } else {
          setError(msg);
        }
      }
    },
    [owned]
  );

  return (
    <div className="a2b-page a2b-page-inventory-edit">
      <PageHero
        title="Edit Inventory"
        subtitle="Adjust quantities. If a part is locked by a poured set, you can’t go below the poured amount."
        left={
          <button
            type="button"
            className="a2b-hero-button a2b-cta-dark"
            onClick={() => navigate("/inventory")}
          >
            ← Back to Inventory
          </button>
        }
        right={
          <button
            type="button"
            className="a2b-hero-button a2b-cta-green"
            onClick={() => void load()}
            title="Refresh inventory"
          >
            Refresh
          </button>
        }
      >
        <div style={{ maxWidth: 720 }}>
          <input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Filter by part_num (e.g. 3004) or color_id (e.g. 0)"
            style={{
              width: "100%",
              borderRadius: 14,
              padding: "0.8rem 1rem",
              border: "1px solid rgba(255,255,255,0.35)",
              outline: "none",
              fontSize: "1rem",
            }}
          />
        </div>

        {error ? (
          <NoticeBanner
            kind="warn"
            title="Inventory locked"
            message={error}
            onClose={() => setError("")}
          />
        ) : null}
      </PageHero>

      {loading ? <div style={{ padding: "0.75rem" }}>Loading…</div> : null}

      {/* INVENTORY TILE GRID (colour-specific) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "1.1rem",
          paddingBottom: "2.5rem",
        }}
      >
        {filtered.map((r) => {
          const pn = String(r.part_num || "");
          const cid = Number(r.color_id ?? 0);
          const have = owned[key(pn, cid)] ?? Number(r.qty_total ?? r.qty ?? 0);
          const notice = tileNotice[key(pn, cid)];

          return (
            <div
              key={`${pn}-${cid}`}
              style={{
                position: "relative",
                overflow: "visible",
                borderRadius: 24,
              }}
            >
              <BuildabilityPartsTile
                part={{
                  part_num: pn,
                  color_id: cid,
                  part_img_url: r.part_img_url ?? null,
                }}
                mode="inventory"
                have={have}
                need={0}
                editableQty={true}
                onChangeQty={(delta) => changeQty(pn, cid, delta)}
                showBottomLine={false}
                showInfoButton={true}
                infoText={`${pn} • color ${cid}`}
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
      </div>
    </div>
  );
};

const InventoryEditPage: React.FC = () => (
  <RequireAuth pageName="inventory-edit">
    <InventoryEditInner />
  </RequireAuth>
);

export default InventoryEditPage;
