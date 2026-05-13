import React from "react";
import Sidebar from "./Sidebar";
import TopBar from "./TopBar";

interface Props {
  children: React.ReactNode;
}

export default function Layout({ children }: Props) {
  return (
    <div style={styles.shell}>
      <Sidebar />
      <div style={styles.body}>
        <TopBar />
        <main style={styles.main}>
          {children}
        </main>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    display: "flex",
    height: "100vh",
    overflow: "hidden",
    background: "var(--bg)",
  },
  body: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  main: {
    flex: 1,
    overflowY: "auto",
    padding: "28px 32px",
  },
};
