import { clearAuth } from "./auth";

let installed = false;

export function installAuthFetchGuard() {
  if (installed) return;
  if (typeof window === "undefined" || typeof window.fetch !== "function") return;

  installed = true;
  const baseFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const res = await baseFetch(input, init);

    if (res && (res.status === 401 || res.status === 403)) {
      clearAuth();
      const path = window.location?.pathname || "";
      if (!path.startsWith("/account")) {
        window.location.href = "/account?mode=login&reason=expired";
      }
    }

    return res;
  };
}
