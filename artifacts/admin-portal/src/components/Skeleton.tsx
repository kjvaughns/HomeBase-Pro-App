import React from "react";

interface Props {
  width?: string | number;
  height?: string | number;
  borderRadius?: number;
  style?: React.CSSProperties;
}

export default function Skeleton({ width = "100%", height = 16, borderRadius = 4, style }: Props) {
  return (
    <div
      style={{
        width,
        height,
        borderRadius,
        background: "linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%)",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.4s infinite",
        ...style,
      }}
    />
  );
}

export function SkeletonRow({ cols = 4 }: { cols?: number }) {
  return (
    <tr>
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} style={{ padding: "12px 16px" }}>
          <Skeleton height={14} width={i === 0 ? "80%" : "60%"} />
        </td>
      ))}
    </tr>
  );
}

export function SkeletonCard() {
  return (
    <div style={{
      background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 10,
      padding: 20, display: "flex", flexDirection: "column", gap: 12,
    }}>
      <Skeleton height={14} width="50%" />
      <Skeleton height={28} width="70%" />
      <Skeleton height={12} width="40%" />
    </div>
  );
}
