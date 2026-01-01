import { authHeaders } from "../utils/auth";

export type AuthResult = {
  ok: boolean;
  token?: string;
  error?: string;
};

// --- API base + runtime override ---

// Default: local backend
const ENV_API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

const OVERRIDE_KEY = "aim2build_api_override";

export function getApiBase(): string {
  if (typeof window !== "undefined") {
    try {
      const override = window.localStorage.getItem(OVERRIDE_KEY);
      if (override) return override;
    } catch {
      // ignore
    }
  }
  return ENV_API_BASE;
}

export function setApiOverride(url: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (url) {
      window.localStorage.setItem(OVERRIDE_KEY, url);
    } else {
      window.localStorage.removeItem(OVERRIDE_KEY);
    }
  } catch {
    // ignore
  }
}

export const API_BASE = getApiBase();

export async function register(
  email: string,
  password: string
): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (res.ok) {
    return { ok: true };
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse errors
  }

  if (res.status === 422) {
    return {
      ok: false,
      error: "Please enter a valid email address.",
    };
  }

  const detail =
    (data && (data.detail || data.message)) ||
    "Could not register. Please try again.";
  return { ok: false, error: detail };
}

export async function login(
  email: string,
  password: string
): Promise<AuthResult> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (res.ok) {
    const data = await res.json().catch(() => null);
    const token: string | undefined = data?.access_token || data?.token;
    return { ok: true, token };
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse errors
  }

  if (res.status === 422) {
    return {
      ok: false,
      error: "Please check your email and password.",
    };
  }

  const detail =
    (data && (data.detail || data.message)) ||
    "Could not log in. Please try again.";
  return { ok: false, error: detail };
}

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  const extraHeaders =
    init?.headers instanceof Headers
      ? Object.fromEntries(init.headers.entries())
      : (init?.headers as Record<string, string> | undefined);

  const mergedHeaders = {
    "Content-Type": "application/json",
    ...authHeaders(),
    ...extraHeaders,
  };

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: mergedHeaders,
  });
  if (res.status === 401) {
    throw new Error("401 Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `${path} failed`);
  }
  return res.json() as Promise<T>;
}

export interface SetSummary {
  set_num: string;
  name: string;
  year: number;
  img_url?: string | null;
  num_parts?: number;
}

export interface InventoryPart {
  part_num: string;
  color_id: number;

  // ✅ canonical fields (match backend)
  qty: number;
  color_name?: string | null;
  img_url?: string | null;

  // ✅ legacy fields (keep optional during migration)
  qty_total?: number;
  part_img_url?: string | null;

  // optional flag from /api/parts/search
  image_exists?: boolean;
}

export interface BuildabilityResult {
  set_num: string;
  coverage: number;
  total_needed: number;
  total_have: number;
}

export async function getPouredSets(): Promise<string[]> {
  const data = await json<any[]>(`/api/inventory/sets`);
  if (!Array.isArray(data)) return [];
  // tolerate either ["21330-1", ...] or [{set_num:"21330-1"}]
  return data
    .map((row) =>
      typeof row === "string"
        ? row
        : typeof row?.set_num === "string"
        ? row.set_num
        : null
    )
    .filter(Boolean) as string[];
}

export async function pourSet(set_num: string): Promise<void> {
  await json(`/api/inventory/pour-set?set=${encodeURIComponent(set_num)}`, {
    method: "POST",
  });
}

export async function unpourSet(set_num: string): Promise<void> {
  await json(`/api/inventory/unpour-set?set=${encodeURIComponent(set_num)}`, {
    method: "POST",
  });
}

