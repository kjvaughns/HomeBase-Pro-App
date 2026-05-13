import React, { useState } from "react";

interface Props {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  style?: React.CSSProperties;
}

export default function SearchInput({ value, onChange, placeholder = "Search...", style }: Props) {
  return (
    <div style={{ position: "relative", ...style }}>
      <span style={styles.icon}>⌕</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={styles.input}
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  icon: {
    position: "absolute",
    left: 10,
    top: "50%",
    transform: "translateY(-50%)",
    color: "var(--text-muted)",
    fontSize: 16,
    pointerEvents: "none",
  },
  input: {
    width: "100%",
    padding: "8px 12px 8px 32px",
    border: "1px solid var(--border)",
    borderRadius: 6,
    background: "var(--surface)",
    color: "var(--text-primary)",
    fontSize: 13,
    outline: "none",
  },
};
