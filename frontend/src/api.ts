import type { SetSummary, InventoryPart } from "./api/client";

// Local-first: override with VITE_API_BASE when needed
const API =
  (import.meta as any)?.env?.VITE_API_BASE || "";

function getToken(): string | null {
  try {
    // adjust these keys if your app stores token under a different name
    return (
      localStorage.getItem("a2b_token") ||
      localStorage.getItem("a2b_token") ||
      localStorage.getItem("a2b_token")
    );
  } catch {
    return null;
  }
}

function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${url} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

async function authGetJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { ...authHeaders(), Accept: "application/json" },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`${url} failed: ${res.status} ${body}`.trim());
  }
  return res.json() as Promise<T>;
}

/**
 * Search LEGO sets by name / theme / set number.
 * Backend: GET /api/catalog/search?q=...
 */
export async function searchSets(term: string): Promise<SetSummary[]> {
  const q = term.trim();
  if (!q) return [];

  const url = `${API}/api/catalog/search?q=${encodeURIComponent(q)}`;
  const data = await getJson<unknown>(url);

  if (!Array.isArray(data)) return [];

  return data.map((raw: any): SetSummary => ({
    set_num: String(raw.set_num ?? ""),
    name: raw.name ?? null,
    year: raw.year ?? null,
    num_parts: raw.num_parts ?? null,
    img_url: raw.img_url ?? raw.set_img_url ?? null,
    set_img_url: raw.set_img_url ?? raw.img_url ?? null,
  }));
}

/**
 * My Sets
 * Backend: GET /api/mysets
 */
export async function fetchMySets(): Promise<SetSummary[]> {
  const url = `${API}/api/mysets`;
  const data = await authGetJson<any>(url);

  const sets = Array.isArray(data?.sets) ? data.sets : [];
  return sets.map((raw: any): SetSummary => ({
    set_num: String(raw.set_num ?? ""),
    name: raw.name ?? null,
    year: raw.year ?? null,
    num_parts: raw.num_parts ?? null,
    img_url: raw.img_url ?? raw.set_img_url ?? null,
    set_img_url: raw.set_img_url ?? raw.img_url ?? null,
  }));
}

export async function addToMySets(set_num: string): Promise<void> {
  const res = await fetch(
    `${API}/api/mysets/add?set=${encodeURIComponent(set_num)}`,
    { method: "POST", headers: { ...authHeaders() } }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Add to My Sets failed: ${res.status} ${body}`.trim());
  }
}

export async function removeFromMySets(set_num: string): Promise<void> {
  const res = await fetch(
    `${API}/api/mysets/remove?set=${encodeURIComponent(set_num)}`,
    { method: "DELETE", headers: { ...authHeaders() } }
  );
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Remove from My Sets failed: ${res.status} ${body}`.trim());
  }
}

type CatalogPartRow = {
  part_num: string;
  color_id: number;
  quantity: number;
  is_spare?: number | boolean;
};

/**
 * Add all parts from a given set into the inventory.
 *
 * IMPORTANT (LOCKED RULES):
 * We do NOT call a non-canonical backend mutation like /api/inventory/add?set=...
 * because your backend only allows canonical mutations.
 *
 * Flow:
 *  1) Read set requirements from catalog: GET /api/catalog/parts?set=<set_num>
 *  2) Filter spares if is_spare is present
 *  3) Pour via POST /api/inventory/add-canonical per row
 */
export async function addSetPartsToInventory(set_num: string): Promise<void> {
  const q = set_num.trim();
  if (!q) return;

  // 1) fetch set parts from catalog
  const partsUrl = `${API}/api/catalog/parts?set=${encodeURIComponent(q)}`;
  const raw = await authGetJson<unknown>(partsUrl);

  if (!Array.isArray(raw)) throw new Error("catalog parts returned non-array");

  const parts = (raw as any[]).map((r): CatalogPartRow => ({
    part_num: String(r.part_num ?? ""),
    color_id: Number(r.color_id ?? 0),
    quantity: Number(r.quantity ?? r.qty_per_set ?? 0),
    is_spare: r.is_spare,
  }));

  // 2) exclude spares if the field exists (otherwise assume already excluded)
  const nonSpare = parts.filter((p) => {
    if (p.is_spare === undefined || p.is_spare === null) return true;
    return Number(p.is_spare) === 0;
  });

  // 3) pour via canonical add endpoint
  for (const p of nonSpare) {
    if (!p.part_num) continue;
    if (!Number.isFinite(p.color_id)) continue;
    if (!Number.isFinite(p.quantity) || p.quantity <= 0) continue;

    const res = await fetch(`${API}/api/inventory/add-canonical`, {
      method: "POST",
      headers: {
        ...authHeaders(),
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        part_num: p.part_num,
        color_id: p.color_id,
        qty: p.quantity,
      }),
    });

    if (!res.ok) {
      const msg = await res.text().catch(() => res.statusText);
      throw new Error(
        `add-canonical failed (${p.part_num}/${p.color_id}) ${res.status} ${msg}`.trim()
      );
    }
  }
}

/**
 * Fetch your current brick inventory.
 * Backend: GET /api/inventory/parts
 * Canonical shape:
 *   { part_num, color_id, qty_total, part_img_url }
 * (compat: accept qty/ img_url if still present)
 */
export async function fetchInventoryParts(): Promise<InventoryPart[]> {
  const url = `${API}/api/inventory/parts`;
  const data = await authGetJson<any[]>(url);

  if (!Array.isArray(data)) return [];

  return data.map((raw: any): InventoryPart => ({
    part_num: String(raw.part_num ?? ""),
    color_id: Number(raw.color_id ?? 0),
    qty_total: Number(raw.qty_total ?? raw.qty ?? 0),
    img_url: raw.img_url ?? null,
    part_img_url: raw.part_img_url ?? null,
  }));
}