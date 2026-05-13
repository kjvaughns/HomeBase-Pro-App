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
import { AdminUserRow } from "../types";
import { format } from "date-fns";

const LIMIT = 25;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
];

export default function Homeowners() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [offset, setOffset] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setOffset(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/users", "homeowner", debouncedSearch, sortBy, offset],
    queryFn: () =>
      api.get("/api/admin/users", {
        params: { role: "homeowner", q: debouncedSearch || undefined, sortBy, limit: LIMIT, offset },
      }).then((r) => r.data),
  });

  const users: AdminUserRow[] = data?.users || [];

  const columns: Column<AdminUserRow>[] = [
    {
      key: "name", label: "Name",
      render: (r) => (
        <span style={{ fontWeight: 500 }}>
          {[r.firstName, r.lastName].filter(Boolean).join(" ") || r.email}
        </span>
      ),
    },
    { key: "email", label: "Email" },
    {
      key: "phone", label: "Phone",
      render: (r) => r.phone ? String(r.phone) : <span style={{ color: "var(--text-muted)" }}>—</span>,
    },
    {
      key: "createdAt", label: "Signup Date",
      render: (r) => r.createdAt ? format(new Date(r.createdAt as string), "MMM d, yyyy") : "—",
    },
    {
      key: "homeCount", label: "Homes",
      render: (r) => String(r.homeCount ?? 0),
    },
    {
      key: "bookingCount", label: "Bookings",
      render: (r) => String(r.bookingCount ?? 0),
    },
    {
      key: "creditBalance", label: "Credits",
      render: (r) =>
        r.creditBalanceCents != null
          ? `$${(Number(r.creditBalanceCents) / 100).toFixed(2)}`
          : "—",
    },
  ];

  return (
    <Layout>
      <PageHeader title="Homeowners" subtitle={data?.total != null ? `${data.total} registered homeowners` : ""} />
      <div style={styles.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name or email..." style={{ width: 300 }} />
        <select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setOffset(0); }}
          style={styles.select}
        >
          {SORT_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>
      <div style={styles.tableWrap}>
        {isLoading ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={7} />)}</tbody>
          </table>
        ) : (
          <Table
            columns={columns}
            rows={users}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/homeowners/${r.id}`)}
            emptyMessage="No homeowners found"
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
  toolbar: { display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" },
  select: {
    padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6,
    background: "var(--surface)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer",
  },
  tableWrap: { borderRadius: 8, overflow: "hidden" },
};
