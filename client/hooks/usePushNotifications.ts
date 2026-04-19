import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
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

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: "homebase-app",
    });
    return tokenData.data;
  } catch {
    try {
      const tokenData = await Notifications.getExpoPushTokenAsync();
      return tokenData.data;
    } catch {
      return null;
    }
  }
}

export function usePushNotifications() {
  const { user, sessionToken } = useAuthStore();
  const navigation = useNavigation<any>();
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
    });

    responseListener.current = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
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
