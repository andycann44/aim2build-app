import React, { useEffect, useState } from "react";
import { API_BASE } from "../api/client";
import { authHeaders, getToken } from "../utils/auth";
import NotSignedIn from "./NotSignedIn";

type Props = {
  children: React.ReactNode;
  pageName?: string;
};

type AuthState = "checking" | "authed" | "noauth";

function clearTokens() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("access_token");
    localStorage.removeItem("aim2build_token");
  } catch {
    // ignore
  }
}

const RequireAuth: React.FC<Props> = ({ children, pageName }) => {
  const token = getToken();

  const [state, setState] = useState<AuthState>(() => {
    return token ? "checking" : "noauth";
  });

  useEffect(() => {
    let cancelled = false;

    async function verify() {
      // If no token, immediately no-auth
      if (!token) {
        setState("noauth");
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/api/auth/me`, {
          method: "GET",
          headers: {
            ...authHeaders(),
            Accept: "application/json",
          },
        });

        if (cancelled) return;

        if (res.status === 401) {
          // token exists but is invalid/expired/wrong secret -> clear + force login UI
          clearTokens();
          setState("noauth");
          return;
        }

        if (!res.ok) {
          // for safety: don't lock user out on transient 500 etc
          // treat as authed and let pages handle errors normally
          setState("authed");
          return;
        }

        setState("authed");
      } catch {
        if (cancelled) return;
        // network hiccup -> don't force logout, just allow through
        setState("authed");
      }
    }

    verify();

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (!token) {
    return <NotSignedIn pageName={pageName} />;
  }

  if (state === "checking") {
    // keep it simple: you can swap this for a nicer loading state later
    return <div style={{ padding: "1rem", color: "#94a3b8" }}>Checking sign-in…</div>;
  }

  if (state === "noauth") {
    return <NotSignedIn pageName={pageName} />;
  }

  return <>{children}</>;
};

export default RequireAuth;