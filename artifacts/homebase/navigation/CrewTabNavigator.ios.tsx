import React from "react";
import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";
import type { NativeBottomTabNavigationOptions } from "@react-navigation/bottom-tabs/unstable";
import { Feather } from "@expo/vector-icons";
import { Platform, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MyJobsScreen from "@/screens/crew/MyJobsScreen";
import CrewScheduleScreen from "@/screens/crew/CrewScheduleScreen";
import CrewMoreScreen from "@/screens/crew/CrewMoreScreen";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { useNetworkStore } from "@/state/networkStore";
import { Colors, Spacing, Typography } from "@/constants/theme";

export type CrewTabParamList = {
  CrewMyJobsTab: undefined;
  CrewScheduleTab: undefined;
  CrewMoreTab: undefined;
};

const Tab = createNativeBottomTabNavigator<CrewTabParamList>();

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
      testID="pill-offline-crew"
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

export default function CrewTabNavigator() {
  const { theme } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="CrewMyJobsTab"
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
          // iOS 26+: force tab-bar mode — UITabBarController renders the
          // Liquid Glass floating pill automatically on iOS 26.
          // iOS 18–25: keeps the classic UITabBar.
          tabBarControllerMode: "tabBar",
          ...(isIOS26Plus ? { tabBarMinimizeBehavior: "onScrollDown" } : {}),
          ...(!isIOS26Plus
            ? { tabBarStyle: { backgroundColor: theme.backgroundRoot } }
            : {}),
        }}
      >
        <Tab.Screen
          name="CrewMyJobsTab"
          component={MyJobsScreen}
          options={{
            title: "My Jobs",
            headerTitle: "My Jobs",
            tabBarIcon: sfIcon("clipboard"),
          }}
        />
        <Tab.Screen
          name="CrewScheduleTab"
          component={CrewScheduleScreen}
          options={{
            title: "Schedule",
            headerTitle: "Schedule",
            tabBarIcon: sfIcon("calendar"),
          }}
        />
        <Tab.Screen
          name="CrewMoreTab"
          component={CrewMoreScreen}
          options={{
            title: "More",
            headerTitle: "More",
            tabBarIcon: sfIcon("ellipsis"),
          }}
        />
      </Tab.Navigator>
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
