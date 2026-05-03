import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, useWindowDimensions, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ProviderHomeScreen from "@/screens/provider/ProviderHomeScreen";
import ClientsScreen from "@/screens/provider/ClientsScreen";
import ScheduleScreen from "@/screens/provider/ScheduleScreen";
import LeadsScreen from "@/screens/provider/LeadsScreen";
import FinancialsScreen from "@/screens/provider/FinancialsScreen";
import ProviderMoreScreen from "@/screens/provider/ProviderMoreScreen";
import { useTheme } from "@/hooks/useTheme";
import { HeaderTitle } from "@/components/HeaderTitle";
import { ThemedText } from "@/components/ThemedText";
import ProviderFAB from "@/components/ProviderFAB";
import { useLeadsBadgeCount } from "@/hooks/useLeadsBadgeCount";
import { useNetworkStore } from "@/state/networkStore";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

export type ProviderTabParamList = {
  HomeTab: undefined;
  ClientsTab: undefined;
  ScheduleTab: undefined;
  LeadsTab: undefined;
  FinancialsTab: undefined;
  MoreTab: undefined;
};

const Tab = createBottomTabNavigator<ProviderTabParamList>();

function getIconName(routeName: string): keyof typeof Feather.glyphMap {
  switch (routeName) {
    case "HomeTab":
      return "home";
    case "ClientsTab":
      return "users";
    case "ScheduleTab":
      return "calendar";
    case "LeadsTab":
      return "inbox";
    case "FinancialsTab":
      return "bar-chart-2";
    case "MoreTab":
      return "menu";
    default:
      return "circle";
  }
}

