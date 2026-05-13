import React from "react";

type Variant = "green" | "red" | "orange" | "yellow" | "gray" | "blue" | "purple";

const COLORS: Record<Variant, React.CSSProperties> = {
  green:  { background: "rgba(56,174,95,0.12)",  color: "#38AE5F" },
  red:    { background: "rgba(239,68,68,0.12)",   color: "#ef4444" },
  orange: { background: "rgba(249,115,22,0.12)",  color: "#f97316" },
  yellow: { background: "rgba(234,179,8,0.12)",   color: "#ca8a04" },
  gray:   { background: "var(--surface-2)",        color: "var(--text-secondary)" },
  blue:   { background: "rgba(59,130,246,0.12)",  color: "#3b82f6" },
  purple: { background: "rgba(168,85,247,0.12)",  color: "#a855f7" },
};

interface Props {
  label: string;
  variant?: Variant;
  size?: "sm" | "md";
}

export default function Badge({ label, variant = "gray", size = "md" }: Props) {
  return (
    <span style={{
      ...COLORS[variant],
      padding: size === "sm" ? "2px 6px" : "3px 8px",
      borderRadius: 4,
      fontSize: size === "sm" ? 11 : 12,
      fontWeight: 600,
      display: "inline-block",
      whiteSpace: "nowrap",
    }}>
      {label}
    </span>
  );
}

export function subscriptionBadge(status: string) {
  const map: Record<string, { label: string; variant: Variant }> = {
    subscribed:   { label: "Subscribed",   variant: "green" },
    grace_period: { label: "Grace Period", variant: "yellow" },
    free:         { label: "Free",         variant: "gray" },
    expired:      { label: "Expired",      variant: "red" },
    trial:        { label: "Trial",        variant: "blue" },
  };
  const m = map[status] || { label: status || "Unknown", variant: "gray" as Variant };
  return <Badge label={m.label} variant={m.variant} />;
}

export function priorityBadge(priority: string) {
  const map: Record<string, { label: string; variant: Variant }> = {
    urgent: { label: "Urgent", variant: "red" },
    high:   { label: "High",   variant: "orange" },
    medium: { label: "Medium", variant: "yellow" },
    normal: { label: "Normal", variant: "gray" },
    low:    { label: "Low",    variant: "gray" },
  };
  const m = map[priority] || { label: priority, variant: "gray" as Variant };
  return <Badge label={m.label} variant={m.variant} />;
}

export function ticketStatusBadge(status: string) {
  const map: Record<string, { label: string; variant: Variant }> = {
    open:        { label: "Open",        variant: "blue" },
    in_progress: { label: "In Progress", variant: "yellow" },
    resolved:    { label: "Resolved",    variant: "green" },
    closed:      { label: "Closed",      variant: "gray" },
  };
  const m = map[status] || { label: status, variant: "gray" as Variant };
  return <Badge label={m.label} variant={m.variant} />;
}
