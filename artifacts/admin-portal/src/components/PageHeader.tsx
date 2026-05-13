import React from "react";

interface Props {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, action }: Props) {
  return (
    <div style={styles.row}>
      <div>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.sub}>{subtitle}</p>}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  title: { margin: 0, fontSize: 22, fontWeight: 700, color: "var(--text-primary)" },
  sub: { margin: "4px 0 0", fontSize: 13, color: "var(--text-muted)" },
};
