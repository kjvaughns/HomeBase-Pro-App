import React, { useState, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getApiErrorMessage } from "../api/client";
import Layout from "../components/Layout";
import { priorityBadge, ticketStatusBadge } from "../components/Badge";
import ConfirmModal from "../components/ConfirmModal";
import { SkeletonRow } from "../components/Skeleton";
import { useToast } from "../contexts/ToastContext";
import { format } from "date-fns";

const STATUSES = ["open", "in_progress", "resolved", "closed"];
const PRIORITIES = ["low", "normal", "medium", "high", "urgent"];

export default function SupportTicketDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [replyText, setReplyText] = useState("");
  const [confirmClose, setConfirmClose] = useState(false);
  const threadRef = useRef<HTMLDivElement>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/support-tickets", id],
    queryFn: () => api.get(`/api/admin/support-tickets/${id}`).then((r) => r.data),
  });

  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [data?.messages?.length]);

  const patchMutation = useMutation({
    mutationFn: (patch: Record<string, string>) =>
      api.patch(`/api/admin/support-tickets/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/support-tickets", id] });
      addToast("Ticket updated", "success");
      setConfirmClose(false);
    },
    onError: (err) => addToast(getApiErrorMessage(err), "error"),
  });

  const replyMutation = useMutation({
    mutationFn: (body: string) =>
      api.post(`/api/admin/support-tickets/${id}/messages`, { body }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/support-tickets", id] });
      setReplyText("");
      addToast("Reply sent", "success");
    },
    onError: (err) => addToast(getApiErrorMessage(err), "error"),
  });

  if (isLoading) {
    return (
      <Layout>
        <div style={{ padding: "24px 0" }}>
          {Array.from({ length: 8 }).map((_, i) => <SkeletonRow key={i} cols={3} />)}
        </div>
      </Layout>
    );
  }

  if (!data?.ticket) {
    return <Layout><div style={{ padding: 60, textAlign: "center", color: "var(--danger)" }}>Ticket not found</div></Layout>;
  }

  const { ticket, messages = [] } = data;

  const handleStatusChange = (status: string) => {
    if (status === "closed") {
      setConfirmClose(true);
    } else {
      patchMutation.mutate({ status });
    }
  };

  return (
    <Layout>
      <button onClick={() => navigate("/support")} style={s.back}>← Back to Tickets</button>

      <div style={s.layout}>
        {/* Left: Metadata */}
        <div style={s.meta}>
          <h2 style={s.metaTitle}>{ticket.subject}</h2>

          <div style={s.metaSection}>
            <div style={s.row}>
              <span style={s.label}>Status</span>
              {ticketStatusBadge(ticket.status)}
            </div>
            <div style={s.row}>
              <span style={s.label}>Priority</span>
              {priorityBadge(ticket.priority || "normal")}
            </div>
            <div style={s.row}>
              <span style={s.label}>Category</span>
              <span style={s.val}>{ticket.category || "—"}</span>
            </div>
            <div style={s.row}>
              <span style={s.label}>User Type</span>
              <span style={s.val}>{ticket.userType || "—"}</span>
            </div>
          </div>

          <div style={s.metaSection}>
            <div style={s.sectionTitle}>User</div>
            <div style={s.userName}>{ticket.name || "—"}</div>
            <div style={s.userEmail}>{ticket.email}</div>
          </div>

          <div style={s.metaSection}>
            <div style={s.sectionTitle}>Dates</div>
            <div style={s.row}>
              <span style={s.label}>Created</span>
              <span style={s.val}>{ticket.createdAt ? format(new Date(ticket.createdAt), "MMM d, yyyy") : "—"}</span>
            </div>
            <div style={s.row}>
              <span style={s.label}>Updated</span>
              <span style={s.val}>{ticket.updatedAt ? format(new Date(ticket.updatedAt), "MMM d, yyyy") : "—"}</span>
            </div>
            {ticket.resolvedAt && (
              <div style={s.row}>
                <span style={s.label}>Resolved</span>
                <span style={s.val}>{format(new Date(ticket.resolvedAt), "MMM d, yyyy")}</span>
              </div>
            )}
          </div>

          <div style={s.metaSection}>
            <div style={s.sectionTitle}>Actions</div>
            <div style={s.actionGroup}>
              <select
                value={ticket.status}
                onChange={(e) => handleStatusChange(e.target.value)}
                style={s.select}
                disabled={patchMutation.isPending}
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>{st.replace("_", " ")}</option>
                ))}
              </select>
              <select
                value={ticket.priority || "normal"}
                onChange={(e) => patchMutation.mutate({ priority: e.target.value })}
                style={s.select}
                disabled={patchMutation.isPending}
              >
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Right: Thread */}
        <div style={s.thread}>
          <div ref={threadRef} style={s.threadScroll}>
            {/* Original message */}
            <div style={{ ...s.message, ...s.userMessage }}>
              <div style={s.msgHeader}>
                <span style={s.msgAuthor}>{ticket.name || ticket.email}</span>
                <span style={s.msgTime}>{ticket.createdAt ? format(new Date(ticket.createdAt), "MMM d, yyyy h:mm a") : ""}</span>
              </div>
              <p style={s.msgBody}>{ticket.message}</p>
            </div>

            {/* Replies */}
            {messages.map((msg: { id: string; senderType: string; senderName?: string | null; body: string; createdAt: string | null }) => (
              <div key={msg.id} style={{ ...s.message, ...(msg.senderType === "admin" ? s.adminMessage : s.userMessage) }}>
                <div style={s.msgHeader}>
                  <span style={s.msgAuthor}>{msg.senderType === "admin" ? "Admin" : (msg.senderName || "User")}</span>
                  <span style={s.msgTime}>{msg.createdAt ? format(new Date(msg.createdAt), "MMM d, yyyy h:mm a") : ""}</span>
                </div>
                <p style={s.msgBody}>{msg.body}</p>
              </div>
            ))}
          </div>

          {/* Reply box */}
          <div style={s.replyBox}>
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a reply..."
              style={s.textarea}
              rows={3}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
              <button
                style={s.sendBtn}
                onClick={() => replyText.trim() && replyMutation.mutate(replyText.trim())}
                disabled={!replyText.trim() || replyMutation.isPending}
              >
                {replyMutation.isPending ? "Sending..." : "Send Reply"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <ConfirmModal
        open={confirmClose}
        title="Close Ticket?"
        message="This ticket will be marked as closed. The user will be notified."
        confirmLabel="Close Ticket"
        danger
        loading={patchMutation.isPending}
        onConfirm={() => patchMutation.mutate({ status: "closed" })}
        onCancel={() => setConfirmClose(false)}
      />
    </Layout>
  );
}

const s: Record<string, React.CSSProperties> = {
  back: { background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, padding: "0 0 16px", display: "block" },
  layout: { display: "grid", gridTemplateColumns: "300px 1fr", gap: 24, alignItems: "start" },
  meta: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 20, position: "sticky", top: 0 },
  metaTitle: { margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 },
  metaSection: { marginBottom: 20, paddingBottom: 20, borderBottom: "1px solid var(--border)" },
  sectionTitle: { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 },
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  label: { fontSize: 12, color: "var(--text-muted)" },
  val: { fontSize: 13, color: "var(--text-primary)", fontWeight: 500 },
  userName: { fontSize: 14, fontWeight: 600, color: "var(--text-primary)" },
  userEmail: { fontSize: 12, color: "var(--text-muted)", marginTop: 2 },
  actionGroup: { display: "flex", flexDirection: "column", gap: 8 },
  select: {
    width: "100%", padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 6,
    background: "var(--surface)", color: "var(--text-primary)", fontSize: 13,
  },
  thread: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, overflow: "hidden", display: "flex", flexDirection: "column" },
  threadScroll: { flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 16, maxHeight: "calc(100vh - 260px)" },
  message: { borderRadius: 8, padding: "12px 16px" },
  userMessage: { background: "var(--surface-2)", border: "1px solid var(--border)" },
  adminMessage: { background: "rgba(56,174,95,0.08)", border: "1px solid rgba(56,174,95,0.2)" },
  msgHeader: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  msgAuthor: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)" },
  msgTime: { fontSize: 11, color: "var(--text-muted)" },
  msgBody: { margin: 0, fontSize: 14, color: "var(--text-primary)", lineHeight: 1.6, whiteSpace: "pre-wrap" },
  replyBox: { padding: 20, borderTop: "1px solid var(--border)", background: "var(--surface)" },
  textarea: {
    width: "100%", padding: "10px 14px", border: "1px solid var(--border)", borderRadius: 8,
    fontSize: 14, background: "var(--surface)", color: "var(--text-primary)", resize: "vertical",
    outline: "none", lineHeight: 1.6,
  },
  sendBtn: {
    padding: "8px 20px", background: "#38AE5F", color: "#fff", border: "none",
    borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
};
