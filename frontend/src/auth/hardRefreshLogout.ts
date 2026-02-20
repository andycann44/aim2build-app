import { clearAuth } from "../utils/auth";

function isReloadNavigation(): boolean {
  if (typeof performance === "undefined") return false;

  try {
    const nav = performance.getEntriesByType?.("navigation")?.[0] as
      | PerformanceNavigationTiming
      | undefined;
    if (nav?.type === "reload") return true;
  } catch {
    // ignore
  }

  // Legacy fallback
  try {
    const legacyNav = (performance as any).navigation;
    return legacyNav && legacyNav.type === 1;
  } catch {
    return false;
  }
}

export function hardRefreshLogout(): boolean {
  if (typeof window === "undefined") return false;
  const isReload = isReloadNavigation();
  if (isReload) clearAuth();
  return isReload;
}
