import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getApiErrorMessage } from "../api/client";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import { SkeletonRow } from "../components/Skeleton";
import ConfirmModal from "../components/ConfirmModal";
import { AdminAuditLogRow } from "../types";
import { format } from "date-fns";
import { useToast } from "../contexts/ToastContext";

const LIMIT = 50;

const ACTION_TYPES = [
  { value: "", label: "All Actions" },
  { value: "partner.grant", label: "Partner Grant" },
  { value: "partner.revoke", label: "Partner Revoke" },
  { value: "broadcast.send", label: "Broadcast Send" },
  { value: "support_ticket.update", label: "Ticket Update" },
  { value: "provider.update", label: "Provider Update" },
  { value: "user.update", label: "User Update" },
];

export default function AuditLogs() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [action, setAction] = useState("");
  const [adminUserIdFilter, setAdminUserIdFilter] = useState("");
  const [debouncedAdminId, setDebouncedAdminId] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmSingleDelete, setConfirmSingleDelete] = useState<string | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedAdminId(adminUserIdFilter); setOffset(0); }, 500);
    return () => clearTimeout(t);
  }, [adminUserIdFilter]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/audit-logs", action, debouncedAdminId, since, until, offset],
    queryFn: () =>
      api.get("/api/admin/audit-logs", {
        params: {
          action: action || undefined,
          adminUserId: debouncedAdminId || undefined,
          since: since || undefined,
          until: until || undefined,
          limit: LIMIT,
          offset,
        },
      }).then((r) => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) =>
      api.delete("/api/admin/audit-logs", { data: { ids } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/audit-logs"] });
      addToast(`${selectedIds.size} log${selectedIds.size !== 1 ? "s" : ""} deleted`, "success");
      setSelectedIds(new Set());
      setConfirmDelete(false);
    },
    onError: (err) => addToast(getApiErrorMessage(err), "error"),
  });

  const logs: AdminAuditLogRow[] = data?.logs || [];
  const allSelected = logs.length > 0 && logs.every((l) => selectedIds.has(l.id));
  const someSelected = !allSelected && logs.some((l) => selectedIds.has(l.id));
  const selectedCount = selectedIds.size;

  const toggleAll = () => {
    if (allSelected) {
      const next = new Set(selectedIds);
      logs.forEach((l) => next.delete(l.id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      logs.forEach((l) => next.add(l.id));
      setSelectedIds(next);
    }
  };

  const toggleRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  return (
    <Layout>
      <PageHeader
        title="Audit Logs"
        subtitle={data?.total != null ? `${data.total} entries` : "Immutable record of all admin actions"}
      />

      {selectedCount > 0 && (
        <div style={styles.bulkBar}>
          <span style={styles.bulkCount}>{selectedCount} selected</span>
          <button style={styles.bulkClear} onClick={() => setSelectedIds(new Set())}>Clear</button>
          <button style={styles.bulkDelete} onClick={() => setConfirmDelete(true)}>
            Delete Selected
          </button>
        </div>
      )}

      <div style={styles.filters}>
        <select value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }} style={styles.select}>
          {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
        </select>

        <input
          type="text"
          value={adminUserIdFilter}
          onChange={(e) => setAdminUserIdFilter(e.target.value)}
          placeholder="Filter by admin user ID..."
          style={styles.textInput}
        />

        <div style={styles.dateRange}>
          <label style={styles.dateLabel}>From</label>
          <input type="date" value={since} onChange={(e) => { setSince(e.target.value); setOffset(0); }} style={styles.dateInput} />
          <label style={styles.dateLabel}>To</label>
          <input type="date" value={until} onChange={(e) => { setUntil(e.target.value); setOffset(0); }} style={styles.dateInput} />
          {(since || until) && (
            <button style={styles.clearBtn} onClick={() => { setSince(""); setUntil(""); }}>Clear</button>
          )}
        </div>
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: 44, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                />
              </th>
              {["Admin", "Action", "Target Type", "Target ID", "Before", "After", "Timestamp", ""].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={8} />)
            ) : logs.length === 0 ? (
              <tr><td colSpan={8} style={styles.empty}>No audit log entries</td></tr>
            ) : (
              logs.map((log) => {
                const isSelected = selectedIds.has(log.id);
                return (
                  <tr
                    key={log.id}
                    style={{ background: isSelected ? "rgba(56,174,95,0.06)" : undefined, transition: "background 0.1s" }}
                  >
                    <td style={{ ...styles.td, textAlign: "center", width: 44 }}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleRow(log.id)}
                      />
                    </td>

                    <td style={styles.td}>
                      <div style={{ fontWeight: 500 }}>{(log.adminName as string | null | undefined) || "—"}</div>
                      <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{(log.adminEmail as string | null | undefined) || ""}</div>
                    </td>
                    <td style={styles.td}>
                      <code style={styles.code}>{log.action}</code>
                    </td>
                    <td style={styles.td}>{(log.targetType as string | null) || "—"}</td>
                    <td style={styles.td}>
                      <span style={styles.targetId}>{log.targetId ? String(log.targetId).slice(0, 12) + "..." : "—"}</span>
                    </td>
                    <td style={styles.td}>
                      {log.beforeValue ? (
                        <code style={styles.jsonCode}>{JSON.stringify(log.beforeValue)}</code>
                      ) : "—"}
                    </td>
                    <td style={styles.td}>
                      {log.afterValue ? (
                        <code style={styles.jsonCode}>{JSON.stringify(log.afterValue)}</code>
                      ) : "—"}
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                        {log.createdAt ? format(new Date(log.createdAt as string), "MMM d, yyyy h:mm a") : "—"}
                      </span>
                    </td>
                    <td style={{ ...styles.td, width: 80 }}>
                      <button
                        style={styles.deleteRowBtn}
                        onClick={() => setConfirmSingleDelete(log.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        offset={offset}
        limit={LIMIT}
        total={data?.total}
        onPrev={() => setOffset((o) => Math.max(0, o - LIMIT))}
        onNext={() => setOffset((o) => o + LIMIT)}
      />

      <ConfirmModal
        open={confirmDelete}
        title={`Delete ${selectedCount} Log${selectedCount !== 1 ? "s" : ""}?`}
        message="These audit log entries will be permanently deleted and cannot be recovered."
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate([...selectedIds])}
        onCancel={() => setConfirmDelete(false)}
      />

      <ConfirmModal
        open={confirmSingleDelete !== null}
        title="Delete Log Entry?"
        message="This audit log entry will be permanently deleted and cannot be recovered."
        confirmLabel="Delete"
        danger
        loading={deleteMutation.isPending}
        onConfirm={() => confirmSingleDelete && deleteMutation.mutate([confirmSingleDelete])}
        onCancel={() => setConfirmSingleDelete(null)}
      />
    </Layout>
  );
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
  bulkDelete: {
    padding: "5px 12px", fontSize: 12, border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 6, background: "rgba(239,68,68,0.06)", color: "#ef4444", cursor: "pointer", fontWeight: 500,
  },
  filters: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" },
  select: { padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text-primary)", fontSize: 13 },
  textInput: { padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text-primary)", fontSize: 13, outline: "none", width: 220 },
  dateRange: { display: "flex", alignItems: "center", gap: 8 },
  dateLabel: { fontSize: 12, color: "var(--text-muted)" },
  dateInput: { padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text-primary)", fontSize: 13 },
  clearBtn: { padding: "6px 12px", background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer", fontSize: 12 },
  tableWrap: { border: "1px solid var(--border)", borderRadius: 10, overflow: "auto", background: "var(--surface)", boxShadow: "var(--shadow)", marginBottom: 16 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", whiteSpace: "nowrap", letterSpacing: "0.04em" },
  td: { padding: "10px 14px", borderBottom: "1px solid var(--border-light)", color: "var(--text-primary)", verticalAlign: "middle", maxWidth: 220 },
  deleteRowBtn: {
    padding: "3px 10px", fontSize: 11, fontWeight: 500,
    border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6,
    background: "rgba(239,68,68,0.06)", color: "#ef4444", cursor: "pointer",
  },
  empty: { padding: "40px 14px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 },
  code: { fontFamily: "monospace", fontSize: 12, background: "var(--accent-light)", color: "#38AE5F", padding: "2px 6px", borderRadius: 4 },
  jsonCode: { fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)", wordBreak: "break-all" },
  targetId: { fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" },
};
