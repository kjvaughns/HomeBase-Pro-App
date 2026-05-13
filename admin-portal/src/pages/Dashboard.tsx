import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import StatCard from "../components/StatCard";
import { SkeletonCard } from "../components/Skeleton";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

function useDashboard() {
  return useQuery({
    queryKey: ["/api/admin/stats"],
    queryFn: () => api.get("/api/admin/stats").then((r) => r.data),
  });
}

export default function Dashboard() {
  const { data, isLoading } = useDashboard();
  const navigate = useNavigate();

  const stats = data?.stats || {};
  const recentSignups = data?.recentSignups || [];
  const recentBookings = data?.recentBookings || [];

  const cards = [
    { label: "Total Homeowners", value: stats.totalUsers ?? "-" },
    { label: "Total Providers", value: stats.totalProviders ?? "-" },
    { label: "Active Providers", value: stats.activeProviders ?? "-", accent: true },
    { label: "Inactive Providers", value: stats.inactiveProviders ?? "-" },
    { label: "HomeBase Partners", value: stats.partnerProviders ?? "-" },
    { label: "Total Appointments", value: stats.totalAppointments ?? "-" },
    { label: "Total Jobs", value: stats.totalJobs ?? "-" },
    { label: "Total Revenue", value: stats.totalRevenueCents != null ? `$${(stats.totalRevenueCents / 100).toLocaleString("en-US", { minimumFractionDigits: 2 })}` : "-" },
    { label: "Open Tickets", value: stats.openTickets ?? "-" },
    { label: "Total Tickets", value: stats.totalTickets ?? "-" },
  ];

  return (
    <Layout>
      <PageHeader title="Dashboard" subtitle="HomeBase platform overview" />

      <div style={styles.grid}>
        {isLoading
          ? Array.from({ length: 10 }).map((_, i) => <SkeletonCard key={i} />)
          : cards.map((c) => (
              <StatCard key={c.label} label={c.label} value={c.value} accent={c.accent} />
            ))}
      </div>

      <div style={styles.panels}>
        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Recent Signups</h2>
          {isLoading ? (
            <div style={{ padding: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--skeleton-base)", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 12, width: "55%", borderRadius: 4, background: "var(--skeleton-base)", marginBottom: 6 }} />
                    <div style={{ height: 10, width: "70%", borderRadius: 4, background: "var(--skeleton-base)" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : recentSignups.length === 0 ? (
            <div style={styles.empty}>No recent signups</div>
          ) : (
            recentSignups.map((u: { id: string; email: string; firstName: string | null; lastName: string | null; createdAt: string }) => (
              <div
                key={u.id}
                style={styles.listItem}
                onClick={() => navigate(`/homeowners/${u.id}`)}
              >
                <div style={styles.avatar}>{(u.firstName || u.email || "?")[0].toUpperCase()}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.itemName}>
                    {[u.firstName, u.lastName].filter(Boolean).join(" ") || u.email}
                  </div>
                  <div style={styles.itemSub}>{u.email}</div>
                </div>
                <div style={styles.itemDate}>
                  {u.createdAt ? format(new Date(u.createdAt), "MMM d, yyyy") : ""}
                </div>
              </div>
            ))
          )}
        </div>

        <div style={styles.panel}>
          <h2 style={styles.panelTitle}>Recent Bookings</h2>
          {isLoading ? (
            <div style={{ padding: 8 }}>
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--skeleton-base)", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ height: 12, width: "60%", borderRadius: 4, background: "var(--skeleton-base)", marginBottom: 6 }} />
                    <div style={{ height: 10, width: "40%", borderRadius: 4, background: "var(--skeleton-base)" }} />
                  </div>
                </div>
              ))}
            </div>
          ) : recentBookings.length === 0 ? (
            <div style={styles.empty}>No recent bookings</div>
          ) : (
            recentBookings.map((b: { id: string; scheduledDate: string | null; status: string; providerName: string | null; homeownerName: string | null }) => (
              <div key={b.id} style={styles.listItem}>
                <div style={styles.bookingDot} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.itemName}>
                    {b.homeownerName || "Homeowner"} → {b.providerName || "Provider"}
                  </div>
                  <div style={styles.itemSub}>
                    {b.scheduledDate ? format(new Date(b.scheduledDate), "MMM d, yyyy") : "No date"} · {b.status}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 16,
    marginBottom: 32,
  },
  panels: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 24,
  },
  panel: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    overflow: "hidden",
  },
  panelTitle: {
    margin: 0,
    padding: "16px 20px",
    fontSize: 14,
    fontWeight: 600,
    color: "var(--text-primary)",
    borderBottom: "1px solid var(--border)",
  },
  listItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 20px",
    borderBottom: "1px solid var(--border-light)",
    cursor: "pointer",
    transition: "background 0.1s",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "var(--accent-light)",
    color: "#38AE5F",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 13,
    fontWeight: 600,
    flexShrink: 0,
  },
  bookingDot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "#38AE5F",
    flexShrink: 0,
  },
  itemName: { fontSize: 13, fontWeight: 500, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  itemSub: { fontSize: 12, color: "var(--text-muted)", marginTop: 1 },
  itemDate: { fontSize: 12, color: "var(--text-muted)", flexShrink: 0 },
  empty: { padding: "32px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 },
};
