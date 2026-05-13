import React from "react";

interface Props {
  offset: number;
  limit: number;
  total?: number;
  onNext: () => void;
  onPrev: () => void;
}

export default function Pagination({ offset, limit, total, onNext, onPrev }: Props) {
  const page = Math.floor(offset / limit) + 1;
  const hasPrev = offset > 0;
  const hasNext = total !== undefined ? offset + limit < total : false;

  return (
    <div style={styles.row}>
      <span style={styles.info}>
        {total !== undefined
          ? `Showing ${offset + 1}–${Math.min(offset + limit, total)} of ${total}`
          : `Page ${page}`}
      </span>
      <div style={styles.btns}>
        <button style={styles.btn} onClick={onPrev} disabled={!hasPrev}>Previous</button>
        <button style={styles.btn} onClick={onNext} disabled={!hasNext && total !== undefined}>Next</button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 4px" },
  info: { fontSize: 13, color: "var(--text-muted)" },
  btns: { display: "flex", gap: 8 },
  btn: {
    padding: "6px 14px", fontSize: 13, borderRadius: 6,
    border: "1px solid var(--border)", background: "var(--surface)",
    color: "var(--text-secondary)", cursor: "pointer",
  },
};
