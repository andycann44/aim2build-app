import React from "react";
import { API_BASE } from "../api/client";
import { authHeaders, clearAuth, getToken } from "../utils/auth";
import { useLocation, useNavigate } from "react-router-dom";

// Public routes (accessible when logged out): "/", "/search", "/privacy", "/terms", "/about",
// plus any route NOT in the protected list below. Protected routes are derived from pages that
// wrap their content in RequireAuth: "/my-sets", "/wishlist", "/inventory", "/buildability", "/settings".

type GateState = "checking" | "offline" | "ready";

function GateScreen({ title, detail }: { title: string; detail?: string }) {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
      }}
    >
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          borderRadius: 16,
          background: "rgba(15,23,42,0.9)",
          border: "1px solid rgba(255,255,255,0.12)",
          boxShadow: "0 18px 40px rgba(15,23,42,0.55)",
          padding: "1.4rem 1.5rem",
          color: "#e5e7eb",
          textAlign: "center",
        }}
      >
        <div style={{ fontWeight: 800, fontSize: "1.05rem" }}>{title}</div>
        {detail && (
          <div style={{ marginTop: "0.4rem", fontSize: "0.92rem", color: "#cbd5f5" }}>
            {detail}
          </div>
        )}
      </div>
    </div>
  );
}

const AppGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = React.useState<GateState>("checking");
  const [authed, setAuthed] = React.useState(false);

  const location = useLocation();
  const navigate = useNavigate();

  const path = location.pathname || "/";
  const isAuthRoute = path.startsWith("/account") || path.startsWith("/reset-password");
  const protectedPrefixes = ["/my-sets", "/wishlist", "/inventory", "/settings"];
  const isProtectedRoute = protectedPrefixes.some((p) => path === p || path.startsWith(`${p}/`));

  React.useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setState("checking");

      // 1) health
      try {
        const health = await fetch(`${API_BASE}/api/health`, { method: "GET" });
        if (!health.ok) throw new Error("health failed");
      } catch {
        if (!cancelled) setState("offline");
        return;
      }

      // 2) auth check
      const token = getToken();
      if (!token) {
        if (!cancelled) {
          setAuthed(false);
          setState("ready");
        }
        return;
      }

      try {
        const me = await fetch(`${API_BASE}/api/auth/me`, { headers: { ...authHeaders() } });

        if (me.status === 401 || me.status === 403) {
          clearAuth();
          if (!cancelled) {
            setAuthed(false);
            setState("ready");
          }
          return;
        }

        if (me.ok) {
          if (!cancelled) {
            setAuthed(true);
            setState("ready");
          }
          return;
        }
      } catch {
        // fall through
      }

      // fallback -> logged out
      clearAuth();
      if (!cancelled) {
        setAuthed(false);
        setState("ready");
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (state !== "ready") return;
    if (authed) return;
    if (isAuthRoute) return;
    if (!isProtectedRoute) return;
    navigate("/account?mode=login", { replace: true });
  }, [state, authed, isAuthRoute, isProtectedRoute, navigate]);

  // renders (NO hooks below here)
  if (state === "checking") {
    return <GateScreen title="Checking status…" detail="Just a moment while we verify the service." />;
  }

  if (state === "offline") {
    return (
      <GateScreen
        title="Service unavailable"
        detail="We can’t reach the Aim2Build service right now. Please try again in a moment."
      />
    );
  }

  if (!authed && isProtectedRoute && !isAuthRoute) {
    return <GateScreen title="Checking status…" detail="Redirecting to login…" />;
  }

  return <>{children}</>;
};

export default AppGate;
