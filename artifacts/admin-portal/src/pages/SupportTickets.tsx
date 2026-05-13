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
import { priorityBadge, ticketStatusBadge } from "../components/Badge";
import { AdminTicketRow } from "../types";
import { format } from "date-fns";
import { useToast } from "../contexts/ToastContext";

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
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [statusFilter, setStatusFilter] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmBulkClose, setConfirmBulkClose] = useState(false);
  const [confirmSingleClose, setConfirmSingleClose] = useState<string | null>(null);

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

  const closeMutation = useMutation({
    mutationFn: (ids: string[]) =>
      Promise.all(ids.map((id) => api.patch(`/api/admin/support-tickets/${id}`, { status: "closed" }))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/support-tickets"] });
      addToast("Ticket(s) closed", "success");
      setSelectedIds(new Set());
      setConfirmBulkClose(false);
      setConfirmSingleClose(null);
    },
    onError: (err) => addToast(getApiErrorMessage(err), "error"),
  });

  const tickets: AdminTicketRow[] = data?.tickets || [];
  const selectedCount = selectedIds.size;

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
    { key: "userType", label: "Type", render: (r) => (r.userType as string | null) || "—" },
    { key: "category", label: "Category", render: (r) => (r.category as string | null) || "—" },
    { key: "priority", label: "Priority", render: (r) => priorityBadge((r.priority as string) || "normal") },
    { key: "status", label: "Status", render: (r) => ticketStatusBadge(r.status as string) },
    {
      key: "createdAt", label: "Created",
      render: (r) => r.createdAt ? format(new Date(r.createdAt as string), "MMM d, yyyy") : "—",
    },
    {
      key: "updatedAt", label: "Updated",
      render: (r) => r.updatedAt ? format(new Date(r.updatedAt as string), "MMM d") : "—",
    },
    {
      key: "actions", label: "Actions",
      render: (r) => (
        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <button style={btnStyle("neutral")} onClick={() => navigate(`/support/${r.id}`)}>View</button>
          {(r.status as string) !== "closed" && (
            <button style={btnStyle("danger")} onClick={() => setConfirmSingleClose(r.id)}>Close</button>
          )}
        </div>
      ),
    },
  ];

  return (
    <Layout>
      <PageHeader title="Support Tickets" subtitle={data?.total != null ? `${data.total} tickets` : ""} />

      {selectedCount > 0 && (
        <div style={styles.bulkBar}>
          <span style={styles.bulkCount}>{selectedCount} selected</span>
          <button style={styles.bulkClear} onClick={() => setSelectedIds(new Set())}>Clear</button>
          <button style={styles.bulkClose} onClick={() => setConfirmBulkClose(true)}>
            Close Selected
          </button>
        </div>
      )}

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

      <div style={styles.tableWrap}>
        {isLoading ? (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>{Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={9} />)}</tbody>
          </table>
        ) : (
          <Table
            columns={columns}
            rows={tickets}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/support/${r.id}`)}
            emptyMessage="No support tickets found"
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
        open={confirmBulkClose}
        title={`Close ${selectedCount} Ticket${selectedCount !== 1 ? "s" : ""}?`}
        message="These tickets will be marked as closed. Users will be notified."
        confirmLabel="Close Tickets"
        danger
        loading={closeMutation.isPending}
        onConfirm={() => closeMutation.mutate([...selectedIds])}
        onCancel={() => setConfirmBulkClose(false)}
      />

      <ConfirmModal
        open={confirmSingleClose !== null}
        title="Close Ticket?"
        message="This ticket will be marked as closed. The user will be notified."
        confirmLabel="Close Ticket"
        danger
        loading={closeMutation.isPending}
        onConfirm={() => confirmSingleClose && closeMutation.mutate([confirmSingleClose])}
        onCancel={() => setConfirmSingleClose(null)}
      />
    </Layout>
  );
}

function btnStyle(variant: "neutral" | "danger"): React.CSSProperties {
  if (variant === "danger") return {
    padding: "4px 10px", fontSize: 11, fontWeight: 500,
    border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6,
    background: "rgba(239,68,68,0.06)", color: "#ef4444", cursor: "pointer",
  };
  return {
    padding: "4px 10px", fontSize: 11, fontWeight: 500,
    border: "1px solid var(--border)", borderRadius: 6,
    background: "var(--surface-2)", color: "var(--text-secondary)", cursor: "pointer",
  };
}

const styles: Record<string, React.CSSProperties> = {
  bulkBar: {
    display: "flex", alignItems: "center", gap: 10,
    background: "rgba(56,174,95,0.08)", border: "1px solid rgba(56,174,95,0.2)",
    borderRadius: 8, padding: "10px 16px", marginBottom: 12,
  },
  bulkCount: { fontWeight: 600, fontSize: 13, color: "#38AE5F", flex: 1 },
  bulkClear: {
    padding: "5px 12px", fontSize: 12, border: "1px solid var(--border)",
    borderRadius: 6, background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer",
  },
  bulkClose: {
    padding: "5px 12px", fontSize: 12, border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 6, background: "rgba(239,68,68,0.06)", color: "#ef4444", cursor: "pointer", fontWeight: 500,
  },
  statusTabs: { display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)" },
  statusTab: {
    padding: "8px 16px", border: "none", borderBottom: "2px solid transparent",
    background: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontWeight: 500, marginBottom: -1,
  },
  statusTabActive: { color: "#38AE5F", borderBottomColor: "#38AE5F" },
  toolbar: { display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  select: {
    padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8,
    background: "var(--surface)", color: "var(--text-primary)", fontSize: 13,
  },
  tableWrap: { borderRadius: 10, overflow: "hidden", marginBottom: 16 },
};
