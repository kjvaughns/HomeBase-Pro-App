import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getApiErrorMessage } from "../api/client";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import { SkeletonRow } from "../components/Skeleton";
import Badge from "../components/Badge";
import ConfirmModal from "../components/ConfirmModal";
import { useToast } from "../contexts/ToastContext";
import { format } from "date-fns";

const AUDIENCES = [
  { value: "all", label: "All Users" },
  { value: "homeowners", label: "All Homeowners" },
  { value: "providers", label: "All Providers" },
];

const CHANNELS: { value: string; label: string; disabled?: boolean }[] = [
  { value: "push", label: "Push Notification" },
  { value: "email", label: "Email" },
  { value: "in_app", label: "In-App Notification" },
  { value: "sms", label: "SMS (coming soon)", disabled: true },
];

interface BroadcastForm {
  title: string;
  body: string;
  audience: string;
  channels: string[];
}

export default function Broadcasts() {
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [showComposer, setShowComposer] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState<BroadcastForm>({ title: "", body: "", audience: "all", channels: ["push"] });

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/broadcasts"],
    queryFn: () => api.get("/api/admin/broadcasts", { params: { limit: 50 } }).then((r) => r.data),
  });

  const sendMutation = useMutation({
    mutationFn: (payload: BroadcastForm) =>
      api.post("/api/admin/broadcasts", { title: payload.title, body: payload.body, audience: payload.audience, channels: payload.channels }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["/api/admin/broadcasts"] });
      addToast(`Broadcast sent to ${res.data.recipientCount} recipients`, "success");
      setShowConfirm(false);
      setShowComposer(false);
      setForm({ title: "", body: "", audience: "all", channels: ["push"] });
    },
    onError: (err) => {
      addToast(getApiErrorMessage(err), "error");
      setShowConfirm(false);
    },
  });

  const broadcasts = data?.broadcasts || [];

  return (
    <Layout>
      <PageHeader
        title="Broadcasts"
        subtitle="Send messages to users at scale"
        action={
          <button style={styles.newBtn} onClick={() => setShowComposer(true)}>
            New Broadcast
          </button>
        }
      />

      {/* History table */}
      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>{["Title", "Audience", "Channel", "Recipients", "Status", "Sent Date", "Sent By"].map((h) => (
              <th key={h} style={styles.th}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} cols={7} />)
            ) : broadcasts.length === 0 ? (
              <tr><td colSpan={7} style={styles.empty}>No broadcasts yet</td></tr>
            ) : broadcasts.map((b: { id: string; title: string; audience: string; channel: string; recipientCount: number; status: string; sentAt: string | null; sentByName?: string | null }) => (
              <tr key={b.id}>
                <td style={styles.td}><span style={{ fontWeight: 500 }}>{b.title}</span></td>
                <td style={styles.td}>{b.audience}</td>
                <td style={styles.td}>{b.channel}</td>
                <td style={styles.td}>{b.recipientCount}</td>
                <td style={styles.td}>
                  <Badge
                    label={b.status}
                    variant={b.status === "sent" ? "green" : b.status === "failed" ? "red" : "gray"}
                  />
                </td>
                <td style={styles.td}>{b.sentAt ? format(new Date(b.sentAt), "MMM d, yyyy h:mm a") : "—"}</td>
                <td style={styles.td}>{b.sentByName || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Composer Modal */}
      {showComposer && (
        <div style={styles.overlay} onClick={() => setShowComposer(false)}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={styles.modalTitle}>New Broadcast</h2>

            <div style={styles.modalBody}>
              <div style={styles.formCol}>
                <Field label="Audience">
                  <select value={form.audience} onChange={(e) => setForm((f) => ({ ...f, audience: e.target.value }))} style={styles.select}>
                    {AUDIENCES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                  </select>
                </Field>

                <Field label="Channels (select one or more)">
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {CHANNELS.map((c) => (
                      <label
                        key={c.value}
                        style={{
                          ...styles.checkLabel,
                          opacity: c.disabled ? 0.45 : 1,
                          cursor: c.disabled ? "not-allowed" : "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          value={c.value}
                          checked={form.channels.includes(c.value)}
                          disabled={c.disabled}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              channels: e.target.checked
                                ? [...f.channels, c.value]
                                : f.channels.filter((ch) => ch !== c.value),
                            }))
                          }
                        />
                        <span>{c.label}</span>
                        {c.disabled && (
                          <span style={styles.disabledTag}>disabled</span>
                        )}
                      </label>
                    ))}
                  </div>
                </Field>

                <Field label={`Title (${form.title.length}/100)`}>
                  <input
                    type="text"
                    value={form.title}
                    maxLength={100}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    style={styles.input}
                    placeholder="Broadcast title"
                  />
                </Field>

                <Field label={`Message (${form.body.length}/1000)`}>
                  <textarea
                    value={form.body}
                    maxLength={1000}
                    rows={6}
                    onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                    style={{ ...styles.input, resize: "vertical" }}
                    placeholder="Your message..."
                  />
                </Field>
              </div>

              {/* Preview */}
              <div style={styles.previewCol}>
                <div style={styles.previewLabel}>Preview</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {(form.channels.includes("push") || form.channels.length === 0) && (
                    <div style={styles.previewCard}>
                      <div style={styles.pushPreview}>
                        <div style={styles.pushApp}>Push · HomeBase</div>
                        <div style={styles.pushTitle}>{form.title || "Title"}</div>
                        <div style={styles.pushBody}>{form.body || "Your message here..."}</div>
                      </div>
                    </div>
                  )}
                  {form.channels.includes("email") && (
                    <div style={styles.previewCard}>
                      <div style={styles.emailPreview}>
                        <div style={styles.pushApp}>Email</div>
                        <div style={styles.emailSubject}>{form.title || "Subject"}</div>
                        <div style={styles.emailBody}>{form.body || "Email body..."}</div>
                      </div>
                    </div>
                  )}
                  {form.channels.includes("in_app") && (
                    <div style={styles.previewCard}>
                      <div style={styles.inAppPreview}>
                        <div style={styles.pushApp}>In-App</div>
                        <div style={styles.inAppTitle}>{form.title || "Notification"}</div>
                        <div style={styles.inAppBody}>{form.body || "Message..."}</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div style={styles.modalActions}>
              <button style={styles.cancelBtn} onClick={() => setShowComposer(false)}>Cancel</button>
              <button
                style={styles.sendBtn}
                onClick={() => setShowConfirm(true)}
                disabled={!form.title.trim() || !form.body.trim() || form.channels.length === 0}
              >
                Send Now
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={showConfirm}
        title="Send Broadcast?"
        message={`This will send "${form.title}" to ${AUDIENCES.find((a) => a.value === form.audience)?.label} via ${form.channels.join(", ")}. This cannot be undone.`}
        confirmLabel="Send Broadcast"
        loading={sendMutation.isPending}
        onConfirm={() => sendMutation.mutate(form)}
        onCancel={() => setShowConfirm(false)}
      />
    </Layout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 500, color: "var(--text-secondary)" }}>{label}</label>
      {children}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  newBtn: { padding: "9px 18px", background: "#38AE5F", color: "#fff", border: "none", borderRadius: 7, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  tableWrap: { border: "1px solid var(--border)", borderRadius: 8, overflow: "auto", background: "var(--surface)" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { padding: "10px 16px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", textTransform: "uppercase", whiteSpace: "nowrap" },
  td: { padding: "11px 16px", borderBottom: "1px solid var(--border-light)", color: "var(--text-primary)", verticalAlign: "middle" },
  empty: { padding: "40px 16px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" },
  modal: { background: "var(--surface)", borderRadius: 14, width: 780, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" },
  modalTitle: { margin: 0, padding: "24px 28px 0", fontSize: 18, fontWeight: 700, color: "var(--text-primary)" },
  modalBody: { padding: "20px 28px", display: "grid", gridTemplateColumns: "1fr 280px", gap: 24 },
  formCol: { display: "flex", flexDirection: "column", gap: 16 },
  previewCol: {},
  previewLabel: { fontSize: 11, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 },
  previewCard: { border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" },
  pushPreview: { padding: 16, background: "var(--surface-2)" },
  pushApp: { fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 },
  pushTitle: { fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 },
  pushBody: { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.4 },
  emailPreview: { padding: 16 },
  emailSubject: { fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid var(--border)" },
  emailBody: { fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6, whiteSpace: "pre-wrap" },
  inAppPreview: { padding: 16, background: "rgba(56,174,95,0.06)", borderLeft: "3px solid #38AE5F" },
  inAppTitle: { fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 },
  inAppBody: { fontSize: 12, color: "var(--text-secondary)" },
  modalActions: { display: "flex", gap: 10, justifyContent: "flex-end", padding: "16px 28px", borderTop: "1px solid var(--border)" },
  cancelBtn: { padding: "8px 20px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14 },
  sendBtn: { padding: "8px 20px", borderRadius: 6, border: "none", background: "#38AE5F", color: "#fff", cursor: "pointer", fontSize: 14, fontWeight: 600 },
  select: { padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text-primary)", fontSize: 13 },
  input: { padding: "9px 12px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--surface)", color: "var(--text-primary)", fontSize: 13, width: "100%", outline: "none" },
  checkLabel: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text-primary)" },
  disabledTag: { fontSize: 10, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 4, padding: "1px 5px" },
};
