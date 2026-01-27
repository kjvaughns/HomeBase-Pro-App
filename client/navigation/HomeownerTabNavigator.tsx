import React from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { Platform, StyleSheet, View, useWindowDimensions, Pressable, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import HomeScreen from "@/screens/homeowner/HomeScreen";
import FindScreen from "@/screens/homeowner/FindScreen";
import ManageScreen from "@/screens/homeowner/ManageScreen";
import MessagesScreen from "@/screens/homeowner/MessagesScreen";
import MoreScreen from "@/screens/homeowner/MoreScreen";
import { useTheme } from "@/hooks/useTheme";
import { HeaderTitle } from "@/components/HeaderTitle";
import { useAuthStore } from "@/state/authStore";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

export type HomeownerTabParamList = {
  HomeTab: undefined;
  FindTab: undefined;
  ManageTab: undefined;
  MessagesTab: undefined;
  MoreTab: undefined;
};

const Tab = createBottomTabNavigator<HomeownerTabParamList>();

function FloatingTabBar({ state, descriptors, navigation, isDark, theme }: any) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  
  const horizontalMargin = Math.max(16, width * 0.04);
  const maxWidth = Math.min(width - horizontalMargin * 2, 400);
  const tabBarWidth = width - horizontalMargin * 2;
  const finalWidth = Math.min(tabBarWidth, maxWidth);
  
  const iconSize = width < 375 ? 20 : 22;
  const tabHeight = width < 375 ? 56 : 64;
  const bottomOffset = Math.max(insets.bottom > 0 ? insets.bottom : 16, 16);

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          bottom: bottomOffset,
          left: (width - finalWidth) / 2,
          width: finalWidth,
          height: tabHeight,
        },
      ]}
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={80}
          tint={isDark ? "systemMaterialDark" : "systemMaterial"}
          style={[StyleSheet.absoluteFill, styles.blurView]}
        />
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

      <View style={styles.tabItemsContainer}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];
          const label = options.title ?? route.name;
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
            <View key={route.key} style={styles.tabItem}>
              <View
                style={styles.tabButton}
                onTouchEnd={onPress}
                accessibilityRole="button"
                accessibilityState={isFocused ? { selected: true } : {}}
                accessibilityLabel={options.tabBarAccessibilityLabel}
              >
                <Feather name={iconName} size={iconSize} color={color} />
                <View style={styles.labelContainer}>
                  <Feather
                    name={iconName}
                    size={iconSize}
                    color={color}
                    style={styles.hiddenIcon}
                  />
                  <View style={styles.labelWrapper}>
                    <View style={[styles.label, { opacity: 1 }]}>
                      <Feather name={iconName} size={iconSize} color={color} style={styles.hiddenIcon} />
                    </View>
                  </View>
                </View>
                <View style={styles.tabLabelWrapper}>
                  <View style={styles.actualLabel}>
                    <Feather name={iconName} size={iconSize} color={color} />
                  </View>
                </View>
              </View>
              <View style={styles.tabContent} onTouchEnd={onPress}>
                <Feather name={iconName} size={iconSize} color={color} style={styles.tabIcon} />
                <View
                  style={[
                    styles.tabLabel,
                    { color },
                  ]}
                >
                  <Feather name={iconName} size={10} color="transparent" />
                </View>
              </View>
            </View>
          );
        })}
      </View>

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
            <View
              key={route.key}
              style={styles.tab}
              onTouchEnd={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              <Feather name={iconName} size={iconSize} color={color} style={styles.icon} />
              <View>
                <Feather name={iconName} size={10} color="transparent" />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function getIconName(routeName: string): keyof typeof Feather.glyphMap {
  switch (routeName) {
    case "HomeTab":
      return "home";
    case "FindTab":
      return "search";
    case "ManageTab":
      return "clipboard";
    case "MessagesTab":
      return "message-circle";
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
  const maxWidth = Math.min(width - horizontalMargin * 2, 400);
  const tabBarWidth = width - horizontalMargin * 2;
  const finalWidth = Math.min(tabBarWidth, maxWidth);
  
  const iconSize = width < 375 ? 20 : 22;
  const tabHeight = width < 375 ? 56 : 64;
  const bottomOffset = Math.max(insets.bottom > 0 ? insets.bottom : 16, 16);

  return (
    <View
      style={[
        styles.tabBarContainer,
        {
          bottom: bottomOffset,
          left: (width - finalWidth) / 2,
          width: finalWidth,
          height: tabHeight,
        },
      ]}
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={80}
          tint={isDark ? "systemMaterialDark" : "systemMaterial"}
          style={[StyleSheet.absoluteFill, styles.blurView]}
        />
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
            <View
              key={route.key}
              style={styles.tab}
              onTouchEnd={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              <Feather name={iconName} size={iconSize} color={color} style={styles.icon} />
              <View style={styles.labelTextContainer}>
                <View style={[styles.labelText, { color }]}>
                  <Feather name="circle" size={9} color="transparent" />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ActualCustomTabBar({ state, descriptors, navigation }: any) {
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
        },
      ]}
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={80}
          tint={isDark ? "systemMaterialDark" : "systemMaterial"}
          style={[StyleSheet.absoluteFill, styles.blurView]}
        />
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
            <View
              key={route.key}
              style={styles.tab}
              onTouchEnd={onPress}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              <Feather name={iconName} size={iconSize} color={color} style={styles.icon} />
              <View style={[styles.tabLabelText, { marginTop: 2 }]}>
                <View style={{ fontSize, fontWeight: "500", color } as any}>
                  <Feather name="circle" size={fontSize} color="transparent" />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function FinalCustomTabBar({ state, descriptors, navigation }: any) {
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
        },
      ]}
    >
      {Platform.OS === "ios" ? (
        <BlurView
          intensity={80}
          tint={isDark ? "systemMaterialDark" : "systemMaterial"}
          style={[StyleSheet.absoluteFill, styles.blurView]}
        />
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

export default function HomeownerTabNavigator() {
  const { theme, isDark } = useTheme();
  const { isAuthenticated } = useAuthStore();

  return (
    <Tab.Navigator
      initialRouteName={isAuthenticated ? "HomeTab" : "FindTab"}
      tabBar={(props) => <FinalCustomTabBar {...props} />}
      screenOptions={{
        headerTitleAlign: "center",
        headerTransparent: true,
        headerBlurEffect: isDark ? "systemMaterialDark" : "systemMaterial",
        headerTintColor: theme.text,
        headerTitleStyle: {
          ...Typography.headline,
          color: theme.text,
        },
        headerStyle: {
          backgroundColor: Platform.select({
            ios: undefined,
            android: theme.backgroundRoot,
            web: "transparent",
          }),
        },
        headerShadowVisible: false,
      }}
    >
      {isAuthenticated ? (
        <Tab.Screen
          name="HomeTab"
          component={HomeScreen}
          options={{
            title: "Home",
            headerTitle: () => <HeaderTitle title="Homebase" />,
          }}
        />
      ) : null}
      <Tab.Screen
        name="FindTab"
        component={FindScreen}
        options={{
          title: "Find",
          headerTitle: isAuthenticated ? "Find a Pro" : () => <HeaderTitle title="Homebase" />,
        }}
      />
      <Tab.Screen
        name="ManageTab"
        component={ManageScreen}
        options={{
          title: "Manage",
          headerTitle: "Manage",
        }}
      />
      {isAuthenticated ? (
        <Tab.Screen
          name="MessagesTab"
          component={MessagesScreen}
          options={{
            title: "Messages",
            headerTitle: "Messages",
          }}
        />
      ) : null}
      <Tab.Screen
        name="MoreTab"
        component={MoreScreen}
        options={{
          title: "More",
          headerTitle: "More",
        }}
      />
    </Tab.Navigator>
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
  tabItemsContainer: {
    display: "none",
  },
  tabItem: {
    display: "none",
  },
  tabButton: {
    display: "none",
  },
  labelContainer: {
    display: "none",
  },
  hiddenIcon: {
    display: "none",
  },
  labelWrapper: {
    display: "none",
  },
  label: {
    display: "none",
  },
  tabLabelWrapper: {
    display: "none",
  },
  actualLabel: {
    display: "none",
  },
  tabContent: {
    display: "none",
  },
  tabIcon: {
    display: "none",
  },
  tabLabel: {
    display: "none",
  },
  labelTextContainer: {
    display: "none",
  },
  labelText: {
    display: "none",
  },
  tabLabelText: {
    display: "none",
  },
});
