import React from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

export default function TopBar() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <header style={styles.bar}>
      <div style={styles.left} />
      <div style={styles.right}>
        <button onClick={toggle} style={styles.themeBtn} title="Toggle theme">
          {theme === "light" ? (
            <span style={styles.icon}>&#9790;</span>
          ) : (
            <span style={styles.icon}>&#9728;</span>
          )}
          {theme === "light" ? "Dark" : "Light"}
        </button>
        <div style={styles.divider} />
        <div style={styles.userChip}>
          <div style={styles.avatar}>
            {(user?.firstName?.[0] || user?.email?.[0] || "A").toUpperCase()}
          </div>
          <span style={styles.userName}>
            {[user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Admin"}
          </span>
        </div>
        <button onClick={handleLogout} style={styles.logoutBtn}>
          Sign out
        </button>
      </div>
    </header>
  );
}

const styles: Record<string, React.CSSProperties> = {
  bar: {
    height: 52,
    background: "var(--surface)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    flexShrink: 0,
    position: "sticky",
    top: 0,
    zIndex: 10,
  },
  left: { flex: 1 },
  right: {
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  themeBtn: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    padding: "5px 10px",
    background: "var(--surface-2)",
    border: "1px solid var(--border)",
    borderRadius: 6,
    fontSize: 12,
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontWeight: 500,
  },
  icon: { fontSize: 13 },
  divider: {
    width: 1,
    height: 20,
    background: "var(--border)",
  },
  userChip: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#38AE5F",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  userName: {
    fontSize: 13,
    fontWeight: 500,
    color: "var(--text-primary)",
    maxWidth: 160,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  logoutBtn: {
    background: "none",
    border: "1px solid var(--border)",
    borderRadius: 6,
    padding: "5px 12px",
    fontSize: 12,
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontWeight: 500,
  },
};