export async function searchParts(
  q: string,
  categoryId?: number,
  colorId?: number
): Promise<InventoryPart[]> {
  const term = q.trim();
  if (!term) return [];

  const params = new URLSearchParams();
  params.set("q", term);
  if (typeof categoryId === "number") {
    params.set("category_id", String(categoryId));
  }
  if (typeof colorId === "number") {
    params.set("color_id", String(colorId));
  }

  // IMPORTANT: use the existing catalog router
  const results = await json<any[]>(`/api/catalog/parts/search?${params.toString()}`);

  return (results || []).map((row) => ({
    part_num: String(row?.part_num ?? ""),
    // For raw catalog browsing we don't know a specific colour yet;
    // use 0 so the tile can show "Colour —".
    color_id: typeof colorId === "number" ? colorId : 0,

    // canonical
    qty: 1,
    img_url: row?.part_img_url ?? null,

    // legacy (optional, safe during migration)
    qty_total: 1,
    part_img_url: row?.part_img_url ?? null,

    image_exists:
      row?.image_exists === 1 ||
      row?.image_exists === true,
  }));
}

export async function addInventoryPart(
  part_num: string,
  color_id: number,
  qty: number
): Promise<any> {
  const payload = {
    part_num,
    color_id,
    qty,
  };

  const res = await fetch(`${API_BASE}/api/inventory/add`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify(payload),
  });

  if (res.status === 401) {
    throw new Error("401 Unauthorized");
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      text || "addInventoryPart failed"
    );
  }

  return res.json().catch(() => null);
}

export async function searchSets(q: string): Promise<SetSummary[]> {
  if (!q.trim()) return [];

  const encoded = encodeURIComponent(q);
  const paths = [
    `/api/search?q=${encoded}`, // preferred
    `/api/search/sets?q=${encoded}`, // fallback 1
    `/api/sets/search_sets?q=${encoded}`, // fallback 2
  ];

  let lastError: unknown = null;

  for (const path of paths) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json" },
      });

      // If this path truly does not exist, try the next one
      if (res.status === 404) {
        continue;
      }

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`${res.status} ${res.statusText} - ${text}`);
      }

      const data = await res.json();

      if (Array.isArray(data)) {
        return data as SetSummary[];
      }
      if (Array.isArray((data as any).results)) {
        return (data as any).results as SetSummary[];
      }
      if (Array.isArray((data as any).sets)) {
        return (data as any).sets as SetSummary[];
      }

      return [];
    } catch (err) {
      lastError = err;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }
  throw new Error("Search failed on all known endpoints");
}

export async function getMySets(): Promise<SetSummary[]> {
  const data = await json<{ sets: SetSummary[] }>(`/api/mysets`);
  return data.sets || [];
}

export async function addMySet(set_num: string): Promise<void> {
  await json(`/api/mysets/add?set=${encodeURIComponent(set_num)}`, {
    method: "POST",
  });
}

export async function removeMySet(set_num: string): Promise<void> {
  await json(`/api/mysets/remove?set=${encodeURIComponent(set_num)}`, {
    method: "DELETE",
  });
}

export async function getWishlist(): Promise<SetSummary[]> {
  const data = await json<{ sets: SetSummary[] }>(`/api/wishlist`);
  return data.sets || [];
}

export async function addWishlist(set_num: string): Promise<void> {
  await json(`/api/wishlist/add?set=${encodeURIComponent(set_num)}`, {
    method: "POST",
  });
}

export async function removeWishlist(set_num: string): Promise<void> {
  await json(`/api/wishlist/remove?set=${encodeURIComponent(set_num)}`, {
    method: "DELETE",
  });
}

export async function getInventoryParts(): Promise<InventoryPart[]> {
  return json<InventoryPart[]>(`/api/inventory/parts`);
}

export async function clearInventory(): Promise<void> {
  await json(`/api/inventory/clear?confirm=YES`, { method: "DELETE" });
}

export async function getBuildability(
  set_num: string
): Promise<BuildabilityResult> {
  return json<BuildabilityResult>(
    `/api/buildability/compare?set=${encodeURIComponent(set_num)}`
  );
}

export const apiClient = {
  get: <T>(path: string, init?: RequestInit) => json<T>(path, init),
  post: <T>(path: string, init?: RequestInit) =>
    json<T>(path, { ...(init ?? {}), method: init?.method ?? "POST" }),
  delete: <T>(path: string, init?: RequestInit) =>
    json<T>(path, { ...(init ?? {}), method: init?.method ?? "DELETE" }),
};
