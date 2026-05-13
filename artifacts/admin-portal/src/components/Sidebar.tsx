import React from "react";
import { NavLink } from "react-router-dom";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: "⊞" },
  { to: "/homeowners", label: "Homeowners", icon: "⌂" },
  { to: "/providers", label: "Providers", icon: "◈" },
  { to: "/partners", label: "Partners", icon: "★" },
  { to: "/support", label: "Support Tickets", icon: "◎" },
  { to: "/broadcasts", label: "Broadcasts", icon: "◉" },
  { to: "/analytics", label: "Analytics", icon: "▣" },
  { to: "/audit-logs", label: "Audit Logs", icon: "▤" },
  { to: "/settings", label: "Settings", icon: "◑" },
];

export default function Sidebar() {
  return (
    <aside style={styles.aside}>
      <div style={styles.brand}>
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
        <div style={{ ...styles.logoFallback, display: "none" }}>
          <span style={styles.logoText}>HB</span>
        </div>
        <div>
          <div style={styles.brandName}>HomeBase</div>
          <div style={styles.brandSub}>Admin Portal</div>
        </div>
      </div>

      <nav style={styles.nav}>
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            style={({ isActive }) => ({
              ...styles.navItem,
              ...(isActive ? styles.navItemActive : {}),
            })}
          >
            <span style={styles.navIcon}>{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

const styles: Record<string, React.CSSProperties> = {
  aside: {
    width: "var(--sidebar-width)",
    flexShrink: 0,
    background: "var(--surface)",
    borderRight: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    position: "sticky",
    top: 0,
    overflow: "hidden",
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "18px 16px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  logoImg: {
    height: 32,
    width: "auto",
    flexShrink: 0,
    objectFit: "contain",
  },
  logoFallback: {
    width: 32,
    height: 32,
    borderRadius: 8,
    background: "#38AE5F",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  logoText: { color: "#fff", fontWeight: 700, fontSize: 13 },
  brandName: { fontWeight: 700, fontSize: 13, color: "var(--text-primary)" },
  brandSub: { fontSize: 10, color: "var(--text-muted)", marginTop: 1 },
  nav: {
    flex: 1,
    padding: "12px 8px",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    overflowY: "auto",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 12px",
    borderRadius: 8,
    color: "var(--text-secondary)",
    fontSize: 13,
    fontWeight: 500,
    textDecoration: "none",
    transition: "all 0.15s",
    cursor: "pointer",
  },
  navItemActive: {
    background: "var(--accent-light)",
    color: "#38AE5F",
    fontWeight: 600,
  },
  navIcon: { fontSize: 15, width: 18, textAlign: "center", flexShrink: 0 },
};
