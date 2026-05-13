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
import Badge, { subscriptionBadge } from "../components/Badge";
import ConfirmModal from "../components/ConfirmModal";
import { AdminProviderRow } from "../types";
import { format } from "date-fns";
import { useToast } from "../contexts/ToastContext";

const LIMIT = 25;

interface ProvidersProps {
  partnerOnly?: boolean;
}

export default function Providers({ partnerOnly = false }: ProvidersProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { addToast } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [offset, setOffset] = useState(0);
  const [subFilter, setSubFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("");
  const [partnerFilter, setPartnerFilter] = useState("");
  const [sortBy, setSortBy] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);
  const [confirmSingle, setConfirmSingle] = useState<{ id: string; isActive: boolean } | null>(null);

  React.useEffect(() => {
    const t = setTimeout(() => { setDebouncedSearch(search); setOffset(0); }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/providers", debouncedSearch, subFilter, activeFilter, partnerFilter, sortBy, partnerOnly, offset],
    queryFn: () =>
      api.get("/api/admin/providers", {
        params: {
          q: debouncedSearch || undefined,
          subscriptionStatus: subFilter || undefined,
          isPartner: partnerOnly ? "true" : (partnerFilter || undefined),
          isActive: activeFilter || undefined,
          sortBy: sortBy || undefined,
          limit: LIMIT,
          offset,
        },
      }).then((r) => r.data),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: (payload: Array<{ id: string; isActive: boolean }>) =>
      Promise.all(payload.map(({ id, isActive }) =>
        api.patch(`/api/admin/providers/${id}`, { isActive })
      )),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/providers"] });
      addToast("Provider(s) updated", "success");
      setSelectedIds(new Set());
      setConfirmDeactivate(false);
      setConfirmSingle(null);
    },
    onError: (err) => addToast(getApiErrorMessage(err), "error"),
  });

  const providers: AdminProviderRow[] = data?.providers || [];
  const selectedCount = selectedIds.size;

  const columns: Column<AdminProviderRow>[] = [
    {
      key: "businessName", label: "Business", render: (r) => (
        <div>
          <div style={{ fontWeight: 500 }}>{r.businessName || "—"}</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{r.email || ""}</div>
        </div>
      ),
    },
    {
      key: "subscriptionStatus", label: "Subscription",
      render: (r) => subscriptionBadge((r.subscriptionStatus as string) || "free"),
    },
    {
      key: "isPartner", label: "Partner",
      render: (r) => r.isPartner ? <Badge label="PARTNER" variant="green" /> : <span style={{ color: "var(--text-muted)" }}>—</span>,
    },
    {
      key: "isActive", label: "Status",
      render: (r) => <Badge label={r.isActive ? "Active" : "Inactive"} variant={r.isActive ? "green" : "gray"} />,
    },
    {
      key: "bookingCount", label: "Bookings",
      render: (r) => String(r.bookingCount ?? 0),
    },
    {
      key: "totalRevenueCents", label: "Revenue",
      render: (r) => r.totalRevenueCents != null ? `$${(Number(r.totalRevenueCents) / 100).toLocaleString()}` : "—",
    },
    {
      key: "averageRating", label: "Rating",
      render: (r) => r.averageRating != null ? `${Number(r.averageRating).toFixed(1)} ★` : "—",
    },
    {
      key: "createdAt", label: "Joined",
      render: (r) => r.createdAt ? format(new Date(r.createdAt as string), "MMM d, yyyy") : "—",
    },
    {
      key: "actions", label: "Actions",
      render: (r) => (
        <div style={{ display: "flex", gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <button style={btnStyle("neutral")} onClick={() => navigate(`/providers/${r.id}`)}>View</button>
          <button
            style={btnStyle(r.isActive ? "danger" : "accent")}
            onClick={() => setConfirmSingle({ id: r.id, isActive: !r.isActive })}
          >
            {r.isActive ? "Deactivate" : "Activate"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <Layout>
      {partnerOnly && (
        <div style={styles.partnerBanner}>
          HomeBase Partners — Providers with complimentary Pro access
        </div>
      )}
      <PageHeader
        title={partnerOnly ? "HomeBase Partners" : "Providers"}
        subtitle={data?.total != null ? `${data.total} providers` : ""}
      />

      {selectedCount > 0 && (
        <div style={styles.bulkBar}>
          <span style={styles.bulkCount}>{selectedCount} selected</span>
          <button style={styles.bulkClear} onClick={() => setSelectedIds(new Set())}>Clear</button>
          <button style={styles.bulkDeactivate} onClick={() => setConfirmDeactivate(true)}>
            Deactivate Selected
          </button>
        </div>
      )}

      <div style={styles.toolbar}>
        <SearchInput value={search} onChange={setSearch} placeholder="Search providers..." style={{ width: 280 }} />
        <select value={subFilter} onChange={(e) => { setSubFilter(e.target.value); setOffset(0); }} style={styles.select}>
          <option value="">All Subscriptions</option>
          <option value="subscribed">Subscribed</option>
          <option value="grace_period">Grace Period</option>
          <option value="free">Free</option>
          <option value="expired">Expired</option>
        </select>
        <select value={activeFilter} onChange={(e) => { setActiveFilter(e.target.value); setOffset(0); }} style={styles.select}>
          <option value="">All Status</option>
          <option value="true">Active</option>
          <option value="false">Inactive</option>
        </select>
        {!partnerOnly && (
          <select value={partnerFilter} onChange={(e) => { setPartnerFilter(e.target.value); setOffset(0); }} style={styles.select}>
            <option value="">All Partners</option>
            <option value="true">Partners only</option>
            <option value="false">Non-partners</option>
          </select>
        )}
        <select value={sortBy} onChange={(e) => { setSortBy(e.target.value); setOffset(0); }} style={styles.select}>
          <option value="">Sort: Default</option>
          <option value="bookings">Most Bookings</option>
          <option value="revenue">Most Revenue</option>
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
            rows={providers}
            rowKey={(r) => r.id}
            onRowClick={(r) => navigate(`/providers/${r.id}`)}
            emptyMessage={partnerOnly ? "No partners found" : "No providers found"}
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
        open={confirmDeactivate}
        title={`Deactivate ${selectedCount} Provider${selectedCount !== 1 ? "s" : ""}?`}
        message="These providers will be deactivated and hidden from homeowners."
        confirmLabel="Deactivate"
        danger
        loading={toggleActiveMutation.isPending}
        onConfirm={() =>
          toggleActiveMutation.mutate([...selectedIds].map((id) => ({ id, isActive: false })))
        }
        onCancel={() => setConfirmDeactivate(false)}
      />

      <ConfirmModal
        open={confirmSingle !== null}
        title={confirmSingle?.isActive ? "Activate Provider?" : "Deactivate Provider?"}
        message={
          confirmSingle?.isActive
            ? "This provider will be activated and visible to homeowners."
            : "This provider will be deactivated and hidden from homeowners."
        }
        confirmLabel={confirmSingle?.isActive ? "Activate" : "Deactivate"}
        danger={!confirmSingle?.isActive}
        loading={toggleActiveMutation.isPending}
        onConfirm={() =>
          confirmSingle && toggleActiveMutation.mutate([{ id: confirmSingle.id, isActive: confirmSingle.isActive }])
        }
        onCancel={() => setConfirmSingle(null)}
      />
    </Layout>
  );
}

function btnStyle(variant: "neutral" | "danger" | "accent"): React.CSSProperties {
  if (variant === "accent") return {
    padding: "4px 10px", fontSize: 11, fontWeight: 500,
    border: "1px solid rgba(56,174,95,0.3)", borderRadius: 6,
    background: "rgba(56,174,95,0.08)", color: "#38AE5F", cursor: "pointer",
  };
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
  partnerBanner: {
    background: "rgba(56,174,95,0.10)",
    border: "1px solid rgba(56,174,95,0.25)",
    borderRadius: 8,
    padding: "10px 16px",
    color: "#38AE5F",
    fontWeight: 600,
    fontSize: 13,
    marginBottom: 20,
  },
  bulkBar: {
    position: "sticky", top: 0, zIndex: 10,
    display: "flex", alignItems: "center", gap: 10,
    background: "rgba(56,174,95,0.08)", border: "1px solid rgba(56,174,95,0.2)",
    borderRadius: 8, padding: "10px 16px", marginBottom: 12,
  },
  bulkCount: { fontWeight: 600, fontSize: 13, color: "#38AE5F", flex: 1 },
  bulkClear: {
    padding: "5px 12px", fontSize: 12, border: "1px solid var(--border)",
    borderRadius: 6, background: "var(--surface)", color: "var(--text-secondary)", cursor: "pointer",
  },
  bulkDeactivate: {
    padding: "5px 12px", fontSize: 12, border: "1px solid rgba(239,68,68,0.3)",
    borderRadius: 6, background: "rgba(239,68,68,0.06)", color: "#ef4444", cursor: "pointer", fontWeight: 500,
  },
  toolbar: { display: "flex", gap: 12, marginBottom: 12, flexWrap: "wrap" },
  select: {
    padding: "8px 12px", border: "1px solid var(--border)", borderRadius: 8,
    background: "var(--surface)", color: "var(--text-primary)", fontSize: 13,
  },
  tableWrap: { borderRadius: 10, overflow: "hidden", marginBottom: 16 },
};
