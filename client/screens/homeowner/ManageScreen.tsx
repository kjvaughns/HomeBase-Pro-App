import React, { useState, useEffect, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, Pressable, SectionList } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { StatusPill } from "@/components/StatusPill";
import { Avatar } from "@/components/Avatar";
import { EmptyState } from "@/components/EmptyState";
import { AccountGateModal } from "@/components/AccountGateModal";
import { SkeletonCard } from "@/components/SkeletonLoader";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";

type AppointmentStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";

interface Appointment {
  id: string;
  userId: string;
  homeId: string;
  providerId: string;
  serviceId?: string;
  serviceName: string;
  description?: string;
  urgency?: string;
  jobSize?: string;
  scheduledDate: string;
  scheduledTime: string;
  status: AppointmentStatus;
  estimatedPrice?: string;
  finalPrice?: string;
  providerNotes?: string;
  createdAt: string;
  updatedAt: string;
}

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const STATUS_CONFIG: Record<AppointmentStatus, { label: string; status: "success" | "info" | "warning" | "neutral" | "cancelled" }> = {
  pending: { label: "Pending", status: "info" },
  confirmed: { label: "Confirmed", status: "info" },
  in_progress: { label: "In Progress", status: "warning" },
  completed: { label: "Completed", status: "success" },
  cancelled: { label: "Cancelled", status: "cancelled" },
};

type Section = {
  title: string;
  data: Appointment[];
};

export default function ManageScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useBottomTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { isAuthenticated, user } = useAuthStore();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAccountGate, setShowAccountGate] = useState(false);

  const fetchAppointments = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }
    try {
      const response = await fetch(new URL(`/api/appointments/${user.id}`, getApiUrl()).href);
      const data = await response.json();
      setAppointments(data.appointments || []);
    } catch (error) {
      console.error("Failed to fetch appointments:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchAppointments();
    }, [fetchAppointments])
  );

  const sections: Section[] = React.useMemo(() => {
    if (!isAuthenticated || appointments.length === 0) return [];

    const upcoming = appointments.filter((a) => ["pending", "confirmed"].includes(a.status));
    const active = appointments.filter((a) => a.status === "in_progress");
    const past = appointments.filter((a) => ["completed", "cancelled"].includes(a.status));

    const result: Section[] = [];
    if (upcoming.length > 0) result.push({ title: "Upcoming", data: upcoming });
    if (active.length > 0) result.push({ title: "Active", data: active });
    if (past.length > 0) result.push({ title: "Past", data: past });

    return result;
  }, [appointments, isAuthenticated]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAppointments();
    setRefreshing(false);
  };

  const handleAppointmentPress = (appointment: Appointment) => {
    navigation.navigate("AppointmentDetail", { appointmentId: appointment.id });
  };

  const handleSignIn = () => {
    setShowAccountGate(false);
    navigation.navigate("Login");
  };

  const handleSignUp = () => {
    setShowAccountGate(false);
    navigation.navigate("SignUp");
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return dateString;
    }
  };

  const renderAppointment = ({ item, index }: { item: Appointment; index: number }) => {
    const statusConfig = STATUS_CONFIG[item.status] || { label: item.status, status: "neutral" as const };
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
        <Pressable
          onPress={() => handleAppointmentPress(item)}
          style={[styles.jobCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}
          testID={`appointment-${item.id}`}
        >
          <View style={styles.jobHeader}>
            <Avatar name={item.serviceName} size="medium" />
            <View style={styles.jobInfo}>
              <ThemedText style={styles.providerName}>{item.serviceName}</ThemedText>
              <ThemedText style={[styles.serviceName, { color: theme.textSecondary }]}>
                {item.description || "Service appointment"}
              </ThemedText>
            </View>
            <StatusPill label={statusConfig.label} status={statusConfig.status} size="small" />
          </View>

          <View style={[styles.jobDetails, { borderTopColor: theme.borderLight }]}>
            <View style={styles.detailItem}>
              <Feather name="calendar" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                {formatDate(item.scheduledDate)}
              </ThemedText>
            </View>
            <View style={styles.detailItem}>
              <Feather name="clock" size={14} color={theme.textSecondary} />
              <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                {item.scheduledTime || "TBD"}
              </ThemedText>
            </View>
            {item.estimatedPrice ? (
              <View style={styles.detailItem}>
                <Feather name="dollar-sign" size={14} color={theme.textSecondary} />
                <ThemedText style={[styles.detailText, { color: theme.textSecondary }]}>
                  ${item.estimatedPrice}
                </ThemedText>
              </View>
            ) : null}
          </View>
        </Pressable>
      </Animated.View>
    );
  };

  const renderSectionHeader = ({ section }: { section: Section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.backgroundDefault }]}>
      <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
      <ThemedText style={[styles.sectionCount, { color: theme.textSecondary }]}>
        {section.data.length}
      </ThemedText>
    </View>
  );

  const renderEmpty = () => {
    if (!isAuthenticated) {
      return (
        <EmptyState
          image={require("../../../assets/images/empty-bookings.png")}
          title="Sign in to manage appointments"
          description="Create an account to book services, track your projects, and manage your home."
          primaryAction={{
            label: "Sign In",
            onPress: () => setShowAccountGate(true),
          }}
        />
      );
    }

    return (
      <EmptyState
        image={require("../../../assets/images/empty-bookings.png")}
        title="No appointments yet"
        description="When you book a service, it will appear here. Start by finding a pro!"
        primaryAction={{
          label: "Find a Pro",
          onPress: () => navigation.navigate("Main"),
        }}
      />
    );
  };

  if (isLoading) {
    return (
      <ThemedView style={styles.container}>
        <FlatList
          data={[1, 2, 3]}
          renderItem={() => <SkeletonCard />}
          keyExtractor={(item) => item.toString()}
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          }}
        />
      </ThemedView>
    );
  }

  if (!isAuthenticated || sections.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <View
          style={{
            flex: 1,
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          }}
        >
          {renderEmpty()}
        </View>
        <AccountGateModal
          visible={showAccountGate}
          onClose={() => setShowAccountGate(false)}
          onSignIn={handleSignIn}
          onSignUp={handleSignUp}
        />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SectionList
        sections={sections}
        renderItem={renderAppointment}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  sectionTitle: {
    ...Typography.headline,
    fontWeight: "600",
  },
  sectionCount: {
    ...Typography.subhead,
  },
  jobCard: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  jobHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  jobInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  providerName: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  serviceName: {
    ...Typography.caption1,
    marginTop: 2,
  },
  jobDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.md,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  detailText: {
    ...Typography.caption1,
  },
});
