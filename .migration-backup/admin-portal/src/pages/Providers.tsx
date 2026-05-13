import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import Table from "../components/Table";
import { Column } from "../components/Table";
import SearchInput from "../components/SearchInput";
import Pagination from "../components/Pagination";
import { SkeletonRow } from "../components/Skeleton";
import Badge, { subscriptionBadge } from "../components/Badge";
import { AdminProviderRow } from "../types";
import { format } from "date-fns";

const LIMIT = 25;

interface ProvidersProps {
  partnerOnly?: boolean;
}

export default function Providers({ partnerOnly = false }: ProvidersProps) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [subFilter, setSubFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [sortBy, setSortBy] = useState("");

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setOffset(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/providers", debouncedSearch, subFilter, activeFilter, partnerFilter, sortBy, partnerOnly, offset],
    queryFn: () =>
      api.get("/api/admin/providers", {
        params: {
          q: debouncedSearch || undefined,
          subscriptionStatus: subFilter || undefined,
          isPartner: partnerOnly ? "true" : (partnerFilter || undefined),
          isActive: activeFilter || undefined,
          sortBy: sortBy || undefined,
          limit: LIMIT,
          offset,
        },
      }).then((r) => r.data),
  });

  const providers: AdminProviderRow[] = data?.providers || [];

  const columns: Column<AdminProviderRow>[] = [
    {
      key: "businessName", label: "Business", render: (r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.businessName || "—"}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.email || ""}</div>
        </div>
      ),
    },
    {
      key: "subscriptionStatus", label: "Subscription",
      render: (r) => subscriptionBadge((r.subscriptionStatus as string) || "free"),
    },
    {
      key: "isPartner", label: "Partner",
      render: (r) => r.isPartner ? <Badge label="PARTNER" variant="green" /> : <span style={{ color: "var(--text-muted)" }}>—</span>,
    },
    {
      key: "isActive", label: "Active",
      render: (r) => <Badge label={r.isActive ? "Active" : "Inactive"} variant={r.isActive ? "green" : "gray"} />,
    },
    {
      key: "bookingCount", label: "Bookings",
      render: (r) => String(r.bookingCount ?? 0),
    },
    {
      key: "totalRevenueCents", label: "Revenue",
      render: (r) => r.totalRevenueCents != null ? `$${(Number(r.totalRevenueCents) / 100).toLocaleString()}` : "—",
    },
    {
      key: "averageRating", label: "Rating",
      render: (r) => r.averageRating != null ? Number(r.averageRating).toFixed(1) : "—",
    },
    {
      key: "createdAt", label: "Created",
      render: (r) => r.createdAt ? format(new Date(r.createdAt as string), "MMM d, yyyy") : "—",
    },
  ];

  return (
    <Layout>
      {partnerOnly && (
        <div style={styles.partnerBanner}>
          HomeBase Partners — Providers with complimentary Pro access
        </div>
      )}
      <PageHeader
        title={partnerOnly ? "HomeBase Partners" : "Providers"}
        subtitle={data?.total != null ? `${data.total} providers` : ""}
      />
      <div style={styles.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search providers..." style={{ width: 280 }} />
        <select
          value={subFilter}
          onChange={(e) => { setSubFilter(e.target.value); setOffset(0); }}
          style={styles.select}
        >
          <option value="">All Subscriptions</option>
          <option value="subscribed">Subscribed</option>
          <option value="grace_period">Grace Period</option>
          <option value="free">Free</option>
          <option value="expired">Expired</option>
        </select>
        <select
          value={activeFilter}
          onChange={(e) => { setActiveFilter(e.target.value); setOffset(0); }}
          style={styles.select}
        >
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        {!partnerOnly && (
          <select
            value={partnerFilter}
            onChange={(e) => { setPartnerFilter(e.target.value); setOffset(0); }}
            style={styles.select}
          >
            <option value="">All Partners</option>
            <option value="true">Partners only</option>
            <option value="false">Non-partners</option>
          </select>
        )}
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setOffset(0); }}
          style={styles.select}
        >
          <option value="">Sort: Default</option>
          <option value="bookings">Sort: Most Bookings</option>
          <option value="revenue">Sort: Most Revenue</option>
        </select>
      </div>
      <div style={styles.tableWrap}>
        {isLoading ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}</tbody>
          </table>
        ) : (
          <Table<AdminProviderRow>
            columns={columns}
            rows={providers}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/providers/${r.id}`)}
            emptyMessage={partnerOnly ? "No partners found" : "No providers found"}
          />
        )}
      </div>
      <Pagination
        offset={offset}
        limit={LIMIT}
        total={data?.total}
        onPrev={() => setOffset((o) => Math.max(0, o - LIMIT))}
        onNext={() => setOffset((o) => o + LIMIT)}
      />
    </Layout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  partnerBanner: {
    background: "rgba(56,174,95,0.12)",
    border: "1px solid rgba(56,174,95,0.3)",
    borderRadius: 8,
    padding: "10px 16px",
    color: "#38AE5F",
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 20,
  },
  toolbar: { display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  select: {
    padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6,
    background: "var(--surface)", color: "var(--text-primary)", fontSize: 13,
  },
  tableWrap: { borderRadius: 8, overflow: "hidden" },
};
