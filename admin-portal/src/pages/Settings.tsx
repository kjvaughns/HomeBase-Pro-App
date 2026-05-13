import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api, getApiErrorMessage } from "../api/client";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { useAuth } from "../contexts/AuthContext";
import { useToast } from "../contexts/ToastContext";

export default function Settings() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwError, setPwError] = useState("");

  const changePwMutation = useMutation({
    mutationFn: (data: { currentPassword: string; newPassword: string }) =>
      api.post("/api/auth/change-password", data),
    onSuccess: () => {
      addToast("Password changed successfully", "success");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPwError("");
    },
    onError: (err) => {
      setPwError(getApiErrorMessage(err));
    },
  });

  const handlePasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setPwError("");
    if (newPassword !== confirmPassword) {
      setPwError("New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      setPwError("New password must be at least 8 characters");
      return;
    }
    changePwMutation.mutate({ currentPassword, newPassword });
  };

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ") || "Admin";

  return (
    <Layout>
      <PageHeader title="Settings" subtitle="Manage your admin account" />

      <div style={styles.grid}>
        {/* Profile Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Admin Profile</h2>
          <div style={styles.profileRow}>
            <div style={styles.avatar}>
              {(user?.firstName || user?.email || "A")[0].toUpperCase()}
            </div>
            <div>
              <div style={styles.name}>{fullName}</div>
              <div style={styles.email}>{user?.email}</div>
              <div style={styles.badge}>Admin</div>
            </div>
          </div>
          <div style={styles.fields}>
            <Field label="First Name" value={user?.firstName || "—"} />
            <Field label="Last Name" value={user?.lastName || "—"} />
            <Field label="Email" value={user?.email || "—"} />
            <Field label="User ID" value={user?.id || "—"} mono />
          </div>
        </div>

        {/* Password Card */}
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Change Password</h2>
          {pwError && <div style={styles.errorBox}>{pwError}</div>}
          <form onSubmit={handlePasswordChange} style={styles.form}>
            <div style={styles.field}>
              <label style={styles.label}>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                style={styles.input}
                placeholder="Min. 8 characters"
                required
              />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={styles.input}
                required
              />
            </div>
            <button type="submit" style={styles.btn} disabled={changePwMutation.isPending}>
              {changePwMutation.isPending ? "Changing..." : "Change Password"}
            </button>
          </form>
        </div>
      </div>

      {/* About */}
      <div style={{ ...styles.card, marginTop: 20 }}>
        <h2 style={styles.cardTitle}>About</h2>
        <div style={styles.aboutRow}>
          <span style={styles.aboutLabel}>Portal Version</span>
          <span style={styles.aboutValue}>1.0.0</span>
        </div>
        <div style={styles.aboutRow}>
          <span style={styles.aboutLabel}>Backend</span>
          <span style={styles.aboutValue}>HomeBase Express API</span>
        </div>
      </div>
    </Layout>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ padding: "10px 0", borderBottom: "1px solid var(--border-light)", display: "flex", justifyContent: "space-between", gap: 16 }}>
      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{label}</span>
      <span style={{ fontSize: 13, color: "var(--text-primary)", fontFamily: mono ? "monospace" : "inherit" }}>{value}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 24 },
  cardTitle: { margin: "0 0 20px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" },
  profileRow: { display: "flex", gap: 16, alignItems: "center", marginBottom: 24 },
  avatar: {
    width: 52, height: 52, borderRadius: "50%", background: "#38AE5F",
    color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 20, fontWeight: 700, flexShrink: 0,
  },
  name: { fontSize: 16, fontWeight: 700, color: "var(--text-primary)" },
  email: { fontSize: 13, color: "var(--text-muted)", marginTop: 2 },
  badge: {
    marginTop: 6, display: "inline-block", padding: "2px 8px",
    background: "rgba(56,174,95,0.1)", color: "#38AE5F",
    borderRadius: 4, fontSize: 11, fontWeight: 600,
  },
  fields: { display: "flex", flexDirection: "column" },
  errorBox: {
    background: "var(--danger-light)", color: "var(--danger)", borderRadius: 6,
    padding: "10px 14px", fontSize: 13, marginBottom: 16, border: "1px solid rgba(239,68,68,0.2)",
  },
  form: { display: "flex", flexDirection: "column", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: "var(--text-secondary)" },
  input: {
    padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 6,
    background: "var(--surface)", color: "var(--text-primary)", fontSize: 14, outline: "none",
  },
  btn: {
    padding: "10px 20px", background: "#38AE5F", color: "#fff", border: "none",
    borderRadius: 7, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 4,
  },
  aboutRow: { display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border-light)" },
  aboutLabel: { fontSize: 13, color: "var(--text-muted)" },
  aboutValue: { fontSize: 13, color: "var(--text-primary)" },
};
