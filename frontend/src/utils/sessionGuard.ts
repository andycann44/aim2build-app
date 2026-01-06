import { getToken, clearToken } from "./auth";

const KEY_ENABLED = "a2b_session_idle_enabled";
const KEY_MINUTES = "a2b_session_idle_minutes";

function getEnabled(): boolean {
  const v = localStorage.getItem(KEY_ENABLED);
  if (v === null) return true; // default ON
  return v === "1";
}

function getMinutes(): number {
  const v = localStorage.getItem(KEY_MINUTES);
  const n = v ? parseInt(v, 10) : 60; // default 60
  return Number.isFinite(n) && n > 0 ? n : 60;
}

async function validateSession(): Promise<boolean> {
  const token = getToken();
  if (!token) return false;

  try {
    const API = import.meta.env.VITE_API_BASE || "";
    const res = await fetch(`${API}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) return true;

    clearToken();
    return false;
  } catch {
    // If API is unreachable, safest is to treat as signed-out
    clearToken();
    return false;
  }
}

export function initSessionIdleGuard(navigateToLogin: () => void) {
  let lastActive = Date.now();
  let wasIdle = false;

  const idleMs = () => getMinutes() * 60 * 1000;

  function markActive() {
    lastActive = Date.now();
    if (wasIdle) {
      wasIdle = false;

      if (!getEnabled()) return;

      // User came back from idle -> re-check session
      void (async () => {
        const ok = await validateSession();
        if (!ok) navigateToLogin();
      })();
    }
  }

  // Activity events
  const events: Array<keyof WindowEventMap> = [
    "mousemove",
    "mousedown",
    "keydown",
    "touchstart",
    "scroll",
    "focus",
  ];

  events.forEach((e) => window.addEventListener(e, markActive, { passive: true }));

  // Check idle status every 10s
  setInterval(() => {
    if (!getEnabled()) return;
    const now = Date.now();
    if (now - lastActive >= idleMs()) wasIdle = true;
  }, 10_000);
}
