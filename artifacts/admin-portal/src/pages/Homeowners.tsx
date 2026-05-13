import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api, getApiErrorMessage } from "../api/client";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import Table from "../components/Table";
import { Column } from "../components/Table";
import SearchInput from "../components/SearchInput";
import Pagination from "../components/Pagination";
import { SkeletonRow } from "../components/Skeleton";
import ConfirmModal from "../components/ConfirmModal";
import { AdminUserRow } from "../types";
import { format } from "date-fns";
import { useToast } from "../contexts/ToastContext";

const LIMIT = 25;

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name_asc", label: "Name A-Z" },
  { value: "name_desc", label: "Name Z-A" },
];

export default function Homeowners() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [offset, setOffset] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [confirmSingleDelete, setConfirmSingleDelete] = useState<string | null>(null);

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

  const deactivateMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => api.patch(`/api/admin/users/${id}`, { isActive: false }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/users"] });
      addToast("Homeowner(s) deactivated", "success");
      setSelectedIds(new Set());
      setConfirmBulkDelete(false);
      setConfirmSingleDelete(null);
    },
    onError: (err) => addToast(getApiErrorMessage(err), "error"),
  });

  const users: AdminUserRow[] = data?.users || [];
  const selectedCount = selectedIds.size;

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
      key: "createdAt", label: "Signup",
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
    {
      key: "actions", label: "Actions",
      render: (r) => (
        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <button
            style={btnStyle("neutral")}
            onClick={() => navigate(`/homeowners/${r.id}`)}
          >
            View
          </button>
          <button
            style={btnStyle("danger")}
            onClick={() => setConfirmSingleDelete(r.id)}
          >
            Deactivate
          </button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <PageHeader title="Homeowners" subtitle={data?.total != null ? `${data.total} registered homeowners` : ""} />

      {selectedCount > 0 && (
        <div style={styles.bulkBar}>
          <span style={styles.bulkCount}>{selectedCount} selected</span>
          <button style={styles.bulkClear} onClick={() => setSelectedIds(new Set())}>Clear</button>
          <button style={styles.bulkDeactivate} onClick={() => setConfirmBulkDelete(true)}>
            Deactivate Selected
          </button>
        </div>
      )}

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
            <tbody>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={8} />)}</tbody>
          </table>
        ) : (
          <Table
            columns={columns}
            rows={users}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/homeowners/${r.id}`)}
            emptyMessage="No homeowners found"
            selectable
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
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

      <ConfirmModal
        open={confirmBulkDelete}
        title={`Deactivate ${selectedCount} Homeowner${selectedCount !== 1 ? "s" : ""}?`}
        message="These homeowners will be deactivated and will no longer have access to the app."
        confirmLabel="Deactivate"
        danger
        loading={deactivateMutation.isPending}
        onConfirm={() => deactivateMutation.mutate([...selectedIds])}
        onCancel={() => setConfirmBulkDelete(false)}
      />

      <ConfirmModal
        open={confirmSingleDelete !== null}
        title="Deactivate Homeowner?"
        message="This homeowner will be deactivated and will no longer have access to the app."
        confirmLabel="Deactivate"
        danger
        loading={deactivateMutation.isPending}
        onConfirm={() => confirmSingleDelete && deactivateMutation.mutate([confirmSingleDelete])}
        onCancel={() => setConfirmSingleDelete(null)}
      />
    </Layout>
  );
}

function btnStyle(variant: "neutral" | "danger"): React.CSSProperties {
  return {
    padding: "4px 10px",
    fontSize: 11,
    fontWeight: 500,
    border: variant === "danger" ? "1px solid rgba(239,68,68,0.3)" : "1px solid var(--border)",
    borderRadius: 6,
    background: variant === "danger" ? "rgba(239,68,68,0.06)" : "var(--surface-2)",
    color: variant === "danger" ? "#ef4444" : "var(--text-secondary)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

const styles: Record<string, React.CSSProperties> = {
  bulkBar: {
    position: "sticky", top: 0, zIndex: 10,
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "rgba(56,174,95,0.08)",
    border: "1px solid rgba(56,174,95,0.2)",
    borderRadius: 8,
    padding: "10px 16px",
    marginBottom: 12,
  },
  bulkCount: { fontWeight: 600, fontSize: 13, color: "#38AE5F", flex: 1 },
  bulkClear: {
    padding: "5px 12px", fontSize: 12, border: "1px solid var(--border)",
    borderRadius: 6, background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer",
  },
  bulkDeactivate: {
    padding: "5px 12px", fontSize: 12, border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 6, background: "rgba(239,68,68,0.06)", color: "#ef4444", cursor: "pointer",
    fontWeight: 500,
  },
  toolbar: { display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  select: {
    padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8,
    background: "var(--surface)", color: "var(--text-primary)", fontSize: 13, cursor: "pointer",
  },
  tableWrap: { borderRadius: 10, overflow: "hidden", marginBottom: 16 },
};
