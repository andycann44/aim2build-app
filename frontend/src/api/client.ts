import { authHeaders } from "../utils/auth";

export type AuthResult = {
  ok: boolean;
  token?: string;
  error?: string;
};

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

const API_BASE =
  import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

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
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`${res.status} ${res.statusText} - ${text}`);
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
  qty_total: number;
  img_url?: string | null;
}

export interface BuildabilityResult {
  set_num: string;
  coverage: number;
  total_needed: number;
  total_have: number;
}

export async function searchSets(q: string): Promise<SetSummary[]> {
  if (!q.trim()) return [];

  const encoded = encodeURIComponent(q);
  const paths = [
    `/api/search?q=${encoded}`,            // preferred
    `/api/search/sets?q=${encoded}`,       // fallback 1
    `/api/sets/search_sets?q=${encoded}`   // fallback 2
  ];

  let lastError: unknown = null;

  for (const path of paths) {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        headers: { "Content-Type": "application/json" }
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

      // Support multiple response shapes:
      //  - [ { set_num, ... } ]
      //  - { results: [...] }
      //  - { sets: [...] }
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
    method: "POST"
  });
}

export async function removeMySet(set_num: string): Promise<void> {
  await json(`/api/mysets/remove?set=${encodeURIComponent(set_num)}`, {
    method: "DELETE"
  });
}

export async function getWishlist(): Promise<SetSummary[]> {
  const data = await json<{ sets: SetSummary[] }>(`/api/wishlist`);
  return data.sets || [];
}

export async function addWishlist(set_num: string): Promise<void> {
  await json(`/api/wishlist/add?set=${encodeURIComponent(set_num)}`, {
    method: "POST"
  });
}

export async function removeWishlist(set_num: string): Promise<void> {
  await json(`/api/wishlist/remove?set=${encodeURIComponent(set_num)}`, {
    method: "DELETE"
  });
}

export async function getInventoryParts(): Promise<InventoryPart[]> {
  return json<InventoryPart[]>(`/api/inventory/parts`);
}

export async function clearInventory(): Promise<void> {
  await json(`/api/inventory/clear?confirm=YES`, { method: "DELETE" });
}

export async function getBuildability(set_num: string): Promise<BuildabilityResult> {
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
