import React from "react";
import { getToken, clearToken } from "../utils/auth";
import NotSignedIn from "./NotSignedIn";
import { apiGet } from "../api/api"; // if you have a helper; if not, use fetch below

type Props = {
  children: React.ReactNode;
  pageName?: string;
};

const RequireAuth: React.FC<Props> = ({ children, pageName }) => {
  const token = getToken();
  const [state, setState] = React.useState<"checking" | "ok" | "nope">(
    token ? "checking" : "nope"
  );

  React.useEffect(() => {
    let alive = true;

    async function run() {
      if (!token) {
        if (alive) setState("nope");
        return;
      }

      try {
        // Use fetch directly so we don't depend on other helpers:
        const res = await fetch(`/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (!alive) return;

        if (res.ok) {
          setState("ok");
        } else {
          // expired/invalid token
          clearToken();
          setState("nope");
        }
      } catch {
        if (!alive) return;
        // network/API down -> treat as not signed in (or keep checking if you prefer)
        setState("nope");
      }
    }

    run();
    return () => {
      alive = false;
    };
  }, [token]);

  if (state === "nope") return <NotSignedIn pageName={pageName} />;
  if (state === "checking") return <div style={{ padding: 16 }}>Checking session...</div>;
  return <>{children}</>;
};

export default RequireAuth;