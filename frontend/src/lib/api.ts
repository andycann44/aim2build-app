export const API = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export async function api<T = any>(path: string, opts: RequestInit = {}): Promise<T> {
  const r = await fetch(`${API}${path}`, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

// Rebrickable CDN image for a part with a specific color
export function img(part_num: string, color_id: number | string) {
  return `https://cdn.rebrickable.com/media/parts/${color_id}/${part_num}.jpg`;
}
