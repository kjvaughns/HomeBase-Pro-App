import React, { useEffect, useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  RefreshControl,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation, useFocusEffect } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { StatusPill } from "@/components/StatusPill";
import { SectionHeader } from "@/components/SectionHeader";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/state/authStore";
import { getApiUrl } from "@/lib/query-client";
import { StatusType } from "@/components/StatusPill";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface ServiceHistoryItem {
  id: string;
  serviceName: string;
  description: string | null;
  status: string;
  scheduledDate: string;
  completedAt: string | null;
  finalPrice: string | null;
  estimatedPrice: string | null;
}

interface MaintenanceReminder {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  frequency: string;
  nextDueAt: string;
  lastCompletedAt: string | null;
}

const STATUS_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  completed: "check-circle",
  in_progress: "clock",
  confirmed: "calendar",
  pending: "clock",
  cancelled: "x-circle",
};

const CATEGORY_ICONS: Record<string, keyof typeof Feather.glyphMap> = {
  hvac: "wind",
  plumbing: "droplet",
  electrical: "zap",
  roof: "home",
  appliance: "cpu",
  lawn: "sun",
  general: "tool",
};

const mapStatusToType = (status: string): StatusType => {
  switch (status) {
    case "completed":
      return "completed";
    case "in_progress":
      return "inProgress";
    case "confirmed":
      return "scheduled";
    case "cancelled":
      return "cancelled";
    case "pending":
    default:
      return "pending";
  }
};

