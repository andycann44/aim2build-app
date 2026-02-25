// frontend/src/auth/hardRefreshLogout.ts
import { clearAuth } from "../utils/auth";

// Only allow this behaviour in LOCAL dev (never in prod/app store builds).
export function hardRefreshLogout() {
  try {
    const host = window.location.hostname;
    const isLocal = host === "localhost" || host === "127.0.0.1";
    if (!isLocal) return;

    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const isReload = nav?.type === "reload";
    if (isReload) clearAuth();
  } catch {
    // ignore
  }
}
