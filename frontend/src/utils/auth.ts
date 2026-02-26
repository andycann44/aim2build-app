// frontend/src/utils/auth.ts
// Single source of truth for auth token storage + auth headers.
// Keep backward-compat exports (saveToken) so older components don't crash.

export const TOKEN_KEY = "a2b_token";
export const AUTH_CHANGED_EVENT = "a2b:auth-changed";

function emitAuthChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
  } catch {
    // ignore
  }
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string) {


  try {
    localStorage.setItem(TOKEN_KEY, token);

    // purge legacy keys so they can never override again
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("aim2build_token");
    localStorage.removeItem("auth_token");
  } catch {
    // ignore
  } finally {
    emitAuthChanged();
  }
}

// Back-compat: some files import saveToken(...)
export function saveToken(token: string) {
  setToken(token);
}

export function clearToken() {
  clearAuth();
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

export function clearAuth() {
  try {
    localStorage.removeItem(TOKEN_KEY);
    // also clear legacy keys so you don't get “half logged-in” states
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("aim2build_token");
    localStorage.removeItem("auth_token");
    localStorage.removeItem("user");
  } catch {
    // ignore
  } finally {
    emitAuthChanged();
  }
}
export function isLoggedIn(): boolean {
  return !!getToken();
}

function clearDiscoverCache() {
  try {
    for (const k of Object.keys(localStorage)) {
      if (k.startsWith("a2b:buildability:discover:")) {
        localStorage.removeItem(k);
      }
    }
  } catch {
    // ignore
  }
}

export function logoutNow() {
  clearAuth();
  clearDiscoverCache();
}