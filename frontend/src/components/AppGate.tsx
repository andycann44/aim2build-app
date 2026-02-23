import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import SettingsPage from "../pages/SettingsPage";

interface AppGateProps {
  children: React.ReactNode;
}

// Centralized auth check (match your token keys used elsewhere)
function isAuthed(): boolean {
  try {
    const t =
      localStorage.getItem("token") ||
      localStorage.getItem("access_token") ||
      localStorage.getItem("auth_token") ||
      localStorage.getItem("a2b_token") ||
      "";
    return !!t;
  } catch {
    return false;
  }
}

const AppGate: React.FC<AppGateProps> = ({ children }) => {
  const location = useLocation();
  const authed = isAuthed();

  // Only gate pages that MUST be authed.
  // IMPORTANT: We gate /buildability (overview/discover) but we allow /buildability/:setNum?demo=1
  const protectedPrefixes = ["/inventory", "/my-sets", "/wishlist", "/buildability", "/settings"];

  const pathname = location.pathname || "/";
  const search = location.search || "";
  const qs = new URLSearchParams(search);

  const isBuildabilityDetails =
    pathname.startsWith("/buildability/") && pathname.split("/").filter(Boolean).length === 2; // ["buildability", ":setNum"]

  const isDemoDetails = isBuildabilityDetails && qs.get("demo") === "1";

  // Allow demo details through when logged out
  if (!authed && isDemoDetails) {
    return <>{children}</>;
  }

  // Gate protected routes when logged out
  if (!authed && protectedPrefixes.some((prefix) => pathname.startsWith(prefix))) {
    const next = `${pathname}${search}`;
    return (
      <Navigate
        to={`/account?mode=login&next=${encodeURIComponent(next)}`}
        replace
      />
    );
  }

  return <>{children}</>;
};

export default AppGate;