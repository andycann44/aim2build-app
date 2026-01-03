import React, { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { API_BASE } from "../api/client";
import { getToken, saveToken, clearToken } from "../utils/auth";

const API = API_BASE;

type AuthPanelProps = {
  onAuthed?: () => void;
};

type AuthResult = {
  ok: boolean;
  token?: string;
  error?: string;
};

type ForgotResult = {
  ok: boolean;
  message?: string;
  reset_token?: string; // optional dev-only
  reset_url?: string; // optional dev-only
  error?: string;
};

type Mode = "login" | "register" | "reset";

function isValidEmail(email: string): boolean {
  return /\S+@\S+\.\S+/.test(email);
}

async function loginRequest(email: string, password: string): Promise<AuthResult> {
const res = await fetch(`${API}/api/auth/login`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
  if (res.ok) {
    const data = await res.json().catch(() => null);
    const token: string | undefined = data?.access_token || data?.token;
    return { ok: true, token };
  }

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  const detail =
    (data && (data.detail || data.message)) ||
    "Could not log in. Please try again.";
  return { ok: false, error: detail };
}

async function registerRequest(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
const res = await fetch(`${API}/api/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password }),
});
  if (res.ok) return { ok: true };

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  const detail =
    (data && (data.detail || data.message)) ||
    "Could not create your account. Please try again.";
  return { ok: false, error: detail };
}

async function forgotPasswordRequest(email: string): Promise<ForgotResult> {
const res = await fetch(`${API}/api/auth/forgot-password`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email }),
});
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // ignore
  }

  if (res.ok) {
    return {
      ok: true,
      message: data?.message || "If an account exists for that email, a reset link has been sent.",
      reset_token: data?.reset_token,
      reset_url: data?.reset_url,
    };
  }

  const detail =
    (data && (data.detail || data.message)) ||
    "Could not start password reset. Please try again.";
  return { ok: false, error: detail };
}

const AuthPanel: React.FC<AuthPanelProps> = ({ onAuthed }) => {
  const [mode, setMode] = useState<Mode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => !!getToken());

  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetUrl, setResetUrl] = useState<string | null>(null);

  const location = useLocation();
  const navigate = useNavigate();

  const nextParam = useMemo(() => {
    const sp = new URLSearchParams(location.search || "");
    const n = sp.get("next");
    return n && n.startsWith("/") ? n : "/search";
  }, [location.search]);

  useEffect(() => {
    const existing = getToken();
    setIsLoggedIn(!!existing);
  }, []);

  const resetMessages = () => {
    setError(null);
    setInfo(null);
    setResetToken(null);
    setResetUrl(null);
  };

  const switchToLogin = () => {
    setMode("login");
    setPassword("");
    setConfirmPassword("");
    resetMessages();
  };

  const switchToRegister = () => {
    setMode("register");
    setPassword("");
    setConfirmPassword("");
    resetMessages();
  };

  const switchToReset = () => {
    setMode("reset");
    setPassword("");
    setConfirmPassword("");
    resetMessages();
  };

  const handleLogout = () => {
    clearToken();
    setIsLoggedIn(false);
    setMode("login");
    setEmail("");
    setPassword("");
    setConfirmPassword("");
    resetMessages();
  };

  const finishAuthed = () => {
    try {
      onAuthed?.();
    } catch {
      // ignore
    }
    // redirect to next route (SearchPage sets ?next=...)
    navigate(nextParam, { replace: true });
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    resetMessages();

    if (!isValidEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }

    if (mode === "reset") {
      setLoading(true);
      const r = await forgotPasswordRequest(email);
      setLoading(false);

      if (!r.ok) {
        setError(r.error || "Could not start reset.");
        return;
      }

      setInfo(r.message || "If an account exists for that email, a reset link has been sent.");
      if (r.reset_token) setResetToken(r.reset_token);
      if (r.reset_url) setResetUrl(r.reset_url);
      if (r.reset_url) {
        try {
          navigate(r.reset_url);
        } catch {
          // ignore navigation errors
        }
      }
      return;
    }

    if (!password) {
      setError("Please enter a password.");
      return;
    }

    if (mode === "register") {
      if (password.length < 8) {
        setError("Please choose a password at least 8 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setLoading(true);

    if (mode === "login") {
      const result = await loginRequest(email, password);
      setLoading(false);

      if (!result.ok) {
        setError(result.error || "Could not log in.");
        return;
      }

      if (result.token) saveToken(result.token);

      setIsLoggedIn(true);
      finishAuthed();
      return;
    }

    // register then auto-login
    const reg = await registerRequest(email, password);
    if (!reg.ok) {
      setLoading(false);
      setError(reg.error || "Could not create your account.");
      return;
    }

    const login = await loginRequest(email, password);
    setLoading(false);

    if (!login.ok) {
      setError(login.error || "Account created, but automatic sign-in failed. Please sign in.");
      switchToLogin();
      return;
    }

    if (login.token) saveToken(login.token);

    setIsLoggedIn(true);
    setInfo("Welcome! Your account has been created.");
    finishAuthed();
  };

  const title =
    mode === "login" ? "Sign in" : mode === "register" ? "Create an account" : "Reset your password";

  return (
    <div
      className="auth-panel card"
      style={{
        width: "100%",
        borderRadius: "18px",
        padding: "1.75rem 1.5rem 1.5rem",
        background:
          "linear-gradient(135deg, #0b1120 0%, #1d4ed8 35%, #fbbf24 70%, #dc2626 100%)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.45)",
        color: "#fff",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* studs strip */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: "0 0 auto 0",
          height: "10px",
          display: "flex",
          gap: "2px",
          padding: "0 8px",
        }}
      >
        {["#dc2626", "#f97316", "#fbbf24", "#22c55e", "#0ea5e9", "#6366f1"].map((c, i) => (
          <div
            key={i}
            style={{
              flex: 1,
              borderRadius: "99px",
              background: c,
              opacity: 0.9,
            }}
          />
        ))}
      </div>

      <div style={{ position: "relative", zIndex: 1 }}>
        <h2 style={{ marginTop: 0, marginBottom: "0.35rem" }}>
          {isLoggedIn ? "You’re signed in" : title}
        </h2>

        <p style={{ marginBottom: "1rem", maxWidth: "520px", opacity: 0.9 }}>
          Use the same account on any device to keep your sets, wishlist and inventory in sync.
        </p>

        {isLoggedIn ? (
          <div>
            <p style={{ marginBottom: "0.75rem", fontWeight: 600 }}>You’re logged in.</p>

            <button
              type="button"
              onClick={handleLogout}
              style={{
                marginTop: "0.25rem",
                width: "100%",
                padding: "0.95rem 1rem",
                borderRadius: "999px",
                border: "2px solid rgba(255,255,255,0.95)",
                fontWeight: 800,
                fontSize: "0.95rem",
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                cursor: "pointer",
                background: "linear-gradient(135deg,#f97316,#facc15,#22c55e)",
                color: "#111827",
                boxShadow: "0 10px 22px rgba(0,0,0,0.55)",
              }}
            >
              Log out
            </button>
          </div>
        ) : (
          <>
            <form onSubmit={onSubmit}>
              <div className="form-field" style={{ marginBottom: "0.85rem" }}>
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  style={{
                    width: "100%",
                    padding: "0.9rem 1rem",
                    borderRadius: "999px",
                    border: "2px solid rgba(255,255,255,0.9)",
                    backgroundColor: "rgba(15,23,42,0.9)",
                    color: "#f9fafb",
                    fontSize: "1rem",
                    boxShadow: "0 0 0 2px rgba(15,23,42,0.35)",
                    outline: "none",
                  }}
                />
              </div>

              {mode !== "reset" && (
                <>
                  <div className="form-field" style={{ marginBottom: "0.85rem", position: "relative" }}>
                    <label htmlFor="password">Password</label>
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={mode === "login" ? "current-password" : "new-password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={mode === "login" ? "Enter your password" : "Choose a password"}
                      style={{
                        width: "100%",
                        padding: "0.9rem 1rem",
                        borderRadius: "999px",
                        border: "2px solid rgba(255,255,255,0.9)",
                        backgroundColor: "rgba(15,23,42,0.9)",
                        color: "#f9fafb",
                        fontSize: "1rem",
                        boxShadow: "0 0 0 2px rgba(15,23,42,0.35)",
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      style={{
                        position: "absolute",
                        right: "calc(12px + 3mm)",
                        top: "50%",
                        transform: "translateY(calc(-50% + 2.5mm))",
                        height: "1.6rem",
                        width: "1.6rem",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        background: "transparent",
                        border: "none",
                        color: "#e5e7eb",
                        cursor: "pointer",
                        fontSize: "1.05rem",
                        padding: 0,
                      }}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? "🙈" : "👁"}
                    </button>
                  </div>

                  {mode === "register" && (
                    <div className="form-field" style={{ marginBottom: "0.85rem" }}>
                      <label htmlFor="confirm">Confirm password</label>
                      <input
                        id="confirm"
                        type={showPassword ? "text" : "password"}
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat your password"
                        style={{
                          width: "100%",
                          padding: "0.9rem 1rem",
                          borderRadius: "999px",
                          border: "2px solid rgba(255,255,255,0.9)",
                          backgroundColor: "rgba(15,23,42,0.9)",
                          color: "#f9fafb",
                          fontSize: "1rem",
                          boxShadow: "0 0 0 2px rgba(15,23,42,0.35)",
                          outline: "none",
                        }}
                      />
                    </div>
                  )}
                </>
              )}

              {error && (
                <p style={{ color: "#fecdd3", marginTop: "0.25rem", fontWeight: 600 }}>{error}</p>
              )}
              {info && (
                <p style={{ color: "#bbf7d0", marginTop: "0.4rem", fontWeight: 600 }}>{info}</p>
              )}

              {(resetToken || resetUrl) && (
                <div
                  style={{
                    marginTop: "0.6rem",
                    padding: "0.75rem 0.9rem",
                    borderRadius: "12px",
                    background: "rgba(15,23,42,0.65)",
                    border: "1px solid rgba(255,255,255,0.25)",
                    color: "#e5e7eb",
                    fontSize: "0.85rem",
                    overflowX: "auto",
                  }}
                >
                  <div style={{ fontWeight: 800, marginBottom: "0.35rem" }}>Dev reset info</div>
                  {resetUrl && <div style={{ marginBottom: "0.35rem" }}>{resetUrl}</div>}
                  {resetToken && <div>{resetToken}</div>}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: "1rem",
                  width: "100%",
                  padding: "0.95rem 1rem",
                  borderRadius: "999px",
                  border: "2px solid rgba(255,255,255,0.95)",
                  fontWeight: 800,
                  fontSize: "0.95rem",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  cursor: loading ? "default" : "pointer",
                  background: "linear-gradient(135deg,#f97316,#facc15,#22c55e)",
                  color: "#111827",
                  boxShadow: "0 10px 22px rgba(0,0,0,0.55)",
                  opacity: loading ? 0.85 : 1,
                }}
              >
                {loading
                  ? mode === "login"
                    ? "Signing in…"
                    : mode === "register"
                    ? "Creating account…"
                    : "Sending…"
                  : mode === "login"
                  ? "Sign in"
                  : mode === "register"
                  ? "Create account"
                  : "Send reset link"}
              </button>
            </form>

            <div
              style={{
                marginTop: "0.9rem",
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "space-between",
                gap: "0.5rem",
                fontSize: "0.85rem",
              }}
            >
              {mode !== "reset" ? (
                <button
                  type="button"
                  onClick={switchToReset}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: "#e5e7eb",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Forgot password?
                </button>
              ) : (
                <button
                  type="button"
                  onClick={switchToLogin}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: "#e5e7eb",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Back to sign in
                </button>
              )}

              {mode === "login" ? (
                <button
                  type="button"
                  onClick={switchToRegister}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: "#e5e7eb",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Need an account? Register
                </button>
              ) : mode === "register" ? (
                <button
                  type="button"
                  onClick={switchToLogin}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: "#e5e7eb",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Already registered? Sign in
                </button>
              ) : (
                <button
                  type="button"
                  onClick={switchToRegister}
                  style={{
                    background: "transparent",
                    border: "none",
                    padding: 0,
                    color: "#e5e7eb",
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  Need an account? Register
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthPanel;
