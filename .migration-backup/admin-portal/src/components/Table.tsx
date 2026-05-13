import React from "react";

export interface Column<T> {
  key: string;
  label: string;
  width?: string | number;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
}

interface Props<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  emptyMessage?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
  onSort?: (key: string) => void;
}

export default function Table<T extends Record<string, unknown>>({
  columns, rows, rowKey, onRowClick, emptyMessage = "No records found.",
  sortBy, sortDir, onSort,
}: Props<T>) {
  return (
    <div style={styles.wrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{ ...styles.th, width: col.width, cursor: col.sortable ? "pointer" : "default" }}
                onClick={() => col.sortable && onSort?.(col.key)}
              >
                {col.label}
                {col.sortable && sortBy === col.key && (
                  <span style={{ marginLeft: 4 }}>{sortDir === "asc" ? "▲" : "▼"}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={styles.empty}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                style={{ ...styles.row, cursor: onRowClick ? "pointer" : "default" }}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} style={styles.td}>
                    {col.render ? col.render(row) : String(row[col.key] ?? "")}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    overflowX: "auto",
    border: "1px solid var(--border)",
    borderRadius: 8,
    background: "var(--surface)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    padding: "10px 16px",
    textAlign: "left",
    fontWeight: 600,
    fontSize: 12,
    color: "var(--text-secondary)",
    background: "var(--surface-2)",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
    userSelect: "none",
  },
  td: {
    padding: "11px 16px",
    borderBottom: "1px solid var(--border-light)",
    color: "var(--text-primary)",
    verticalAlign: "middle",
  },
  row: {
    transition: "background 0.1s",
  },
  empty: {
    padding: "40px 16px",
    textAlign: "center",
    color: "var(--text-muted)",
    fontSize: 14,
  },
};