function CustomTabBar({ state, descriptors, navigation }: any) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  const isTablet = width >= 768;
  const horizontalMargin = isTablet ? Math.max(24, (width - 540) / 2) : Math.max(16, width * 0.04);
  const maxWidth = isTablet ? 540 : 400;
  const tabBarWidth = width - horizontalMargin * 2;
  const finalWidth = Math.min(tabBarWidth, maxWidth);
  
  const iconSize = width < 375 ? 18 : isTablet ? 22 : 20;
  const fontSize = width < 375 ? 9 : isTablet ? 11 : 10;
  const tabHeight = width < 375 ? 52 : isTablet ? 64 : 60;
  const bottomOffset = Math.max(insets.bottom > 0 ? insets.bottom + 8 : 20, 20);

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          bottom: bottomOffset,
          left: (width - finalWidth) / 2,
          width: finalWidth,
          height: tabHeight,
          borderWidth: 0.5,
          borderColor: isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.10)",
          shadowOpacity: isDark ? 0.22 : 0.09,
          shadowRadius: isDark ? 16 : 12,
        },
      ]}
    >
      {Platform.OS === "ios" ? (
        <>
          <BlurView
            intensity={isDark ? 80 : 60}
            tint={isDark ? "systemMaterialDark" : "systemUltraThinMaterialLight"}
            style={[StyleSheet.absoluteFill, styles.blurView]}
          />
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark ? "rgba(28,28,30,0.25)" : "rgba(255,255,255,0.55)",
                borderRadius: 24,
              },
            ]}
          />
        </>
      ) : (
        <View
          style={[
            StyleSheet.absoluteFill,
            styles.androidBackground,
            {
              backgroundColor: isDark ? "rgba(28, 28, 30, 0.92)" : "rgba(255, 255, 255, 0.92)",
              borderColor: isDark ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 0, 0, 0.08)",
            },
          ]}
        />
      )}

      <View style={styles.tabsRow}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name.replace("Tab", "");
          const isFocused = state.index === index;

          const onPress = () => {
            const event = navigation.emit({
              type: "tabPress",
              target: route.key,
              canPreventDefault: true,
            });

            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          const iconName = getIconName(route.name);
          const color = isFocused ? Colors.accent : theme.tabIconDefault;
          const badgeCount: number | undefined =
            typeof options.tabBarBadge === "number" && options.tabBarBadge > 0
              ? options.tabBarBadge
              : undefined;

          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              testID={`tab-${route.name}`}
            >
              <View style={styles.iconWrap}>
                <Feather name={iconName} size={iconSize} color={color} style={styles.icon} />
                {badgeCount ? (
                  <View
                    style={[
                      styles.badge,
                      {
                        backgroundColor: Colors.accent,
                        borderColor: isDark ? "rgba(28,28,30,0.95)" : "rgba(255,255,255,0.95)",
                      },
                    ]}
                    testID={`tab-badge-${route.name}`}
                  >
                    <ThemedText style={styles.badgeText}>
                      {badgeCount > 99 ? "99+" : String(badgeCount)}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              <ThemedText style={[styles.tabText, { fontSize, color }]}>{label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function OfflinePill() {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const isOnline = useNetworkStore((s) => s.isOnline);
  if (isOnline) return null;
  return (
    <View
      pointerEvents="none"
      style={[
        styles.offlinePillWrap,
        { top: insets.top + Spacing.sm },
      ]}
      testID="pill-offline-provider"
    >
      <View
        style={[
          styles.offlinePill,
          {
            backgroundColor: isDark
              ? "rgba(28,28,30,0.92)"
              : "rgba(60,60,67,0.92)",
            borderColor: isDark
              ? "rgba(255,255,255,0.12)"
              : "rgba(0,0,0,0.08)",
          },
        ]}
      >
        <Feather name="wifi-off" size={12} color="#FFFFFF" />
        <ThemedText
          style={styles.offlinePillText}
          lightColor="#FFFFFF"
          darkColor="#FFFFFF"
        >
          Offline — read-only
        </ThemedText>
      </View>
    </View>
  );
}

export default function ProviderTabNavigator() {
  const { theme, isDark } = useTheme();
  const leadsBadge = useLeadsBadgeCount();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="HomeTab"
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerTitleAlign: "center",
          headerTransparent: true,
          headerTintColor: theme.text,
          headerTitleStyle: {
            ...Typography.headline,
            color: theme.text,
          },
          headerStyle: {
            backgroundColor: Platform.select({
              ios: undefined,
              android: theme.backgroundRoot,
              web: isDark ? "rgba(28, 28, 30, 0.85)" : "rgba(248, 248, 248, 0.85)",
            }),
          },
          headerShadowVisible: false,
        }}
      >
        <Tab.Screen
          name="HomeTab"
          component={ProviderHomeScreen}
          options={{
            title: "Home",
            headerTitle: () => <HeaderTitle title="HomeBase Pro" />,
          }}
        />
        <Tab.Screen
          name="ClientsTab"
          component={ClientsScreen}
          options={{
            title: "Clients",
            headerShown: false,
          }}
        />
        <Tab.Screen
          name="ScheduleTab"
          component={ScheduleScreen}
          options={{
            title: "Schedule",
            headerTitle: "Schedule",
          }}
        />
        <Tab.Screen
          name="LeadsTab"
          component={LeadsScreen}
          options={{
            title: "Leads",
            headerTitle: "Leads",
            tabBarBadge: leadsBadge > 0 ? leadsBadge : undefined,
          }}
        />
        <Tab.Screen
          name="FinancialsTab"
          component={FinancialsScreen}
          options={{
            title: "Finance",
            headerTitle: "Finance",
          }}
        />
        <Tab.Screen
          name="MoreTab"
          component={ProviderMoreScreen}
          options={{
            title: "More",
            headerTitle: "More",
          }}
        />
      </Tab.Navigator>
      <ProviderFAB />
      <OfflinePill />
    </View>
  );
}

const styles = StyleSheet.create({
  tabBarContainer: {
    position: "absolute",
    borderRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },
  blurView: {
    borderRadius: 24,
    overflow: "hidden",
  },
  androidBackground: {
    borderRadius: 24,
    borderWidth: 1,
  },
  tabsRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    paddingHorizontal: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
  },
  iconWrap: {
    position: "relative",
    marginBottom: 2,
  },
  icon: {
    marginBottom: 0,
  },
  badge: {
    position: "absolute",
    top: -6,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
    lineHeight: 12,
  },
  tabText: {
    fontWeight: "500",
  },
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
