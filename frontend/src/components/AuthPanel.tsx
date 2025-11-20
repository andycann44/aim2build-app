// frontend/src/components/AuthPanel.tsx
import React, { useEffect, useState } from "react";

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE ?? "http://127.0.0.1:8000";

type AuthMode = "login" | "register";

interface AuthStorage {
  email: string;
  token: string;
  userId: number;
}

const STORAGE_KEY = "aim2build_auth";

const loadStoredAuth = (): AuthStorage | null => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      typeof parsed.email === "string" &&
      typeof parsed.token === "string" &&
      typeof parsed.userId === "number"
    ) {
      return parsed as AuthStorage;
    }
    return null;
  } catch {
    return null;
  }
};

const saveStoredAuth = (auth: AuthStorage | null) => {
  try {
    if (!auth) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(auth));
    }
  } catch {
    // ignore storage errors
  }
};

const AuthPanel: React.FC = () => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<AuthStorage | null>(null);

  useEffect(() => {
    const stored = loadStoredAuth();
    if (stored) {
      setCurrentUser(stored);
      setEmail(stored.email);
    }
  }, []);

  const clearMessages = () => {
    setMessage(null);
    setError(null);
  };

  const handleSubmit = async () => {
    clearMessages();
    if (!email || !password) {
      setError("Please enter an email and password.");
      return;
    }

    setLoading(true);
    try {
      if (mode === "register") {
        const res = await fetch(`${API_BASE}/api/auth/register`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json().catch(() => ({} as any));

        if (!res.ok) {
          setError(
            (data && (data.detail || data.error)) ||
              "Could not register. Try a different email."
          );
        } else {
          // backend returns { ok: true, user_id }
          const userId = data.user_id ?? data.userId ?? 0;
          setMessage("Registration successful. You can now log in.");
          setCurrentUser({
            email,
            token: currentUser?.token ?? "",
            userId,
          });
          saveStoredAuth({
            email,
            token: currentUser?.token ?? "",
            userId,
          });
        }
      } else {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json().catch(() => ({} as any));

        if (!res.ok) {
          setError(
            (data && (data.detail || data.error)) ||
              "Invalid email or password."
          );
        } else {
          const token: string = data.access_token || data.token || "";
          const userId: number = data.user_id ?? data.userId ?? 0;

          const auth: AuthStorage = { email, token, userId };
          setCurrentUser(auth);
          saveStoredAuth(auth);
          setMessage("Logged in successfully.");
        }
      }
    } catch (e) {
      console.error(e);
      setError("Network error talking to the server.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    saveStoredAuth(null);
    clearMessages();
    setPassword("");
  };

  const modeLabel = mode === "login" ? "Login" : "Register";

  return (
    <div
      style={{
        maxWidth: "560px",
        margin: "1.5rem auto 2rem",
        padding: "1.5rem 1.75rem",
        borderRadius: "18px",
        background: "rgba(15, 23, 42, 0.85)",
        boxShadow: "0 14px 35px rgba(15,23,42,0.55)",
        color: "#e5e7eb",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "1rem",
          gap: "1rem",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "1.1rem",
              fontWeight: 700,
              letterSpacing: "0.03em",
            }}
          >
            Account
          </h2>
          <p
            style={{
              margin: "0.15rem 0 0",
              fontSize: "0.8rem",
              color: "#9ca3af",
            }}
          >
            {currentUser
              ? `Logged in as ${currentUser.email}`
              : "Create an account to save your inventory and sets."}
          </p>
        </div>
        <div
          style={{
            display: "inline-flex",
            borderRadius: "999px",
            background: "rgba(15,23,42,0.9)",
            border: "1px solid rgba(148,163,184,0.4)",
            overflow: "hidden",
          }}
        >
          <button
            type="button"
            onClick={() => {
              clearMessages();
              setMode("login");
            }}
            style={{
              padding: "0.25rem 0.9rem",
              fontSize: "0.8rem",
              border: "none",
              cursor: "pointer",
              background:
                mode === "login" ? "rgba(34,197,94,0.18)" : "transparent",
              color: mode === "login" ? "#bbf7d0" : "#e5e7eb",
            }}
          >
            Login
          </button>
          <button
            type="button"
            onClick={() => {
              clearMessages();
              setMode("register");
            }}
            style={{
              padding: "0.25rem 0.9rem",
              fontSize: "0.8rem",
              border: "none",
              cursor: "pointer",
              background:
                mode === "register" ? "rgba(59,130,246,0.26)" : "transparent",
              color: mode === "register" ? "#bfdbfe" : "#e5e7eb",
            }}
          >
            Register
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
        <label style={{ fontSize: "0.8rem" }}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            style={{
              marginTop: "0.25rem",
              width: "100%",
              borderRadius: "999px",
              border: "1px solid rgba(148,163,184,0.5)",
              padding: "0.5rem 0.9rem",
              fontSize: "0.85rem",
              background: "rgba(15,23,42,0.95)",
              color: "#e5e7eb",
              outline: "none",
            }}
          />
        </label>

        <label style={{ fontSize: "0.8rem" }}>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            style={{
              marginTop: "0.25rem",
              width: "100%",
              borderRadius: "999px",
              border: "1px solid rgba(148,163,184,0.5)",
              padding: "0.5rem 0.9rem",
              fontSize: "0.85rem",
              background: "rgba(15,23,42,0.95)",
              color: "#e5e7eb",
              outline: "none",
            }}
          />
        </label>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "0.5rem",
            gap: "0.75rem",
          }}
        >
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            style={{
              borderRadius: "999px",
              border: "none",
              padding: "0.45rem 1.2rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: loading ? "default" : "pointer",
              background:
                mode === "login"
                  ? "linear-gradient(90deg,#22c55e,#4ade80)"
                  : "linear-gradient(90deg,#3b82f6,#22d3ee)",
              color: "#0f172a",
              opacity: loading ? 0.7 : 1,
              boxShadow: "0 8px 22px rgba(15,23,42,0.75)",
            }}
          >
            {loading ? "Please wait…" : modeLabel}
          </button>

          {currentUser && (
            <button
              type="button"
              onClick={handleLogout}
              style={{
                borderRadius: "999px",
                border: "1px solid rgba(148,163,184,0.5)",
                padding: "0.4rem 0.9rem",
                fontSize: "0.8rem",
                background: "transparent",
                color: "#e5e7eb",
                cursor: "pointer",
              }}
            >
              Log out
            </button>
          )}
        </div>

        {error && (
          <div
            style={{
              marginTop: "0.25rem",
              fontSize: "0.8rem",
              color: "#fecaca",
            }}
          >
            {error}
          </div>
        )}
        {message && !error && (
          <div
            style={{
              marginTop: "0.25rem",
              fontSize: "0.8rem",
              color: "#bbf7d0",
            }}
          >
            {message}
          </div>
        )}
      </div>
    </div>
  );
};

export default AuthPanel;