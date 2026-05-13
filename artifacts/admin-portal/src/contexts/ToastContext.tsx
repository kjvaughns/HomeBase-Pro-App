import React, { createContext, useContext, useState, useCallback } from "react";

export type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({ addToast: () => {} });

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    const duration = type === "error" ? 5000 : 3000;
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const remove = (id: string) => setToasts((prev) => prev.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={styles.container}>
        {toasts.map((t) => (
          <div key={t.id} style={{ ...styles.toast, ...styles[t.type] }}>
            <span style={{ flex: 1 }}>{t.message}</span>
            <button onClick={() => remove(t.id)} style={styles.closeBtn}>×</button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: "fixed",
    bottom: 24,
    right: 24,
    zIndex: 9999,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    maxWidth: 380,
  },
  toast: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 500,
    boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
    animation: "slideIn 0.2s ease",
  },
  success: { background: "#38AE5F", color: "#fff" },
  error: { background: "#ef4444", color: "#fff" },
  info: { background: "#3b82f6", color: "#fff" },
  closeBtn: {
    background: "none",
    border: "none",
    color: "inherit",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    padding: 0,
    opacity: 0.8,
    flexShrink: 0,
  },
};

export function useToast() {
  return useContext(ToastContext);
}
