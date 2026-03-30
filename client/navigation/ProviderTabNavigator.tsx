import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, useWindowDimensions, Text, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import ProviderHomeScreen from "@/screens/provider/ProviderHomeScreen";
import ClientsScreen from "@/screens/provider/ClientsScreen";
import ScheduleScreen from "@/screens/provider/ScheduleScreen";
import FinancesScreen from "@/screens/provider/FinancesScreen";
import ProviderMoreScreen from "@/screens/provider/ProviderMoreScreen";
import { useTheme } from "@/hooks/useTheme";
import { HeaderTitle } from "@/components/HeaderTitle";
import ProviderFAB from "@/components/ProviderFAB";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

export type ProviderTabParamList = {
  HomeTab: undefined;
  ClientsTab: undefined;
  ScheduleTab: undefined;
  FinancesTab: undefined;
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
    case "FinancesTab":
      return "credit-card";
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
  
  const horizontalMargin = Math.max(16, width * 0.04);
  const maxWidth = 400;
  const tabBarWidth = width - horizontalMargin * 2;
  const finalWidth = Math.min(tabBarWidth, maxWidth);
  
  const iconSize = width < 375 ? 18 : 20;
  const fontSize = width < 375 ? 9 : 10;
  const tabHeight = width < 375 ? 52 : 60;
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

          return (
            <Pressable
              key={route.key}
              style={styles.tab}
              onPress={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              testID={`tab-${route.name}`}
            >
              <Feather name={iconName} size={iconSize} color={color} style={styles.icon} />
              <Text style={[styles.tabText, { fontSize, color }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function ProviderTabNavigator() {
  const { theme, isDark } = useTheme();

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
          name="FinancesTab"
          component={FinancesScreen}
          options={{
            title: "Finances",
            headerTitle: "Finances",
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
  icon: {
    marginBottom: 2,
  },
  tabText: {
    fontWeight: "500",
  },
});
