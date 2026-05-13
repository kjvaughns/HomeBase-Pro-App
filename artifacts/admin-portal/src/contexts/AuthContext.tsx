import React, { createContext, useContext, useState, useCallback } from "react";
import { api } from "../api/client";

interface AdminUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  isAdmin: boolean;
}

interface AuthState {
  user: AdminUser | null;
  token: string | null;
  isLoading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem("hb_admin_token");
    const userRaw = localStorage.getItem("hb_admin_user");
    let user: AdminUser | null = null;
    try {
      if (userRaw) user = JSON.parse(userRaw);
    } catch {}
    return { user, token, isLoading: false };
  });

  const login = useCallback(async (email: string, password: string) => {
    setState((s) => ({ ...s, isLoading: true }));
    try {
      const res = await api.post("/api/auth/login", { email, password });
      const { token, user } = res.data;
      if (!user?.isAdmin) {
        throw new Error("Access denied — admin only");
      }
      localStorage.setItem("hb_admin_token", token);
      localStorage.setItem("hb_admin_user", JSON.stringify(user));
      setState({ user, token, isLoading: false });
    } catch (err) {
      setState((s) => ({ ...s, isLoading: false }));
      throw err;
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("hb_admin_token");
    localStorage.removeItem("hb_admin_user");
    setState({ user: null, token: null, isLoading: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
