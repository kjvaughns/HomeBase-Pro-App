import React from "react";
import { createNativeBottomTabNavigator } from "@react-navigation/bottom-tabs/unstable";
import type { NativeBottomTabNavigationOptions } from "@react-navigation/bottom-tabs/unstable";
import { Platform } from "react-native";

import HomeScreen from "@/screens/homeowner/HomeScreen";
import FindScreen from "@/screens/homeowner/FindScreen";
import ManageScreen from "@/screens/homeowner/ManageScreen";
import MoreScreen from "@/screens/homeowner/MoreScreen";
import { useTheme } from "@/hooks/useTheme";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useAuthStore } from "@/state/authStore";
import { Colors, Typography } from "@/constants/theme";

export type HomeownerTabParamList = {
  HomeTab: undefined;
  FindTab: undefined;
  ManageTab: undefined;
  MoreTab: undefined;
};

const Tab = createNativeBottomTabNavigator<HomeownerTabParamList>();

const iosVersion = typeof Platform.Version === "number" ? Platform.Version : 0;
const isIOS26Plus = iosVersion >= 26;

function sfIcon(name: string): NativeBottomTabNavigationOptions["tabBarIcon"] {
  return { type: "sfSymbol", name: name as any };
}

export default function HomeownerTabNavigator() {
  const { theme } = useTheme();
  const { isAuthenticated } = useAuthStore();

  return (
    <Tab.Navigator
      initialRouteName={isAuthenticated ? "HomeTab" : "FindTab"}
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
      {isAuthenticated ? (
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            title: "Home",
            headerTitle: () => <HeaderTitle title="HomeBase" />,
            tabBarIcon: sfIcon("house"),
          }}
        />
      ) : null}
      <Tab.Screen
        name="FindTab"
        component={FindScreen}
        options={{
          title: "Find",
          headerTitle: isAuthenticated ? "Find a Pro" : () => <HeaderTitle title="HomeBase" />,
          tabBarIcon: sfIcon("magnifyingglass"),
        }}
      />
      <Tab.Screen
        name="ManageTab"
        component={ManageScreen}
        options={{
          title: "Manage",
          headerTitle: "Manage",
          tabBarIcon: sfIcon("list.bullet.clipboard"),
        }}
      />
      <Tab.Screen
        name="MoreTab"
        component={MoreScreen}
        options={{
          title: "More",
          headerTitle: "More",
          tabBarIcon: sfIcon("ellipsis"),
        }}
      />
    </Tab.Navigator>
  );
}
