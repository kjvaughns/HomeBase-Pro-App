import { Platform } from "react-native";
import { ExtensionStorage } from "@bacons/apple-targets";
import { apiRequest, getApiUrl } from "@/lib/query-client";

// Must match `APP_GROUP` in targets/widgets/expo-target.config.js and
// `appGroupId` in targets/widgets/SharedModels.swift.
const WIDGET_APP_GROUP = "group.com.homebasepro.app.widgets";

const storage =
  Platform.OS === "ios" ? new ExtensionStorage(WIDGET_APP_GROUP) : null;

interface WidgetSnapshotResponse {
  businessName: string | null;
  nextJob: {
    scheduledDate: string;
    scheduledTime: string | null;
    clientName: string;
  } | null;
  earnedTodayCents: number;
}

let cachedToken: string | null = null;

/**
 * Fetches (and caches on the server, if missing) the opaque widget access
 * token for this provider. The token lets the widget's own background
 * network refresh call GET /api/public/widget-snapshot without a logged-in
 * session.
 */
async function ensureWidgetToken(providerId: string): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    const res = await apiRequest(
      "POST",
      `/api/provider/${providerId}/widget-token`,
    );
    const data = (await res.json()) as { token: string };
    cachedToken = data.token;
    return cachedToken;
  } catch {
    return null;
  }
}

/**
 * Refreshes the shared App Group data the "Next Job" and "Earned Today"
 * widgets read from, then asks WidgetKit to reload them. Pulls the
 * authoritative snapshot from the same public endpoint the widget's own
 * background timeline refresh uses, so the app and widget never disagree
 * about "next job" ordering or the paid-invoice total.
 *
 * Safe to call on every relevant data refresh (job list load, invoice
 * payment, pull-to-refresh, etc.) — it's a no-op on non-iOS platforms and
 * swallows errors so a flaky network never breaks the main app experience.
 */
export async function syncProviderWidgetData(providerId: string): Promise<void> {
  if (!storage || !providerId) return;

  try {
    const token = await ensureWidgetToken(providerId);
    if (!token) return;

    const apiBaseUrl = getApiUrl();
    storage.set("widgetAuth", JSON.stringify({ providerId, token, apiBaseUrl }));

    const url = new URL("api/public/widget-snapshot", apiBaseUrl);
    url.searchParams.set("providerId", providerId);
    url.searchParams.set("token", token);
    const res = await fetch(url);
    if (!res.ok) return;

    const snapshot = (await res.json()) as WidgetSnapshotResponse;
    storage.set(
      "widgetSnapshot",
      JSON.stringify({ ...snapshot, updatedAt: Date.now() }),
    );

    ExtensionStorage.reloadWidget();
  } catch {
    // Widget sync is best-effort; never let it break the main app experience.
  }
}
