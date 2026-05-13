import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import Badge from "../components/Badge";
import { SkeletonRow } from "../components/Skeleton";

const PERIODS = [
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "365d", label: "Last year" },
];

const CATEGORIES = [
  "", "Plumbing", "Electrical", "HVAC", "Landscaping", "Cleaning",
  "Roofing", "Painting", "Carpentry", "Flooring", "General",
];

interface ProviderAnalyticsRow {
  id: string;
  businessName: string | null;
  city?: string | null;
  state?: string | null;
  bookingCount: number;
  totalRevenueCents: number;
  avgRating?: number | null;
  reviewCount?: number | null;
  isPartner: boolean;
  subscriptionStatus: string | null;
}

export default function Analytics() {
  const navigate = useNavigate();
  const [period, setPeriod] = useState("30d");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const [debouncedCity, setDebouncedCity] = useState("");
  const [partnerOnly, setPartnerOnly] = useState(false);
  const [subscribedOnly, setSubscribedOnly] = useState(false);

  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedCity(city), 400);
    return () => clearTimeout(t);
  }, [city]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/analytics/top-providers", period, debouncedCity, category, partnerOnly, subscribedOnly],
    queryFn: () =>
      api.get("/api/admin/analytics/top-providers", {
        params: {
          period,
          city: debouncedCity || undefined,
          category: category || undefined,
          partner: partnerOnly ? "true" : undefined,
          subscribed: subscribedOnly ? "true" : undefined,
          limit: 50,
        },
      }).then((r) => r.data),
  });

  const providers: ProviderAnalyticsRow[] = data?.providers || [];

  const exportCsv = () => {
    const headers = ["Rank", "Business Name", "City", "Bookings", "Revenue", "Avg Rating", "Reviews", "Partner", "Subscription"];
    const rows = providers.map((p, i) => [
      i + 1,
      `"${p.businessName || ""}"`,
      `"${[p.city, p.state].filter(Boolean).join(", ")}"`,
      p.bookingCount ?? 0,
      p.totalRevenueCents != null ? (p.totalRevenueCents / 100).toFixed(2) : 0,
      p.avgRating != null ? Number(p.avgRating).toFixed(1) : "",
      p.reviewCount ?? 0,
      p.isPartner ? "Yes" : "No",
      p.subscriptionStatus || "",
    ]);
    const csv = [headers, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `homebase-top-providers-${period}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <PageHeader
        title="Analytics — Top Providers"
        action={
          <button style={styles.exportBtn} onClick={exportCsv} disabled={providers.length === 0}>
            Export CSV
          </button>
        }
      />

      <div style={styles.filters}>
        <div style={styles.filterGroup}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              style={{ ...styles.periodBtn, ...(period === p.value ? styles.periodBtnActive : {}) }}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>

        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Filter by city..."
          style={styles.input}
        />

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          style={styles.select}
        >
          <option value="">All Categories</option>
          {CATEGORIES.filter(Boolean).map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <label style={styles.checkLabel}>
          <input type="checkbox" checked={partnerOnly} onChange={(e) => setPartnerOnly(e.target.checked)} />
          Partners only
        </label>
        <label style={styles.checkLabel}>
          <input type="checkbox" checked={subscribedOnly} onChange={(e) => setSubscribedOnly(e.target.checked)} />
          Subscribed only
        </label>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {["#", "Business Name", "City", "Bookings", "Revenue", "Avg Rating", "Reviews", "Partner", "Subscription"].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)
            ) : providers.length === 0 ? (
              <tr><td colSpan={9} style={styles.empty}>No provider data for this period</td></tr>
            ) : (
              providers.map((p, i) => (
                <tr
                  key={p.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/providers/${p.id}`)}
                >
                  <td style={{ ...styles.td, fontWeight: 700, color: i < 3 ? "#38AE5F" : "var(--text-secondary)" }}>
                    {i + 1}
                  </td>
                  <td style={styles.td}>
                    <div style={{ fontWeight: 500 }}>{p.businessName || "—"}</div>
                  </td>
                  <td style={styles.td}>{[p.city, p.state].filter(Boolean).join(", ") || "—"}</td>
                  <td style={styles.td}>{p.bookingCount ?? 0}</td>
                  <td style={styles.td}>{p.totalRevenueCents != null ? `$${(p.totalRevenueCents / 100).toLocaleString()}` : "—"}</td>
                  <td style={styles.td}>{p.avgRating != null ? Number(p.avgRating).toFixed(1) : "—"}</td>
                  <td style={styles.td}>{p.reviewCount ?? 0}</td>
                  <td style={styles.td}>{p.isPartner ? <Badge label="PARTNER" variant="green" size="sm" /> : "—"}</td>
                  <td style={styles.td}><Badge label={p.subscriptionStatus || "free"} variant={p.subscriptionStatus === "subscribed" ? "green" : "gray"} size="sm" /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </Layout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  exportBtn: { padding: "8px 18px", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 7, fontSize: 13, fontWeight: 500, cursor: "pointer", color: "var(--text-secondary)" },
  filters: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" },
  filterGroup: { display: "flex", gap: 4, background: "var(--surface-2)", borderRadius: 7, padding: 3, border: "1px solid var(--border)" },
  periodBtn: { padding: "5px 12px", borderRadius: 5, border: "none", background: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 12, fontWeight: 500 },
  periodBtnActive: { background: "var(--surface)", color: "var(--text-primary)", boxShadow: "0 1px 3px rgba(0,0,0,0.1)" },
  input: { padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text-primary)", fontSize: 13, outline: "none" },
  select: { padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text-primary)", fontSize: 13 },
  checkLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-secondary)", cursor: "pointer" },
  tableWrap: { border: "1px solid var(--border)", borderRadius: 8, overflow: "auto", background: "var(--surface)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", whiteSpace: "nowrap" },
  td: { padding: "11px 14px", borderBottom: "1px solid var(--border-light)", color: "var(--text-primary)", verticalAlign: "middle" },
  empty: { padding: "40px 14px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 },
};
