import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiRequest } from "@/lib/query-client";
import { useAuthStore } from "@/state/authStore";

export const CURRENT_PUSH_TOKEN_STORAGE_KEY = "@homebase/current_push_token";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    return null;
  }

  const easConfigProjectId =
    typeof Constants.easConfig === "object" && Constants.easConfig !== null
      ? (Constants.easConfig as { projectId?: string }).projectId
      : undefined;
  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? easConfigProjectId;

  if (!projectId) {
    console.warn(
      "[push] No EAS projectId found in Constants.expoConfig.extra.eas.projectId. " +
        "Push notifications will not work without it.",
    );
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
    return tokenData.data;
  } catch (err) {
    console.warn("[push] getExpoPushTokenAsync failed:", err);
    return null;
  }
}

export function usePushNotifications() {
  const { user, sessionToken } = useAuthStore();
  const navigation = useNavigation<any>();
  const queryClient = useQueryClient();
  const notificationListener = useRef<Notifications.EventSubscription | null>(null);
  const responseListener = useRef<Notifications.EventSubscription | null>(null);

  useEffect(() => {
    if (!user?.id || !sessionToken) return;

    async function setup() {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token) return;

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
          });
        }

        await apiRequest("POST", "/api/push-tokens", { token, platform: "expo" });
        // Persist for logout: we need to know which device's token to
        // deactivate without affecting the user's other logged-in devices.
        try {
          await AsyncStorage.setItem(CURRENT_PUSH_TOKEN_STORAGE_KEY, token);
        } catch {}
      } catch (err) {
        console.warn("Push notification setup failed:", err);
      }
    }

    setup();

    notificationListener.current = Notifications.addNotificationReceivedListener((notification) => {
      console.log("Notification received:", notification.request.content.title);
      // Task #235: invalidate cached queries when an invoice-related push lands
      // in the foreground so the relevant screens (Payment, InvoiceDetail,
      // Finances, Jobs, AppointmentDetail) refresh without manual pull.
      const data = notification.request.content.data as Record<string, unknown>;
      invalidateQueriesForNotification(data, queryClient);
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      // Same invalidation on tap-through, before navigating, so the destination
      // screen always sees fresh data.
      invalidateQueriesForNotification(data, queryClient);
      handleNotificationNavigation(data, navigation);
    });

    return () => {
      // NOTE: Do NOT call DELETE /api/push-tokens here. This effect re-runs on
      // every auth state change / remount, and deactivating the token on cleanup
      // (combined with re-registration on mount) was creating duplicate rows
      // and causing users to receive 8-9 identical pushes per event. The token
      // should only be deactivated on explicit logout (handled in the auth store).
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [user?.id, sessionToken]);
}

/**
 * Task #235: invalidate React Query caches relevant to a push notification so
 * screens auto-refresh without the user pulling to refresh. Safe to call from
 * both foreground (received) and tap-through (response) listeners.
 */
export function invalidateQueriesForNotification(
  data: Record<string, unknown> | undefined,
  queryClient: ReturnType<typeof useQueryClient>,
) {
  try {
    if (!data) return;
    const type = (data.type as string | undefined) ?? "";
    const invoiceId = data.invoiceId as string | undefined;
    const appointmentId =
      (data.appointmentId as string | undefined) ??
      ((data.params as Record<string, unknown> | undefined)?.appointmentId as
        | string
        | undefined);

    const isInvoiceEvent =
      type === "invoice_paid" ||
      type === "invoice_sent" ||
      type === "invoice_reminder" ||
      // Legacy payload from older server builds that used a generic "invoice"
      // type for sent invoices — keep treating it as an invoice event so the
      // homeowner's in-flight pushes still trigger cache invalidation.
      type === "invoice";

    if (isInvoiceEvent) {
      // Specific invoice + provider/homeowner invoice lists
      if (invoiceId) {
        queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({
        predicate: (q) => {
          const k = q.queryKey;
          return (
            Array.isArray(k) &&
            typeof k[0] === "string" &&
            (k[0] === "/api/provider" || k[0] === "/api/homeowner") &&
            k.includes("invoices")
          );
        },
      });
      // Job/appointment views often render the invoice status
      queryClient.invalidateQueries({ queryKey: ["/api/jobs"] });
      if (appointmentId) {
        queryClient.invalidateQueries({
          queryKey: ["/api/appointments", appointmentId],
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/appointments"] });
    }

    // Always refresh the notification center when any push arrives.
    queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });
  } catch (err) {
    console.warn("invalidateQueriesForNotification error:", err);
  }
}

export function handleNotificationNavigation(
  data: Record<string, unknown>,
  navigation: any
) {
  try {
    if (!data) return;
    const screen = data.screen as string | undefined;
    const params = data.params as Record<string, unknown> | undefined;

    if (screen === "AppointmentDetail" && params?.appointmentId) {
      navigation.navigate("AppointmentDetail", { appointmentId: params.appointmentId });
    } else if (screen === "InvoiceDetail" && params?.invoiceId) {
      navigation.navigate("InvoiceDetail", { invoiceId: params.invoiceId });
    } else if (screen === "ClientDetail" && params?.clientId) {
      navigation.navigate("ClientDetail", { clientId: params.clientId });
    } else if (screen === "SimpleBooking" && data?.providerId) {
      navigation.navigate("SimpleBooking", {
        providerId: data.providerId as string,
        providerName: (data.providerName as string | undefined) ?? undefined,
      });
    } else if (screen === "Notifications") {
      navigation.navigate("Notifications");
    } else if (screen === "Review") {
      const appointmentId = (params?.appointmentId as string | undefined)
        ?? (data.appointmentId as string | undefined);
      if (appointmentId) {
        navigation.navigate("Review", { jobId: appointmentId });
      }
    }
  } catch (err) {
    console.warn("Notification navigation error:", err);
  }
}
