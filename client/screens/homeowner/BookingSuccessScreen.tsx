import React, { useEffect } from "react";
import { StyleSheet, View, ActivityIndicator } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute, useNavigation, RouteProp, CommonActions } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, ZoomIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useQuery } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { getApiUrl, getAuthHeaders } from "@/lib/query-client";

type ScreenRouteProp = RouteProp<RootStackParamList, "BookingSuccess">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface AppointmentRecord {
  id: string;
  serviceName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: string;
  estimatedPrice: string | null;
  description: string | null;
}

export default function BookingSuccessScreen() {
  const insets = useSafeAreaInsets();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { jobId } = route.params;

  const { data: aptData, isLoading } = useQuery<{ appointment: AppointmentRecord }>({
    queryKey: ["/api/appointments", jobId],
    enabled: !!jobId && jobId !== "booking",
    queryFn: async () => {
      const url = new URL(`/api/appointments/${jobId}`, getApiUrl());
      const res = await fetch(url.toString(), { headers: getAuthHeaders(), credentials: "include" });
      if (!res.ok) throw new Error("Failed to load appointment");
      return res.json();
    },
  });

  const appointment = aptData?.appointment;

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const handleViewJob = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 1,
        routes: [
          { name: "Main" },
          { name: "JobDetail", params: { jobId } },
        ],
      })
    );
  };

  const handleGoHome = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Main" }],
      })
    );
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={styles.content}>
        <Animated.View entering={ZoomIn.duration(500).springify()} style={styles.iconContainer}>
          <View style={[styles.iconCircle, { backgroundColor: Colors.accentLight }]}>
            <Feather name="check" size={48} color={Colors.accent} />
          </View>
        </Animated.View>

        <Animated.View entering={FadeIn.delay(300).duration(400)}>
          <ThemedText style={styles.title}>Booking Confirmed!</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            Your service has been scheduled
          </ThemedText>
        </Animated.View>

        {isLoading ? (
          <Animated.View entering={FadeIn.delay(500).duration(400)} style={styles.detailsCard}>
            <ActivityIndicator size="large" color={Colors.accent} />
          </Animated.View>
        ) : appointment ? (
          <Animated.View entering={FadeIn.delay(500).duration(400)} style={styles.detailsCard}>
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
              <View style={styles.cardRow}>
                <Feather name="tool" size={18} color={theme.textSecondary} />
                <ThemedText style={styles.cardLabel}>Service</ThemedText>
                <ThemedText style={styles.cardValue}>{appointment.serviceName}</ThemedText>
              </View>
              {appointment.scheduledDate ? (
                <View style={styles.cardRow}>
                  <Feather name="calendar" size={18} color={theme.textSecondary} />
                  <ThemedText style={styles.cardLabel}>Date</ThemedText>
                  <ThemedText style={styles.cardValue}>{formatDate(appointment.scheduledDate)}</ThemedText>
                </View>
              ) : null}
              {appointment.scheduledTime ? (
                <View style={styles.cardRow}>
                  <Feather name="clock" size={18} color={theme.textSecondary} />
                  <ThemedText style={styles.cardLabel}>Time</ThemedText>
                  <ThemedText style={styles.cardValue}>{appointment.scheduledTime}</ThemedText>
                </View>
              ) : null}
              <View style={[styles.cardRow, { borderBottomWidth: 0 }]}>
                <Feather name="info" size={18} color={theme.textSecondary} />
                <ThemedText style={styles.cardLabel}>Status</ThemedText>
                <ThemedText style={[styles.cardValue, { color: Colors.accent, textTransform: "capitalize" }]}>
                  {appointment.status || "Pending"}
                </ThemedText>
              </View>
            </View>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.delay(500).duration(400)} style={styles.detailsCard}>
            <View style={[styles.card, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
              <ThemedText style={[styles.cardValue, { textAlign: "center", color: theme.textSecondary }]}>
                Your appointment has been submitted and is pending confirmation.
              </ThemedText>
            </View>
          </Animated.View>
        )}
      </View>

      <Animated.View entering={FadeIn.delay(700).duration(400)} style={styles.actions}>
        <PrimaryButton onPress={handleViewJob} style={styles.actionBtn}>
          View Appointment
        </PrimaryButton>
        <SecondaryButton onPress={handleGoHome} style={styles.actionBtn}>
          Back to Home
        </SecondaryButton>
      </Animated.View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
  },
  content: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing.xl,
  },
  iconContainer: {
    marginBottom: Spacing.xl,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    ...Typography.largeTitle,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.subhead,
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  detailsCard: {
    width: "100%",
    maxWidth: 400,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: "hidden",
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.07)",
    gap: Spacing.sm,
  },
  cardLabel: {
    ...Typography.subhead,
    flex: 1,
  },
  cardValue: {
    ...Typography.subhead,
    fontWeight: "600",
    textAlign: "right",
    flex: 2,
  },
  actions: {
    padding: Spacing.xl,
    gap: Spacing.md,
  },
  actionBtn: {},
});
