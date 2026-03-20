import React, { useState, useCallback } from "react";
import { StyleSheet, View, FlatList, RefreshControl, ScrollView, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withTiming } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { GlassCard } from "@/components/GlassCard";
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

interface Provider {
  id: string;
  businessName: string;
  serviceType?: string;
  rating?: number;
  reviewCount?: number;
}

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
  provider?: Provider;
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
  const tabBarHeight = useFloatingTabBarHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { isAuthenticated, user } = useAuthStore();

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showAccountGate, setShowAccountGate] = useState(false);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

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
    const providerName = item.provider?.businessName || "Service Provider";
    
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(300)} style={styles.cardWrapper}>
        <GlassCard
          onPress={() => handleAppointmentPress(item)}
          testID={`appointment-${item.id}`}
          intensity="light"
        >
          <View style={styles.cardContent}>
            <View style={styles.cardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: Colors.accent + "15" }]}>
                <Feather name="tool" size={20} color={Colors.accent} />
              </View>
              <View style={styles.headerInfo}>
                <ThemedText style={styles.serviceName}>{item.serviceName}</ThemedText>
                <ThemedText style={[styles.providerName, { color: theme.textSecondary }]}>
                  {providerName}
                </ThemedText>
              </View>
              <StatusPill label={statusConfig.label} status={statusConfig.status} size="small" />
            </View>

            <View style={[styles.cardDetails, { borderTopColor: theme.borderLight }]}>
              <View style={styles.detailRow}>
                <View style={styles.detailItem}>
                  <View style={[styles.detailIcon, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="calendar" size={12} color={theme.textSecondary} />
                  </View>
                  <ThemedText style={styles.detailText}>
                    {formatDate(item.scheduledDate)}
                  </ThemedText>
                </View>
                <View style={styles.detailItem}>
                  <View style={[styles.detailIcon, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="clock" size={12} color={theme.textSecondary} />
                  </View>
                  <ThemedText style={styles.detailText}>
                    {item.scheduledTime || "TBD"}
                  </ThemedText>
                </View>
              </View>
              {item.estimatedPrice ? (
                <View style={styles.priceRow}>
                  <ThemedText style={[styles.priceLabel, { color: theme.textSecondary }]}>
                    Est. Price
                  </ThemedText>
                  <ThemedText style={[styles.priceValue, { color: Colors.accent }]}>
                    ${item.estimatedPrice}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          </View>
        </GlassCard>
      </Animated.View>
    );
  };

  const toggleSection = (sectionTitle: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCollapsedSections((prev) => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle],
    }));
  };

  const CollapsibleSection = ({ section }: { section: Section }) => {
    const isCollapsed = collapsedSections[section.title] || false;
    
    return (
      <View style={styles.sectionContainer}>
        <Pressable
          style={[styles.sectionHeader, { backgroundColor: theme.backgroundSecondary }]}
          onPress={() => toggleSection(section.title)}
        >
          <View style={styles.sectionHeaderLeft}>
            <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
            <View style={[styles.countBadge, { backgroundColor: Colors.accent + "15" }]}>
              <ThemedText style={[styles.countText, { color: Colors.accent }]}>
                {section.data.length}
              </ThemedText>
            </View>
          </View>
          <Feather
            name={isCollapsed ? "chevron-down" : "chevron-up"}
            size={20}
            color={theme.textSecondary}
          />
        </Pressable>
        
        {!isCollapsed ? (
          <View style={styles.sectionContent}>
            {section.data.map((item, index) => (
              <React.Fragment key={item.id}>
                {renderAppointment({ item, index })}
              </React.Fragment>
            ))}
          </View>
        ) : null}
      </View>
    );
  };

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
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: tabBarHeight + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        scrollIndicatorInsets={{ bottom: insets.bottom }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
      >
        {sections.map((section) => (
          <CollapsibleSection key={section.title} section={section} />
        ))}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  sectionContainer: {
    marginBottom: Spacing.md,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.sm,
  },
  sectionHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  sectionContent: {
    gap: 0,
  },
  countBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
    minWidth: 24,
    alignItems: "center",
  },
  countText: {
    ...Typography.caption2,
    fontWeight: "600",
  },
  cardWrapper: {
    marginBottom: Spacing.md,
  },
  cardContent: {
    gap: Spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.md,
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  serviceName: {
    ...Typography.body,
    fontWeight: "600",
  },
  providerName: {
    ...Typography.caption1,
  },
  cardDetails: {
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: Spacing.sm,
  },
  detailRow: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  detailIcon: {
    width: 24,
    height: 24,
    borderRadius: BorderRadius.full,
    alignItems: "center",
    justifyContent: "center",
  },
  detailText: {
    ...Typography.footnote,
    fontWeight: "500",
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing.xs,
  },
  priceLabel: {
    ...Typography.caption1,
  },
  priceValue: {
    ...Typography.body,
    fontWeight: "700",
  },
});
