import { getToken, clearToken } from "./auth";
import { API_BASE } from "../api/client";

const KEY_ENABLED = "a2b_session_idle_enabled";
const KEY_MINUTES = "a2b_session_idle_minutes";

function getEnabled(): boolean {
  const v = localStorage.getItem(KEY_ENABLED);
  if (v == null) return true; // default ON
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
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.ok) return true;
  } catch {
    // ignore network errors here; treat as invalid session
  }

  clearToken();
  return false;
}

export function initSessionIdleGuard(navigateToLogin: () => void) {
  let lastActive = Date.now();
  let fired = false;

  const bump = () => {
    lastActive = Date.now();
    fired = false;
  };

  // activity signals
  window.addEventListener("mousemove", bump, { passive: true });
  window.addEventListener("keydown", bump);
  window.addEventListener("scroll", bump, { passive: true });
  window.addEventListener("click", bump);

  const tick = async () => {
    if (!getEnabled()) return;

    const idleMs = getMinutes() * 60 * 1000;
    if (Date.now() - lastActive < idleMs) return;
    if (fired) return;

    fired = true;

    const ok = await validateSession();
    if (!ok) {
      navigateToLogin();
    } else {
      // session still valid; keep user in but reset timer
      bump();
    }
  };

  // check every 15s
  const timer = window.setInterval(() => void tick(), 15000);

  return () => {
    window.clearInterval(timer);
    notedCleanup();
  };

  function notedCleanup() {
    window.removeEventListener("mousemove", bump as any);
    window.removeEventListener("keydown", bump as any);
    window.removeEventListener("scroll", bump as any);
    window.removeEventListener("click", bump as any);
  }
}
