import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { getApiErrorMessage } from "../api/client";

export default function Login() {
  const { login, isLoading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await login(email.trim(), password);
      navigate("/dashboard");
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoRow}>
          <img
            src={`${import.meta.env.BASE_URL}homebase-logo.png`}
            alt="HomeBase"
            style={styles.logoImg}
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = "none";
              const fallback = e.currentTarget.nextElementSibling as HTMLElement;
              if (fallback) fallback.style.display = "flex";
            }}
          />
          <div style={{ ...styles.logoFallback, display: "none" }}>HB</div>
          <div>
            <div style={styles.brandName}>HomeBase</div>
            <div style={styles.brandSub}>Admin Portal</div>
          </div>
        </div>
        <h1 style={styles.heading}>Sign in</h1>
        <p style={styles.sub}>Admin access only</p>
        {error && <div style={styles.errorBox}>{error}</div>}
        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="admin@example.com"
              required
              autoFocus
            />
          </div>
          <div style={styles.field}>
            <label style={styles.label}>Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="••••••••"
              required
            />
          </div>
          <button type="submit" style={styles.btn} disabled={isLoading}>
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    background: "var(--bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    padding: "40px 44px",
    width: 420,
    maxWidth: "100%",
    boxShadow: "0 8px 40px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.06)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
  },
  logoImg: {
    height: 48,
    width: "auto",
    objectFit: "contain",
    flexShrink: 0,
  },
  logoFallback: {
    width: 48,
    height: 48,
    borderRadius: 12,
    background: "#38AE5F",
    color: "#fff",
    fontSize: 18,
    fontWeight: 700,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  brandName: { fontWeight: 700, fontSize: 17, color: "var(--text-primary)" },
  brandSub: { fontSize: 12, color: "var(--text-muted)", marginTop: 1 },
  heading: { margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "var(--text-primary)" },
  sub: { margin: "0 0 28px", fontSize: 14, color: "var(--text-muted)" },
  errorBox: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 20,
  },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" },
  input: {
    padding: "11px 14px",
    border: "1px solid var(--border)",
    borderRadius: 8,
    fontSize: 14,
    background: "var(--surface)",
    color: "var(--text-primary)",
    outline: "none",
    transition: "border-color 0.15s",
  },
  btn: {
    background: "#38AE5F",
    color: "#fff",
    border: "none",
    borderRadius: 10,
    padding: "12px 20px",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
    transition: "background 0.15s",
  },
};
