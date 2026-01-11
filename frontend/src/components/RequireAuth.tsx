import React from "react";
import { API_BASE } from "../api/client";
import { authHeaders, getToken } from "../utils/auth";
import NotSignedIn from "./NotSignedIn";

type Props = {
  children: React.ReactNode;
  pageName?: string;
};

// session-only guard so we only prefetch once per tab session
const WARMUP_DONE_KEY = "a2b:warmup:discover:v1:done";

// Must match Discover page cache key format for defaults.
// If Discover defaults change, update this key.
const DISCOVER_CACHE_KEY = "a2b-discover:v1:90:0:1";

function apiUrl(path: string): string {
  const API = API_BASE || "";
  if (!API) return path;
  return `${API}${path}`;
}

function runIdle(fn: () => void) {
  const w = window as any;
  if (typeof w.requestIdleCallback === "function") {
    w.requestIdleCallback(fn, { timeout: 2000 });
  } else {
    setTimeout(fn, 350);
  }
}

async function warmupDiscoverOnce(): Promise<void> {
  if (typeof window === "undefined") return;
  if (sessionStorage.getItem(WARMUP_DONE_KEY) === "1") return;

  // mark early so route changes don’t double-trigger
  sessionStorage.setItem(WARMUP_DONE_KEY, "1");

  // if cache already exists, don’t waste calls
  try {
    if (sessionStorage.getItem(DISCOVER_CACHE_KEY)) return;
  } catch {
    // ignore
  }

  // 1) skip warmup if inventory empty (fast endpoint)
  const hasAnyRes = await fetch(apiUrl("/api/inventory/has_any"), {
    method: "GET",
    headers: { ...authHeaders() },
  });
  if (!hasAnyRes.ok) return;

  const hasAnyJson = await hasAnyRes.json().catch(() => null);
  if (!hasAnyJson || !hasAnyJson.has_any) return;

  // 2) prefetch discover (default filters)
  const qs = new URLSearchParams();
  qs.set("min_coverage", "0.90");
  qs.set("limit", "200");
  qs.set("include_complete", "false");
  qs.set("hide_owned", "true");

  const res = await fetch(apiUrl(`/api/buildability/discover?${qs.toString()}`), {
    method: "GET",
    headers: { ...authHeaders() },
  });
  if (!res.ok) return;

  const rows = await res.json().catch(() => null);
  if (!Array.isArray(rows)) return;

  // 3) write cache exactly how Discover expects
  try {
    sessionStorage.setItem(DISCOVER_CACHE_KEY, JSON.stringify({ rows, cached_at: Date.now() }));
  } catch {
    // ignore
  }
}

const RequireAuth: React.FC<Props> = ({ children, pageName }) => {
  const token = getToken();

  React.useEffect(() => {
    if (!token) return;

    // background warmup (never blocks UI)
    runIdle(() => {
      warmupDiscoverOnce().catch(() => {});
    });
  }, [token]);

  if (!token) {
    return <NotSignedIn pageName={pageName} />;
  }

  return <>{children}</>;
};

export default RequireAuth;