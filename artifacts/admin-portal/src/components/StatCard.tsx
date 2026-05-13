import React from "react";
import Skeleton from "./Skeleton";

interface Props {
  label: string;
  value: string | number;
  loading?: boolean;
  accent?: boolean;
}

export default function StatCard({ label, value, loading, accent }: Props) {
  return (
    <div style={{ ...styles.card, ...(accent ? styles.accent : {}) }}>
      <div style={styles.label}>{label}</div>
      {loading ? (
        <Skeleton height={28} width="60%" style={{ marginTop: 4 }} />
      ) : (
        <div style={{ ...styles.value, ...(accent ? styles.accentValue : {}) }}>{value}</div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 10,
    padding: "16px 20px",
    boxShadow: "var(--shadow)",
  },
  accent: {
    background: "#38AE5F",
    border: "none",
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  value: {
    fontSize: 26,
    fontWeight: 700,
    color: "var(--text-primary)",
    marginTop: 4,
  },
  accentValue: {
    color: "#fff",
  },
};
