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
  selectable?: boolean;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

export default function Table<T extends Record<string, unknown>>({
  columns, rows, rowKey, onRowClick, emptyMessage = "No records found.",
  sortBy, sortDir, onSort,
  selectable = false, selectedIds, onSelectionChange,
}: Props<T>) {
  const allSelected = rows.length > 0 && rows.every((r) => selectedIds?.has(rowKey(r)));
  const someSelected = !allSelected && rows.some((r) => selectedIds?.has(rowKey(r)));

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (allSelected) {
      const next = new Set(selectedIds);
      rows.forEach((r) => next.delete(rowKey(r)));
      onSelectionChange(next);
    } else {
      const next = new Set(selectedIds);
      rows.forEach((r) => next.add(rowKey(r)));
      onSelectionChange(next);
    }
  };

  return (
    <div style={styles.wrapper}>
      <table style={styles.table}>
        <thead>
          <tr>
            {selectable && (
              <th style={{ ...styles.th, width: 44, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = someSelected; }}
                  onChange={toggleAll}
                  onClick={(e) => e.stopPropagation()}
                />
              </th>
            )}
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
              <td colSpan={columns.length + (selectable ? 1 : 0)} style={styles.empty}>
                {emptyMessage}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const id = rowKey(row);
              const isSelected = selectedIds?.has(id) ?? false;
              return (
                <tr
                  key={id}
                  style={{
                    ...styles.row,
                    cursor: onRowClick ? "pointer" : "default",
                    background: isSelected ? "rgba(56,174,95,0.06)" : undefined,
                  }}
                  onClick={() => onRowClick?.(row)}
                >
                  {selectable && (
                    <td style={{ ...styles.td, textAlign: "center", width: 44 }} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          if (!onSelectionChange) return;
                          const next = new Set(selectedIds);
                          if (isSelected) next.delete(id);
                          else next.add(id);
                          onSelectionChange(next);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} style={styles.td}>
                      {col.render ? col.render(row) : String(row[col.key] ?? "")}
                    </td>
                  ))}
                </tr>
              );
            })
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
    borderRadius: 10,
    background: "var(--surface)",
    boxShadow: "var(--shadow)",
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
    fontSize: 11,
    color: "var(--text-muted)",
    background: "var(--surface-2)",
    borderBottom: "1px solid var(--border)",
    whiteSpace: "nowrap",
    userSelect: "none",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
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
    padding: "48px 16px",
    textAlign: "center",
    color: "var(--text-muted)",
    fontSize: 14,
  },
};
