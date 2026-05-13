import React from "react";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  open, title, message, confirmLabel = "Confirm", danger = false, loading = false,
  onConfirm, onCancel
}: Props) {
  if (!open) return null;
  return (
    <div style={styles.overlay} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 style={styles.title}>{title}</h3>
        <p style={styles.msg}>{message}</p>
        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onCancel} disabled={loading}>Cancel</button>
          <button
            style={{ ...styles.confirmBtn, ...(danger ? styles.dangerBtn : styles.accentBtn) }}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "Processing..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", zIndex: 1000,
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  modal: {
    background: "var(--surface)", borderRadius: 12, padding: "28px 32px",
    width: 420, maxWidth: "90vw",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  title: { margin: "0 0 8px", fontSize: 17, fontWeight: 600, color: "var(--text-primary)" },
  msg: { margin: "0 0 24px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 },
  actions: { display: "flex", gap: 10, justifyContent: "flex-end" },
  cancelBtn: {
    padding: "8px 20px", borderRadius: 6, border: "1px solid var(--border)",
    background: "transparent", color: "var(--text-secondary)", cursor: "pointer", fontSize: 14,
  },
  confirmBtn: {
    padding: "8px 20px", borderRadius: 6, border: "none",
    cursor: "pointer", fontSize: 14, fontWeight: 500, color: "#fff",
  },
  accentBtn: { background: "#38AE5F" },
  dangerBtn: { background: "#ef4444" },
};
