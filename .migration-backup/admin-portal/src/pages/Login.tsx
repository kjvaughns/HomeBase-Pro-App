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
          <div style={styles.logo}>HB</div>
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
    borderRadius: 14,
    padding: "40px 44px",
    width: 420,
    maxWidth: "100%",
    boxShadow: "0 8px 30px rgba(0,0,0,0.08)",
  },
  logoRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    marginBottom: 32,
  },
  logo: {
    width: 44,
    height: 44,
    borderRadius: 10,
    background: "#38AE5F",
    color: "#fff",
    fontSize: 16,
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  brandName: { fontWeight: 700, fontSize: 16, color: "var(--text-primary)" },
  brandSub: { fontSize: 12, color: "var(--text-muted)", marginTop: 1 },
  heading: { margin: "0 0 4px", fontSize: 22, fontWeight: 700, color: "var(--text-primary)" },
  sub: { margin: "0 0 28px", fontSize: 14, color: "var(--text-muted)" },
  errorBox: {
    background: "var(--danger-light)",
    color: "var(--danger)",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 20,
  },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" },
  input: {
    padding: "10px 14px",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 14,
    background: "var(--surface)",
    color: "var(--text-primary)",
    outline: "none",
  },
  btn: {
    background: "#38AE5F",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "11px 20px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8,
  },
};
