import React, { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, getApiErrorMessage } from "../api/client";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import Badge, { subscriptionBadge } from "../components/Badge";
import ConfirmModal from "../components/ConfirmModal";
import { SkeletonCard } from "../components/Skeleton";
import { useToast } from "../contexts/ToastContext";
import { format } from "date-fns";

type Tab = "bookings" | "jobs" | "invoices" | "reviews" | "crew";

export default function ProviderDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [tab, setTab] = useState<Tab>("bookings");
  const [confirmPartner, setConfirmPartner] = useState<"grant" | "revoke" | null>(null);
  const [confirmToggle, setConfirmToggle] = useState<{ field: "isActive" | "isPublic"; value: boolean } | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/providers", id],
    queryFn: () => api.get(`/api/admin/providers/${id}`).then((r) => r.data),
  });

  const partnerMutation = useMutation({
    mutationFn: (grant: boolean) =>
      grant
        ? api.post(`/api/admin/providers/${id}/partner`)
        : api.delete(`/api/admin/providers/${id}/partner`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/providers", id] });
      addToast("Partner status updated", "success");
      setConfirmPartner(null);
    },
    onError: (err) => {
      addToast(getApiErrorMessage(err), "error");
      setConfirmPartner(null);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (patch: Record<string, boolean>) =>
      api.patch(`/api/admin/providers/${id}`, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/providers", id] });
      addToast("Provider updated", "success");
      setConfirmToggle(null);
    },
    onError: (err) => {
      addToast(getApiErrorMessage(err), "error");
      setConfirmToggle(null);
    },
  });

  if (isLoading) {
    return (
      <Layout>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16, padding: "24px 0" }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      </Layout>
    );
  }

  if (!data?.provider) {
    return <Layout><div style={{ padding: 60, textAlign: "center", color: "var(--danger)" }}>Provider not found</div></Layout>;
  }

  const { provider, plan, connectAccount, bookings = [], jobs = [], invoices = [], reviews = [], crew = [] } = data;

  const tabs: { id: Tab; label: string }[] = [
    { id: "bookings", label: `Bookings (${bookings.length})` },
    { id: "jobs", label: `Jobs (${jobs.length})` },
    { id: "invoices", label: `Invoices (${invoices.length})` },
    { id: "reviews", label: `Reviews (${reviews.length})` },
    { id: "crew", label: `Crew (${crew.length})` },
  ];

  return (
    <Layout>
      <button onClick={() => navigate(-1)} style={dStyles.back}>← Back</button>
      <PageHeader
        title={provider.businessName || "Provider"}
        subtitle={provider.email}
        action={
          <div style={{ display: "flex", gap: 10 }}>
            <button
              style={{ ...dStyles.btn, background: plan?.isPartner ? "#ef4444" : "#38AE5F" }}
              onClick={() => setConfirmPartner(plan?.isPartner ? "revoke" : "grant")}
            >
              {plan?.isPartner ? "Revoke Partner" : "Grant Partner"}
            </button>
          </div>
        }
      />

      <div style={dStyles.grid}>
        {/* Profile card */}
        <div style={dStyles.card}>
          <h3 style={dStyles.cardTitle}>Profile</h3>
          <dl style={dStyles.dl}>
            <DT label="Business" value={provider.businessName || "—"} />
            <DT label="Email" value={provider.email || "—"} />
            <DT label="Phone" value={provider.phone || "—"} />
            <DT label="Created" value={provider.createdAt ? format(new Date(provider.createdAt as string), "MMM d, yyyy") : "—"} />
            <DT label="Active" value={<Badge label={provider.isActive ? "Active" : "Inactive"} variant={provider.isActive ? "green" : "gray"} />} />
            <DT label="Public" value={<Badge label={provider.isPublic ? "Public" : "Hidden"} variant={provider.isPublic ? "green" : "gray"} />} />
            <DT label="Partner" value={plan?.isPartner ? <Badge label="PARTNER" variant="green" /> : "No"} />
            <DT label="Rating" value={provider.averageRating != null ? `${Number(provider.averageRating).toFixed(1)} stars` : "—"} />
            <DT label="Service Area" value={provider.serviceArea || "—"} />
          </dl>
          <div style={dStyles.toggleRow}>
            <button style={dStyles.toggleBtn} onClick={() => setConfirmToggle({ field: "isActive", value: !provider.isActive })}>
              {provider.isActive ? "Deactivate" : "Activate"}
            </button>
            <button style={dStyles.toggleBtn} onClick={() => setConfirmToggle({ field: "isPublic", value: !provider.isPublic })}>
              {provider.isPublic ? "Make Hidden" : "Make Public"}
            </button>
          </div>
        </div>

        {/* Subscription card */}
        <div style={dStyles.card}>
          <h3 style={dStyles.cardTitle}>Subscription</h3>
          {plan ? (
            <dl style={dStyles.dl}>
              <DT label="Status" value={subscriptionBadge(plan.subscriptionStatus || "free")} />
              <DT label="Source" value={plan.subscriptionSource || "—"} />
              <DT label="Period End" value={plan.currentPeriodEnd ? format(new Date(plan.currentPeriodEnd), "MMM d, yyyy") : "—"} />
              <DT label="Partner Since" value={plan.partnerSince ? format(new Date(plan.partnerSince), "MMM d, yyyy") : "—"} />
              <DT label="First Paid Booking" value={plan.firstPaidBookingAt ? format(new Date(plan.firstPaidBookingAt), "MMM d, yyyy") : "—"} />
              <DT label="Grace Period Ends" value={plan.gracePeriodEndsAt ? format(new Date(plan.gracePeriodEndsAt), "MMM d, yyyy") : "—"} />
            </dl>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>No subscription data</p>
          )}
        </div>

        {/* Stripe card */}
        <div style={dStyles.card}>
          <h3 style={dStyles.cardTitle}>Stripe Connect</h3>
          {connectAccount ? (
            <dl style={dStyles.dl}>
              <DT label="Account ID" value={connectAccount.stripeAccountId || "—"} />
              <DT label="Onboarding" value={<Badge label={connectAccount.onboardingStatus || "pending"} />} />
              <DT label="Charges Enabled" value={connectAccount.chargesEnabled ? "Yes" : "No"} />
            </dl>
          ) : (
            <p style={{ color: "var(--text-muted)", fontSize: 13, margin: 0 }}>No Stripe account</p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={dStyles.tabs}>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{ ...dStyles.tabBtn, ...(tab === t.id ? dStyles.tabBtnActive : {}) }}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div style={dStyles.tabContent}>
        {tab === "bookings" && <SimpleTable rows={bookings} cols={["scheduledDate", "status"]} labels={["Date", "Status"]} dateCol="scheduledDate" />}
        {tab === "jobs" && <SimpleTable rows={jobs} cols={["scheduledDate", "status"]} labels={["Date", "Status"]} dateCol="scheduledDate" />}
        {tab === "invoices" && (
          <table style={dStyles.table}>
            <thead><tr>{["Invoice #", "Total", "Status", "Date"].map((h) => <th key={h} style={dStyles.th}>{h}</th>)}</tr></thead>
            <tbody>
              {invoices.map((inv: Record<string, unknown>) => (
                <tr key={inv.id as string}>
                  <td style={dStyles.td}>{(inv.invoiceNumber as string) || "—"}</td>
                  <td style={dStyles.td}>{inv.totalCents != null ? `$${(Number(inv.totalCents) / 100).toFixed(2)}` : "—"}</td>
                  <td style={dStyles.td}><Badge label={(inv.status as string) || "unknown"} /></td>
                  <td style={dStyles.td}>{inv.createdAt ? format(new Date(inv.createdAt as string), "MMM d, yyyy") : "—"}</td>
                </tr>
              ))}
              {invoices.length === 0 && <tr><td colSpan={4} style={dStyles.empty}>No invoices</td></tr>}
            </tbody>
          </table>
        )}
        {tab === "reviews" && (
          <table style={dStyles.table}>
            <thead><tr>{["Rating", "Comment", "Date"].map((h) => <th key={h} style={dStyles.th}>{h}</th>)}</tr></thead>
            <tbody>
              {reviews.map((r: Record<string, unknown>) => (
                <tr key={r.id as string}>
                  <td style={dStyles.td}>{r.rating != null ? `${Number(r.rating)}/5` : "—"}</td>
                  <td style={dStyles.td}>{(r.comment as string | null) || "—"}</td>
                  <td style={dStyles.td}>{r.createdAt ? format(new Date(r.createdAt as string), "MMM d, yyyy") : "—"}</td>
                </tr>
              ))}
              {reviews.length === 0 && <tr><td colSpan={3} style={dStyles.empty}>No reviews</td></tr>}
            </tbody>
          </table>
        )}
        {tab === "crew" && (
          <table style={dStyles.table}>
            <thead><tr>{["Name", "Email", "Phone", "Active"].map((h) => <th key={h} style={dStyles.th}>{h}</th>)}</tr></thead>
            <tbody>
              {crew.map((c: Record<string, unknown>) => (
                <tr key={c.id as string}>
                  <td style={dStyles.td}>{c.name as string}</td>
                  <td style={dStyles.td}>{(c.email as string | null) || "—"}</td>
                  <td style={dStyles.td}>{(c.phone as string | null) || "—"}</td>
                  <td style={dStyles.td}><Badge label={c.isActive ? "Active" : "Inactive"} variant={c.isActive ? "green" : "gray"} /></td>
                </tr>
              ))}
              {crew.length === 0 && <tr><td colSpan={4} style={dStyles.empty}>No crew members</td></tr>}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        open={confirmPartner !== null}
        title={confirmPartner === "grant" ? "Grant Partner Status?" : "Revoke Partner Status?"}
        message={
          confirmPartner === "grant"
            ? "This provider will receive complimentary Pro access as a HomeBase Partner."
            : "This provider will lose their Partner status and Pro access."
        }
        confirmLabel={confirmPartner === "grant" ? "Grant Partner" : "Revoke Partner"}
        danger={confirmPartner === "revoke"}
        loading={partnerMutation.isPending}
        onConfirm={() => partnerMutation.mutate(confirmPartner === "grant")}
        onCancel={() => setConfirmPartner(null)}
      />

      <ConfirmModal
        open={confirmToggle !== null}
        title={`${confirmToggle?.value ? "Enable" : "Disable"} ${confirmToggle?.field === "isActive" ? "Provider" : "Public Listing"}?`}
        message={`Are you sure you want to ${confirmToggle?.value ? "enable" : "disable"} the ${confirmToggle?.field === "isActive" ? "provider" : "public listing"}?`}
        confirmLabel="Confirm"
        loading={toggleMutation.isPending}
        onConfirm={() => confirmToggle && toggleMutation.mutate({ [confirmToggle.field]: confirmToggle.value })}
        onCancel={() => setConfirmToggle(null)}
      />
    </Layout>
  );
}

function DT({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "6px 0", borderBottom: "1px solid var(--border-light)" }}>
      <dt style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 500 }}>{label}</dt>
      <dd style={{ margin: 0, fontSize: 13, color: "var(--text-primary)", textAlign: "right" }}>{value}</dd>
    </div>
  );
}

