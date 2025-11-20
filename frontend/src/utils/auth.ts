const STORAGE_KEY = "aim2build_auth";

export type StoredAuth = {
  email: string;
  token: string;
  userId: number;
};

export function getStoredAuth(): StoredAuth | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (
      typeof data.email === "string" &&
      typeof data.token === "string" &&
      typeof data.userId === "number"
    ) {
      return data as StoredAuth;
    }
  } catch {
    // ignore
  }
  return null;
}

export function authHeaders(): Record<string, string> {
  const auth = getStoredAuth();
  if (!auth?.token) return {};
  return { Authorization: `Bearer ${auth.token}` };
}

export { STORAGE_KEY };
