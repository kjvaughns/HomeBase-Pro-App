import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastProvider } from "./contexts/ToastContext";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Homeowners from "./pages/Homeowners";
import HomeownerDetail from "./pages/HomeownerDetail";
import Providers from "./pages/Providers";
import ProviderDetail from "./pages/ProviderDetail";
import SupportTickets from "./pages/SupportTickets";
import SupportTicketDetail from "./pages/SupportTicketDetail";
import Broadcasts from "./pages/Broadcasts";
import Analytics from "./pages/Analytics";
import AuditLogs from "./pages/AuditLogs";
import Settings from "./pages/Settings";

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, token } = useAuth();
  if (!token || !user?.isAdmin) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user?.isAdmin ? <Navigate to="/dashboard" replace /> : <Login />} />
      <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
      <Route path="/homeowners" element={<RequireAuth><Homeowners /></RequireAuth>} />
      <Route path="/homeowners/:id" element={<RequireAuth><HomeownerDetail /></RequireAuth>} />
      <Route path="/providers" element={<RequireAuth><Providers /></RequireAuth>} />
      <Route path="/providers/:id" element={<RequireAuth><ProviderDetail /></RequireAuth>} />
      <Route path="/partners" element={<RequireAuth><Providers partnerOnly={true} /></RequireAuth>} />
      <Route path="/support" element={<RequireAuth><SupportTickets /></RequireAuth>} />
      <Route path="/support/:id" element={<RequireAuth><SupportTicketDetail /></RequireAuth>} />
      <Route path="/broadcasts" element={<RequireAuth><Broadcasts /></RequireAuth>} />
      <Route path="/analytics" element={<RequireAuth><Analytics /></RequireAuth>} />
      <Route path="/audit-logs" element={<RequireAuth><AuditLogs /></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><Settings /></RequireAuth>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <BrowserRouter basename={import.meta.env.BASE_URL.replace(/\/$/, "")}>
              <AppRoutes />
            </BrowserRouter>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
