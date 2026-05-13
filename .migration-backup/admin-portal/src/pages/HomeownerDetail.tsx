import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client";
import Layout from "../components/Layout";
import PageHeader from "../components/PageHeader";
import Badge, { ticketStatusBadge } from "../components/Badge";
import { SkeletonCard } from "../components/Skeleton";
import { format } from "date-fns";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={sStyles.section}>
      <h2 style={sStyles.sectionTitle}>{title}</h2>
      {children}
    </div>
  );
}

export default function HomeownerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["/api/admin/users", id],
    queryFn: () => api.get(`/api/admin/users/${id}`).then((r) => r.data),
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

  if (error || !data?.user) {
    return (
      <Layout>
        <div style={{ padding: 40, textAlign: "center", color: "var(--danger)" }}>User not found.</div>
      </Layout>
    );
  }

  const { user, homes = [], appointments = [], creditBalance = "0", creditLedger = [], supportTickets = [] } = data;
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || user.email;

  return (
    <Layout>
      <button onClick={() => navigate("/homeowners")} style={sStyles.back}>← Back to Homeowners</button>
      <PageHeader title={fullName} subtitle={user.email} />

      <Section title="Profile">
        <div style={sStyles.profileGrid}>
          <Field label="Email" value={user.email} />
          <Field label="Phone" value={user.phone || "—"} />
          <Field label="Signup Date" value={user.createdAt ? format(new Date(user.createdAt), "MMM d, yyyy") : "—"} />
          <Field label="Last Active" value={user.lastActiveAt ? format(new Date(user.lastActiveAt), "MMM d, yyyy") : "—"} />
          <Field label="Admin" value={user.isAdmin ? "Yes" : "No"} />
          <Field label="Provider" value={user.isProvider ? "Yes" : "No"} />
        </div>
      </Section>

      <Section title={`Homes (${homes.length})`}>
        {homes.length === 0 ? (
          <p style={sStyles.empty}>No homes registered</p>
        ) : (
          homes.map((h: { id: string; street?: string | null; city?: string | null; state?: string | null; housefaxScore?: number | null; propertyType?: string | null }) => (
            <div key={h.id} style={sStyles.card}>
              <div style={sStyles.cardTitle}>{[h.street, h.city, h.state].filter(Boolean).join(", ")}</div>
              {h.housefaxScore != null && (
                <Badge label={`HouseFax: ${h.housefaxScore}`} variant="green" />
              )}
              {h.propertyType && <span style={sStyles.cardSub}>{h.propertyType}</span>}
            </div>
          ))
        )}
      </Section>

      <Section title={`Appointments (${appointments.length})`}>
        {appointments.length === 0 ? (
          <p style={sStyles.empty}>No appointments</p>
        ) : (
          <table style={sStyles.table}>
            <thead>
              <tr>
                {["Date", "Provider", "Status"].map((h) => (
                  <th key={h} style={sStyles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {appointments.map((a: { id: string; scheduledDate: string | null; providerName?: string | null; status: string }) => (
                <tr key={a.id}>
                  <td style={sStyles.td}>{a.scheduledDate ? format(new Date(a.scheduledDate), "MMM d, yyyy") : "—"}</td>
                  <td style={sStyles.td}>{a.providerName || "—"}</td>
                  <td style={sStyles.td}><Badge label={a.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title="Credits">
        <div style={sStyles.creditRow}>
          <span style={sStyles.creditLabel}>Balance:</span>
          <span style={sStyles.creditValue}>
            ${parseFloat(creditBalance || "0").toFixed(2)}
          </span>
        </div>
        {creditLedger.length > 0 && (
          <table style={{ ...sStyles.table, marginTop: 16 }}>
            <thead>
              <tr>
                {["Amount", "Reason", "Date"].map((h) => (
                  <th key={h} style={sStyles.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {creditLedger.map((e: { id: string; deltaCents: number; reason: string | null; createdAt: string }) => (
                <tr key={e.id}>
                  <td style={sStyles.td}>
                    <span style={{ color: e.deltaCents >= 0 ? "#38AE5F" : "#ef4444" }}>
                      {e.deltaCents >= 0 ? "+" : ""}${(Math.abs(e.deltaCents) / 100).toFixed(2)}
                    </span>
                  </td>
                  <td style={sStyles.td}>{e.reason || "—"}</td>
                  <td style={sStyles.td}>{e.createdAt ? format(new Date(e.createdAt), "MMM d, yyyy") : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      <Section title={`Support Tickets (${supportTickets.length})`}>
        {supportTickets.length === 0 ? (
          <p style={sStyles.empty}>No support tickets</p>
        ) : (
          supportTickets.map((t: { id: string; subject: string; status: string; createdAt: string }) => (
            <div
              key={t.id}
              style={{ ...sStyles.card, cursor: "pointer" }}
              onClick={() => navigate(`/support/${t.id}`)}
            >
              <div style={sStyles.cardTitle}>{t.subject}</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
                {ticketStatusBadge(t.status)}
                <span style={sStyles.cardSub}>
                  {t.createdAt ? format(new Date(t.createdAt), "MMM d, yyyy") : ""}
                </span>
              </div>
            </div>
          ))
        )}
      </Section>
    </Layout>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={sStyles.fieldLabel}>{label}</div>
      <div style={sStyles.fieldValue}>{value}</div>
    </div>
  );
}

const sStyles: Record<string, React.CSSProperties> = {
  back: {
    background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer",
    fontSize: 13, padding: "0 0 16px", display: "block",
  },
  section: {
    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
    padding: 24, marginBottom: 20,
  },
  sectionTitle: { margin: "0 0 16px", fontSize: 15, fontWeight: 600, color: "var(--text-primary)" },
  profileGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px 24px" },
  fieldLabel: { fontSize: 11, fontWeight: 500, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 2 },
  fieldValue: { fontSize: 14, color: "var(--text-primary)" },
  card: {
    border: "1px solid var(--border)", borderRadius: 8, padding: "12px 16px",
    marginBottom: 8, background: "var(--surface-2)",
  },
  cardTitle: { fontWeight: 500, fontSize: 14, color: "var(--text-primary)" },
  cardSub: { fontSize: 12, color: "var(--text-muted)", marginLeft: 4 },
  creditRow: { display: "flex", alignItems: "center", gap: 12 },
  creditLabel: { fontSize: 13, color: "var(--text-secondary)" },
  creditValue: { fontSize: 20, fontWeight: 700, color: "#38AE5F" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    padding: "8px 12px", textAlign: "left", fontSize: 11, fontWeight: 600,
    color: "var(--text-secondary)", background: "var(--surface-2)",
    borderBottom: "1px solid var(--border)", textTransform: "uppercase",
  },
  td: { padding: "10px 12px", borderBottom: "1px solid var(--border-light)", color: "var(--text-primary)" },
  empty: { color: "var(--text-muted)", fontSize: 13, margin: 0 },
};
