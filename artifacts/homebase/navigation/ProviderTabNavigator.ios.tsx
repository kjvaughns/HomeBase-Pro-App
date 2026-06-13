import React from "react";
import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";
import type { NativeBottomTabNavigationOptions } from "@react-navigation/bottom-tabs/unstable";
import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ProviderHomeScreen from "@/screens/provider/ProviderHomeScreen";
import ClientsScreen from "@/screens/provider/ClientsScreen";
import ScheduleScreen from "@/screens/provider/ScheduleScreen";
import FinancialsScreen from "@/screens/provider/FinancialsScreen";
import ProviderMoreScreen from "@/screens/provider/ProviderMoreScreen";
import { useTheme } from "@/hooks/useTheme";
import { HeaderTitle } from "@/components/HeaderTitle";
import { ThemedText } from "@/components/ThemedText";
import ProviderFAB from "@/components/ProviderFAB";
import { useLeadsBadgeCount } from "@/hooks/useLeadsBadgeCount";
import { useNetworkStore } from "@/state/networkStore";
import { Colors, Spacing, Typography } from "@/constants/theme";

export type ClientsTabFilter = "all" | "lead" | "active" | "inactive" | "has_upcoming" | "overdue";

export type ProviderTabParamList = {
  HomeTab: undefined;
  ClientsTab: { initialFilter?: ClientsTabFilter } | undefined;
  ScheduleTab: undefined;
  FinancialsTab: {
    initialSection?: "overview" | "transactions" | "more";
    initialTransactionTab?: "invoices" | "payouts";
    initialTransactionFilter?: "all" | "invoices" | "estimates";
  } | undefined;
  MoreTab: undefined;
};

const Tab = createNativeBottomTabNavigator<ProviderTabParamList>();

const iosVersion = typeof Platform.Version === "number" ? Platform.Version : 0;
const isIOS26Plus = iosVersion >= 26;

function sfIcon(name: string): NativeBottomTabNavigationOptions["tabBarIcon"] {
  return { type: "sfSymbol", name: name as any };
}

function OfflinePill() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isOnline = useNetworkStore((s) => s.isOnline);
  if (isOnline) return null;
  return (
    <View
      pointerEvents="none"
      style={[styles.offlinePillWrap, { top: insets.top + Spacing.sm }]}
      testID="pill-offline-provider"
    >
      <View
        style={[
          styles.offlinePill,
          {
            backgroundColor: isDark ? "rgba(28,28,30,0.92)" : "rgba(60,60,67,0.92)",
            borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.08)",
          },
        ]}
      >
        <Feather name="wifi-off" size={12} color="#FFFFFF" />
        <ThemedText style={styles.offlinePillText} lightColor="#FFFFFF" darkColor="#FFFFFF">
          Offline — read-only
        </ThemedText>
      </View>
    </View>
  );
}

export default function ProviderTabNavigator() {
  const { theme } = useTheme();
  const leadsBadge = useLeadsBadgeCount();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="HomeTab"
        screenOptions={{
          headerTitleAlign: "center",
          headerTransparent: true,
          headerTintColor: theme.text,
          headerTitleStyle: {
            fontSize: Typography.headline.fontSize,
            fontWeight: Typography.headline.fontWeight,
            color: theme.text,
          },
          headerShadowVisible: false,
          tabBarActiveTintColor: Colors.accent,
          tabBarInactiveTintColor: theme.tabIconDefault,
          // iOS 26+: force tab-bar mode (vs sidebar) — UITabBarController renders
          // the Liquid Glass floating pill automatically on iOS 26.
          // iOS 18–25: "tabBar" keeps the classic UITabBar without the pill.
          tabBarControllerMode: "tabBar",
          // iOS 26+: collapse the floating pill when scrolling down.
          // Omit on iOS < 26 where this option is a no-op / unsupported.
          ...(isIOS26Plus ? { tabBarMinimizeBehavior: "onScrollDown" } : {}),
          // iOS < 26: supply an explicit background colour so the classic UITabBar
          // renders with a solid fill rather than defaulting to system tints that
          // can look broken without the Liquid Glass compositor.
          ...(!isIOS26Plus
            ? { tabBarStyle: { backgroundColor: theme.backgroundRoot } }
            : {}),
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={ProviderHomeScreen}
          options={{
            title: "Home",
            headerTitle: () => <HeaderTitle title="HomeBase Pro" />,
            tabBarIcon: sfIcon("house"),
          }}
        />
        <Tab.Screen
          name="ClientsTab"
          component={ClientsScreen}
          options={{
            title: "Clients",
            headerShown: false,
            tabBarBadge: leadsBadge > 0 ? leadsBadge : undefined,
            tabBarIcon: sfIcon("person.2"),
          }}
        />
        <Tab.Screen
          name="ScheduleTab"
          component={ScheduleScreen}
          options={{
            title: "Schedule",
            headerTitle: "Schedule",
            tabBarIcon: sfIcon("calendar"),
          }}
        />
        <Tab.Screen
          name="FinancialsTab"
          component={FinancialsScreen}
          options={{
            title: "Finance",
            headerTitle: "Finance",
            tabBarIcon: sfIcon("chart.bar"),
          }}
        />
        <Tab.Screen
          name="MoreTab"
          component={ProviderMoreScreen}
          options={{
            title: "More",
            headerTitle: "More",
            tabBarIcon: sfIcon("ellipsis"),
          }}
        />
      </Tab.Navigator>
      <ProviderFAB />
      <OfflinePill />
    </View>
  );
}

const styles = StyleSheet.create({
  offlinePillWrap: {
    position: "absolute",
    left: 0,
    right: 0,
    alignItems: "center",
    zIndex: 9999,
  },
  offlinePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  offlinePillText: {
    ...Typography.footnote,
    fontWeight: "600",
    fontSize: 11,
  },
});
