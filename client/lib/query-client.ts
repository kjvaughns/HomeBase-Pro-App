import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Platform } from "react-native";
import { useAuthStore } from "@/state/authStore";

// Tracks whether we have already kicked off a global session-expiry logout.
// Without this latch, parallel queries failing 401 in the same render cycle
// would each call `logout()` and clobber the post-logout navigation state.
let sessionExpiryHandled = false;
let lastSessionTokenSeen: string | null = null;

function handleSessionExpiry() {
  // Only react when the user actually has a session — we don't want a 401
  // from /api/auth/login (wrong password) to log out a logged-out user.
  const { sessionToken } = useAuthStore.getState();
  if (!sessionToken) return;
  if (sessionExpiryHandled && lastSessionTokenSeen === sessionToken) return;
  sessionExpiryHandled = true;
  lastSessionTokenSeen = sessionToken;
  // Defer to a microtask so React Query can settle the failing query first.
  setTimeout(() => {
    try {
      useAuthStore.getState().logout();
    } catch (err) {
      console.error("[query-client] session expiry logout failed:", err);
    }
    // Re-arm so a future session can also expire cleanly.
    setTimeout(() => {
      sessionExpiryHandled = false;
    }, 1000);
  }, 0);
}

/**
 * Gets the base URL for the Express API server.
 * EXPO_PUBLIC_DOMAIN may be set with or without a protocol prefix.
 * We always strip any existing prefix and rebuild with https:// to avoid
 * constructing a double-protocol URL like https://https//api.example.com.
 *
 * On web (browser simulation), we strip any explicit port because the
 * Express backend is served through the standard port-80 proxy — using
 * a raw `:5000` URL is blocked by external port rules and CORS.
 */
export function getApiUrl(): string {
  let host = process.env.EXPO_PUBLIC_DOMAIN;

  if (!host) {
    throw new Error("EXPO_PUBLIC_DOMAIN is not set");
  }

  // Strip any existing http:// or https:// prefix before constructing the URL
  host = host.replace(/^https?:\/\//, "");

  // On web, the Express API is accessible via the default port (80/443 proxy).
  // Strip any explicit port (e.g. ":5000") so requests stay same-origin.
  if (Platform.OS === "web") {
    host = host.replace(/:\d+$/, "");
  }

  const url = new URL(`https://${host}`);

  return url.href;
}

export function getAuthHeaders(): Record<string, string> {
  const { sessionToken } = useAuthStore.getState();
  if (sessionToken) {
    return { Authorization: `Bearer ${sessionToken}` };
  }
  return {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  route: string,
  data?: unknown | undefined,
): Promise<Response> {
  const baseUrl = getApiUrl();
  const url = new URL(route, baseUrl);

  const headers: Record<string, string> = {
    ...getAuthHeaders(),
    "X-Client-Platform": Platform.OS,
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  if (res.status === 401) {
    handleSessionExpiry();
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const baseUrl = getApiUrl();
    const url = new URL(queryKey.join("/") as string, baseUrl);

    const res = await fetch(url, {
      credentials: "include",
      headers: { ...getAuthHeaders(), "X-Client-Platform": Platform.OS },
    });

    if (res.status === 401) {
      // Always trigger global expiry handling for authenticated queries —
      // even when on401 is "returnNull", a 401 here means the session is
      // invalid and the user needs to be routed back to Welcome / Login.
      handleSessionExpiry();
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
    mutations: {
      retry: false,
    },
  },
});
