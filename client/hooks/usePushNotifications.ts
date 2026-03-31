import { useEffect, useRef } from "react";
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { apiRequest } from "@/lib/query-client";
import { useAuthStore } from "@/state/authStore";

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

    let currentToken: string | null = null;

    async function setup() {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token) return;
        currentToken = token;

        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "default",
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: "#FF231F7C",
          });
        }

        await apiRequest("POST", "/api/push-tokens", { token, platform: "expo" });
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
      if (notificationListener.current) {
        Notifications.removeNotificationSubscription(notificationListener.current);
      }
      if (responseListener.current) {
        Notifications.removeNotificationSubscription(responseListener.current);
      }
      if (currentToken) {
        apiRequest("DELETE", "/api/push-tokens", { token: currentToken }).catch(() => {});
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
    } else if (screen === "Notifications") {
      navigation.navigate("Notifications");
    }
  } catch (err) {
    console.warn("Notification navigation error:", err);
  }
}
