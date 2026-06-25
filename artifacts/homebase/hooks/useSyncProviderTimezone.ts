import { useEffect, useRef } from "react";
import { apiRequest } from "@/lib/query-client";
import { useAuthStore } from "@/state/authStore";

/**
 * Detects the device's IANA timezone once per session (when a provider is
 * authenticated) and persists it to the server so that the monthly recap push
 * scheduler can deliver notifications at 9am in the provider's local time.
 *
 * Uses a ref to guard against re-sending on re-renders or tab focus changes.
 * Fire-and-forget: errors are swallowed — timezone sync is best-effort.
 */
export function useSyncProviderTimezone(): void {
  const providerProfile = useAuthStore((s) => s.providerProfile);
  const sessionToken = useAuthStore((s) => s.sessionToken);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (!providerProfile || !sessionToken || hasSynced.current) return;

    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezone) return;

    hasSynced.current = true;

    apiRequest("PATCH", "/api/provider/timezone", { timezone }).catch(() => {
      // Reset so we retry on the next mount if the request failed
      hasSynced.current = false;
    });
  }, [providerProfile?.id, sessionToken]);
}
