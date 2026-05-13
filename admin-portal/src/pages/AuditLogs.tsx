import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import { SkeletonRow } from "../components/Skeleton";
import { AdminAuditLogRow } from "../types";
import { format } from "date-fns";

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
  const [action, setAction] = useState("");
  const [adminUserIdFilter, setAdminUserIdFilter] = useState("");
  const [debouncedAdminId, setDebouncedAdminId] = useState("");
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [offset, setOffset] = useState(0);

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

  const logs: AdminAuditLogRow[] = data?.logs || [];

  return (
    <Layout>
      <PageHeader
        title="Audit Logs"
        subtitle={data?.total != null ? `${data.total} entries` : "Immutable record of all admin actions"}
      />

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
              {["Admin", "Action", "Target Type", "Target ID", "Before", "After", "Timestamp"].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 10 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
            ) : logs.length === 0 ? (
              <tr><td colSpan={7} style={styles.empty}>No audit log entries</td></tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
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
                </tr>
              ))
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
    </Layout>
  );
}

const styles: Record<string, React.CSSProperties> = {
  filters: { display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap", alignItems: "center" },
  select: { padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text-primary)", fontSize: 13 },
  textInput: { padding: "7px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text-primary)", fontSize: 13, outline: "none", width: 220 },
  dateRange: { display: "flex", alignItems: "center", gap: 8 },
  dateLabel: { fontSize: 12, color: "var(--text-muted)" },
  dateInput: { padding: "7px 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text-primary)", fontSize: 13 },
  clearBtn: { padding: "6px 12px", background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--text-muted)", cursor: "pointer", fontSize: 12 },
  tableWrap: { border: "1px solid var(--border)", borderRadius: 8, overflow: "auto", background: "var(--surface)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", whiteSpace: "nowrap" },
  td: { padding: "10px 14px", borderBottom: "1px solid var(--border-light)", color: "var(--text-primary)", verticalAlign: "middle", maxWidth: 220 },
  empty: { padding: "40px 14px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 },
  code: { fontFamily: "monospace", fontSize: 12, background: "var(--accent-light)", color: "#38AE5F", padding: "2px 6px", borderRadius: 4 },
  jsonCode: { fontFamily: "monospace", fontSize: 11, color: "var(--text-secondary)", wordBreak: "break-all" },
  targetId: { fontFamily: "monospace", fontSize: 11, color: "var(--text-muted)" },
};
