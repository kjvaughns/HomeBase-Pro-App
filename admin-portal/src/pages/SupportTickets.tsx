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
import { priorityBadge, ticketStatusBadge } from "../components/Badge";
import { AdminTicketRow } from "../types";
import { format } from "date-fns";

const LIMIT = 25;

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "Pending" },
  { value: "resolved", label: "Resolved" },
  { value: "closed", label: "Closed" },
];

export default function SupportTickets() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setOffset(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/support-tickets", statusFilter, userTypeFilter, debouncedSearch, offset],
    queryFn: () =>
      api.get("/api/admin/support-tickets", {
        params: {
          status: statusFilter || undefined,
          userType: userTypeFilter || undefined,
          q: debouncedSearch || undefined,
          limit: LIMIT,
          offset,
        },
      }).then((r) => r.data),
  });

  const tickets: AdminTicketRow[] = data?.tickets || [];

  const columns: Column<AdminTicketRow>[] = [
    {
      key: "subject", label: "Subject",
      render: (r) => <span style={{ fontWeight: 500, color: "var(--text-primary)" }}>{r.subject}</span>,
    },
    {
      key: "userName", label: "User",
      render: (r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{(r.name as string | null) || r.email || "—"}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.email}</div>
        </div>
      ),
    },
    {
      key: "userType", label: "Type",
      render: (r) => (r.userType as string | null) || "—",
    },
    {
      key: "category", label: "Category",
      render: (r) => (r.category as string | null) || "—",
    },
    {
      key: "priority", label: "Priority",
      render: (r) => priorityBadge((r.priority as string) || "normal"),
    },
    {
      key: "status", label: "Status",
      render: (r) => ticketStatusBadge(r.status as string),
    },
    {
      key: "createdAt", label: "Created",
      render: (r) => r.createdAt ? format(new Date(r.createdAt as string), "MMM d, yyyy") : "—",
    },
    {
      key: "updatedAt", label: "Updated",
      render: (r) => r.updatedAt ? format(new Date(r.updatedAt as string), "MMM d") : "—",
    },
  ];

  return (
    <Layout>
      <PageHeader title="Support Tickets" subtitle={data?.total != null ? `${data.total} tickets` : ""} />

      <div style={styles.statusTabs}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            style={{ ...styles.statusTab, ...(statusFilter === tab.value ? styles.statusTabActive : {}) }}
            onClick={() => { setStatusFilter(tab.value); setOffset(0); }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={styles.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by subject or email..." style={{ width: 300 }} />
        <select value={userTypeFilter} onChange={(e) => { setUserTypeFilter(e.target.value); setOffset(0); }} style={styles.select}>
          <option value="">All User Types</option>
          <option value="homeowner">Homeowner</option>
          <option value="provider">Provider</option>
        </select>
      </div>

      {isLoading ? (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <tbody>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}</tbody>
        </table>
      ) : (
        <Table<AdminTicketRow>
          columns={columns}
          rows={tickets}
          rowKey={(r) => r.id}
          onRowClick={(r) => navigate(`/support/${r.id}`)}
          emptyMessage="No support tickets found"
        />
      )}
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
  statusTabs: {
    display: "flex",
    gap: 4,
    marginBottom: 16,
    borderBottom: "1px solid var(--border)",
  },
  statusTab: {
    padding: "8px 16px",
    border: "none",
    borderBottom: "2px solid transparent",
    background: "none",
    color: "var(--text-secondary)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    marginBottom: -1,
  },
  statusTabActive: {
    color: "#38AE5F",
    borderBottomColor: "#38AE5F",
  },
  toolbar: { display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  select: {
    padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6,
    background: "var(--surface)", color: "var(--text-primary)", fontSize: 13,
  },
};
