import React from "react";
import { Navigate, useLocation } from "react-router-dom";

interface AppGateProps {
  children: React.ReactNode;
}

// Centralized auth check (match your token keys used elsewhere)
function isAuthed(): boolean {
  try {
    const t = localStorage.getItem("a2b_token") || "";
    return !!t;
  } catch {
    return false;
  }
}

const AppGate: React.FC<AppGateProps> = ({ children }) => {
  const location = useLocation();
  const authed = isAuthed();

  const pathname = location.pathname || "/";
  const search = location.search || "";
  const qs = new URLSearchParams(search);

  // Public buildability entry points (logged-out allowed)
  const isBuildabilityRoot = pathname === "/buildability" || pathname === "/buildability/";
  const isBuildabilityDiscover = pathname === "/buildability/discover";

  // Demo buildability details allowed when logged out:
  // /buildability/:setNum?demo=1
  const isBuildabilityDetails =
    pathname.startsWith("/buildability/") && pathname.split("/").filter(Boolean).length === 2; // ["buildability", ":setNum"]

  const isDemoDetails = isBuildabilityDetails && qs.get("demo") === "1";

  // 1) If logged out and user hits /buildability, send them to Discover (public)
  if (!authed && isBuildabilityRoot) {
    return <Navigate to="/buildability/discover" replace />;
  }

  // 2) Allow Discover through when logged out
  if (!authed && isBuildabilityDiscover) {
    return <>{children}</>;
  }

  // 3) Allow demo details through when logged out
  if (!authed && isDemoDetails) {
    return <>{children}</>;
  }

  // Only gate pages that MUST be authed.
  // Keep /buildability protected EXCEPT for the two exceptions above.
  const protectedPrefixes = ["/inventory", "/my-sets", "/wishlist", "/buildability", "/settings"];

  // Gate protected routes when logged out
  if (!authed && protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    const next = `${pathname}${search}`;
    return (
      <Navigate to={`/account?mode=login&next=${encodeURIComponent(next)}`} replace />
    );
  }

  return <>{children}</>;
};

export default AppGate;