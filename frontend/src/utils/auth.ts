// frontend/src/utils/auth.ts
// Single source of truth for auth token storage + auth headers.
// Keep backward-compat exports (saveToken) so older components don't crash.

export const TOKEN_KEY = "a2b_token";

export function getToken(): string | null {
  try {
    return (
      localStorage.getItem(TOKEN_KEY) ||
      // legacy keys (keep for compatibility)
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("aim2build_token")
    );
  } catch {
    return null;
  }
}

export function setToken(token: string) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
}

// Back-compat: some files import saveToken(...)
export function saveToken(token: string) {
  setToken(token);
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    // also clear legacy keys so you don't get “half logged-in” states
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("aim2build_token");
  } catch {
    // ignore
  }
}

export function authHeaders(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// Supports common backend login payloads:
// { token: "..." } or { access_token: "..." }
export function extractAccessToken(data: any): string {
  const t =
    (data && typeof data.access_token === "string" && data.access_token) ||
    (data && typeof data.token === "string" && data.token) ||
    "";
  return t;
}