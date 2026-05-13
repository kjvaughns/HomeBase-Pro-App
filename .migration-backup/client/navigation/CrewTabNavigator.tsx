import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, useWindowDimensions, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import MyJobsScreen from "@/screens/crew/MyJobsScreen";
import CrewScheduleScreen from "@/screens/crew/CrewScheduleScreen";
import CrewMoreScreen from "@/screens/crew/CrewMoreScreen";
import { useTheme } from "@/hooks/useTheme";
import { ThemedText } from "@/components/ThemedText";
import { Colors, Typography } from "@/constants/theme";

export type CrewTabParamList = {
  CrewMyJobsTab: undefined;
  CrewScheduleTab: undefined;
  CrewMoreTab: undefined;
};

const Tab = createBottomTabNavigator<CrewTabParamList>();

function getIconName(routeName: string): keyof typeof Feather.glyphMap {
  switch (routeName) {
    case "CrewMyJobsTab":
      return "clipboard";
    case "CrewScheduleTab":
      return "calendar";
    case "CrewMoreTab":
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
  const horizontalMargin = isTablet ? Math.max(24, (width - 360) / 2) : Math.max(16, width * 0.04);
  const maxWidth = isTablet ? 360 : 320;
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
            style={[StyleSheet.absoluteFill, styles.blurView]} pointerEvents="none"
          />
          <View
            pointerEvents="none"
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
          pointerEvents="none"
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
          const label = options.title ?? route.name.replace("Crew", "").replace("Tab", "");
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
              <Feather name={iconName} size={iconSize} color={color} />
              <ThemedText style={[styles.tabText, { fontSize, color }]}>{label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function CrewTabNavigator() {
  const { theme, isDark } = useTheme();

  return (
    <View style={{ flex: 1 }}>
      <Tab.Navigator
        initialRouteName="CrewMyJobsTab"
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
          name="CrewMyJobsTab"
          component={MyJobsScreen}
          options={{ title: "My Jobs", headerTitle: "My Jobs" }}
        />
        <Tab.Screen
          name="CrewScheduleTab"
          component={CrewScheduleScreen}
          options={{ title: "Schedule", headerTitle: "Schedule" }}
        />
        <Tab.Screen
          name="CrewMoreTab"
          component={CrewMoreScreen}
          options={{ title: "More", headerTitle: "More" }}
        />
      </Tab.Navigator>
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
    gap: 2,
  },
  tabText: {
    fontWeight: "500",
  },
});
