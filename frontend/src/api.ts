import type { SetSummary, InventoryPart } from "./types";

const API =
  (import.meta as any)?.env?.VITE_API_BASE || "http://35.178.138.33:8000";

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`${url} failed: ${res.status}`);
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

  // Make sure we always return something that matches SetSummary
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
  const data = await getJson<any>(url);

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
    { method: "POST" }
  );
  if (!res.ok) {
    throw new Error(`Add to My Sets failed: ${res.status}`);
  }
}

export async function removeFromMySets(set_num: string): Promise<void> {
  const res = await fetch(
    `${API}/api/mysets/remove?set=${encodeURIComponent(set_num)}`,
    { method: "DELETE" }
  );
  if (!res.ok) {
    throw new Error(`Remove from My Sets failed: ${res.status}`);
  }
}

/**
 * Add all parts from a given set into the inventory.
 * Backend route: POST /api/inventory/add_set_parts?set=<set_num>
 */
export async function addSetPartsToInventory(set_num: string): Promise<void> {
  const q = set_num.trim();
  if (!q) return;

  const res = await fetch(
    `${API}/api/inventory/add_set_parts?set=${encodeURIComponent(q)}`,
    {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
    }
  );

  if (!res.ok) {
    let msg = res.statusText;
    try {
      const body = await res.text();
      if (body) msg = body;
    } catch {
      // ignore
    }
    throw new Error(`addSetPartsToInventory failed: ${res.status} ${msg}`);
  }
}

/**
 * Fetch your current brick inventory.
 * Backend: GET /api/inventory/parts_with_images
 * Canonical shape (per your spec):
 *   { part_num, color_id, qty_total, img_url?, part_img_url? }
 */
export async function fetchInventoryParts(): Promise<InventoryPart[]> {
  const url = `${API}/api/inventory/parts_with_images`;
  const data = await getJson<any[]>(url);

  if (!Array.isArray(data)) return [];

  return data.map((raw: any): InventoryPart => ({
    part_num: String(raw.part_num ?? ""),
    color_id: Number(raw.color_id ?? 0),
    qty_total: Number(raw.qty_total ?? raw.qty ?? 0),
    img_url: raw.img_url ?? null,
    part_img_url: raw.part_img_url ?? null,
  }));
}