function SimpleTable({ rows, cols, labels, dateCol }: { rows: Record<string, unknown>[]; cols: string[]; labels: string[]; dateCol?: string }) {
  return (
    <table style={dStyles.table}>
      <thead><tr>{labels.map((l) => <th key={l} style={dStyles.th}>{l}</th>)}</tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id as string}>
            {cols.map((c) => (
              <td key={c} style={dStyles.td}>
                {c === dateCol && r[c] ? format(new Date(r[c] as string), "MMM d, yyyy") : r[c] != null ? String(r[c]) : "—"}
              </td>
            ))}
          </tr>
        ))}
        {rows.length === 0 && <tr><td colSpan={cols.length} style={dStyles.empty}>No records</td></tr>}
      </tbody>
    </table>
  );
}

const dStyles: Record<string, React.CSSProperties> = {
  back: { background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, padding: "0 0 16px", display: "block" },
  btn: { padding: "8px 18px", border: "none", borderRadius: 7, color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16, marginBottom: 24 },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10, padding: 20 },
  cardTitle: { margin: "0 0 14px", fontSize: 14, fontWeight: 600, color: "var(--text-primary)" },
  dl: { margin: 0, padding: 0 },
  toggleRow: { display: "flex", gap: 8, marginTop: 16 },
  toggleBtn: {
    flex: 1, padding: "7px 12px", border: "1px solid var(--border)",
    borderRadius: 6, background: "var(--surface-2)", color: "var(--text-secondary)",
    cursor: "pointer", fontSize: 12, fontWeight: 500,
  },
  tabs: { display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid var(--border)" },
  tabBtn: {
    padding: "8px 16px", border: "none", borderBottom: "2px solid transparent",
    background: "none", color: "var(--text-secondary)", cursor: "pointer", fontSize: 13, fontWeight: 500,
    marginBottom: -1,
  },
  tabBtnActive: { color: "#38AE5F", borderBottomColor: "#38AE5F" },
  tabContent: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { padding: "9px 14px", textAlign: "left", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", background: "var(--surface-2)", borderBottom: "1px solid var(--border)", textTransform: "uppercase" },
  td: { padding: "10px 14px", borderBottom: "1px solid var(--border-light)", color: "var(--text-primary)" },
  empty: { padding: "32px 14px", textAlign: "center", color: "var(--text-muted)", fontSize: 13 },
};