export default function ServiceHistoryScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  
  const { user } = useAuthStore();
  
  const [serviceHistory, setServiceHistory] = useState<ServiceHistoryItem[]>([]);
  const [reminders, setReminders] = useState<MaintenanceReminder[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;
    
    const homeId = "home-1";
    
    try {
      const [historyRes, remindersRes] = await Promise.all([
        fetch(new URL(`/api/homes/${homeId}/service-history`, getApiUrl()).toString()),
        fetch(new URL(`/api/homes/${homeId}/reminders`, getApiUrl()).toString()),
      ]);
      
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setServiceHistory(historyData.serviceHistory || []);
      }
      
      if (remindersRes.ok) {
        const remindersData = await remindersRes.json();
        setReminders(remindersData.reminders || []);
      }
    } catch (error) {
      console.error("Error fetching service history:", error);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  }, [fetchData]);

  const handleCompleteReminder = async (reminderId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    try {
      const response = await fetch(
        new URL(`/api/reminders/${reminderId}/complete`, getApiUrl()).toString(),
        { method: "PUT" }
      );
      if (response.ok) {
        await fetchData();
      }
    } catch (error) {
      console.error("Error completing reminder:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getDaysUntilDue = (dateStr: string) => {
    const now = new Date();
    const dueDate = new Date(dateStr);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return Colors.accent;
      case "in_progress":
        return "#007AFF";
      case "cancelled":
        return "#FF3B30";
      default:
        return theme.textSecondary;
    }
  };

  const renderReminder = ({ item, index }: { item: MaintenanceReminder; index: number }) => {
    const daysUntil = getDaysUntilDue(item.nextDueAt);
    const isOverdue = daysUntil < 0;
    const isDueSoon = daysUntil >= 0 && daysUntil <= 7;
    
    return (
      <Animated.View entering={FadeInDown.delay(index * 50).duration(300)}>
        <View style={[styles.reminderCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
          <View style={[
            styles.reminderIcon,
            { backgroundColor: isOverdue ? "rgba(255,59,48,0.1)" : isDueSoon ? "rgba(255,159,10,0.1)" : Colors.accentLight }
          ]}>
            <Feather
              name={CATEGORY_ICONS[item.category || "general"] || "tool"}
              size={20}
              color={isOverdue ? "#FF3B30" : isDueSoon ? "#FF9F0A" : Colors.accent}
            />
          </View>
          <View style={styles.reminderContent}>
            <ThemedText style={styles.reminderTitle}>{item.title}</ThemedText>
            <ThemedText style={[styles.reminderDue, {
              color: isOverdue ? "#FF3B30" : isDueSoon ? "#FF9F0A" : theme.textSecondary
            }]}>
              {isOverdue ? `Overdue by ${Math.abs(daysUntil)} days` :
               daysUntil === 0 ? "Due today" :
               `Due in ${daysUntil} days`}
            </ThemedText>
          </View>
          <Pressable
            onPress={() => handleCompleteReminder(item.id)}
            style={[styles.completeButton, { borderColor: Colors.accent }]}
          >
            <Feather name="check" size={16} color={Colors.accent} />
          </Pressable>
        </View>
      </Animated.View>
    );
  };

  const renderHistoryItem = ({ item, index }: { item: ServiceHistoryItem; index: number }) => (
    <Animated.View entering={FadeInDown.delay(100 + index * 50).duration(300)}>
      <View style={[styles.historyCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
        <View style={[styles.historyIcon, { backgroundColor: getStatusColor(item.status) + "20" }]}>
          <Feather
            name={STATUS_ICONS[item.status] || "clock"}
            size={18}
            color={getStatusColor(item.status)}
          />
        </View>
        <View style={styles.historyContent}>
          <ThemedText style={styles.historyTitle}>{item.serviceName}</ThemedText>
          <ThemedText style={[styles.historyDate, { color: theme.textSecondary }]}>
            {formatDate(item.completedAt || item.scheduledDate)}
          </ThemedText>
          {item.description ? (
            <ThemedText style={[styles.historyDescription, { color: theme.textSecondary }]} numberOfLines={2}>
              {item.description}
            </ThemedText>
          ) : null}
        </View>
        <View style={styles.historyMeta}>
          <StatusPill status={mapStatusToType(item.status)} label={item.status.replace("_", " ")} size="small" />
          {item.finalPrice || item.estimatedPrice ? (
            <ThemedText style={[styles.historyPrice, { color: theme.text }]}>
              ${item.finalPrice || item.estimatedPrice}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </Animated.View>
  );

  const ListHeader = () => (
    <View>
      {reminders.length > 0 ? (
        <View style={styles.section}>
          <SectionHeader title="Upcoming Maintenance" />
          {reminders.map((reminder, index) => (
            <View key={reminder.id}>
              {renderReminder({ item: reminder, index })}
            </View>
          ))}
        </View>
      ) : null}
      
      <SectionHeader title="Service History" />
    </View>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: theme.cardBackground }]}>
        <Feather name="clock" size={48} color={theme.textSecondary} />
      </View>
      <ThemedText style={[styles.emptyTitle, { color: theme.text }]}>
        No service history yet
      </ThemedText>
      <ThemedText style={[styles.emptyDescription, { color: theme.textSecondary }]}>
        Your completed services and maintenance will appear here
      </ThemedText>
    </View>
  );

  return (
    <ThemedView style={styles.container}>
      <FlatList
        data={serviceHistory}
        keyExtractor={(item) => item.id}
        renderItem={renderHistoryItem}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={!loading ? EmptyState : null}
        contentContainerStyle={[
          styles.listContent,
          { paddingTop: headerHeight + Spacing.md, paddingBottom: insets.bottom + Spacing["2xl"] }
        ]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.accent}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing.screenPadding,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  reminderCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  reminderIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.md,
  },
  reminderContent: {
    flex: 1,
  },
  reminderTitle: {
    ...Typography.headline,
  },
  reminderDue: {
    ...Typography.caption1,
    marginTop: 2,
  },
  completeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  historyCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  historyIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    marginRight: Spacing.sm,
  },
  historyContent: {
    flex: 1,
  },
  historyTitle: {
    ...Typography.headline,
  },
  historyDate: {
    ...Typography.caption1,
    marginTop: 2,
  },
  historyDescription: {
    ...Typography.caption1,
    marginTop: 4,
  },
  historyMeta: {
    alignItems: "flex-end",
  },
  historyPrice: {
    ...Typography.subhead,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: Spacing["3xl"],
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.title2,
    marginBottom: Spacing.xs,
  },
  emptyDescription: {
    ...Typography.body,
    textAlign: "center",
  },
});
