// src/lib/api.ts
export const API_BASE =
  (import.meta as any)?.env?.VITE_API_BASE || "http://127.0.0.1:8000";

type JSONVal = string | number | boolean | null | JSONVal[] | { [k: string]: JSONVal };

export async function api<T = any>(
  path: string,
  opts: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
    ...opts,
  });

  if (res.status === 204) return undefined as unknown as T;

  const isJson = (res.headers.get("content-type") || "").includes("application/json");
  const body = isJson ? await res.json().catch(() => ({})) : await res.text();

  if (!res.ok) {
    const msg = isJson && body && (body as any).detail
      ? `${res.status} ${res.statusText} — ${(body as any).detail}`
      : `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }
  return body as T;
}

export const get  = <T = any>(path: string) => api<T>(path);
export const post = <T = any>(path: string, data?: JSONVal | object) =>
  api<T>(path, { method: "POST", body: data ? JSON.stringify(data) : undefined });
export const del  = <T = any>(path: string) => api<T>(path, { method: "DELETE" });
export default api;