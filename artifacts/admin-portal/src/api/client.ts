import axios from "axios";

// VITE_API_URL — the backend *origin* (no trailing slash, no /api suffix).
//   Example: "https://homebaseproapp.com"
//   In development, leave unset (empty string). All /api/* requests then
//   travel through the Replit shared proxy → api-server on port 8080.
//   In production at admin.homebaseproapp.com, set this build-time env var
//   so requests like /api/auth/login become
//   https://homebaseproapp.com/api/auth/login (axios combines origin + path).
const BACKEND_ORIGIN = import.meta.env.VITE_API_URL ?? "";

export const api = axios.create({
  baseURL: BACKEND_ORIGIN,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("hb_admin_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    if (status === 401 || status === 403) {
      localStorage.removeItem("hb_admin_token");
      localStorage.removeItem("hb_admin_user");
      if (!window.location.pathname.endsWith("/login")) {
        window.location.href = import.meta.env.BASE_URL + "login";
      }
    }
    return Promise.reject(err);
  }
);

export function getApiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error || err.message || "An error occurred";
  }
  if (err instanceof Error) return err.message;
  return "An error occurred";
}
