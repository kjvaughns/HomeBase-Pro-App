import { StyleSheet, View, Pressable } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useFloatingTabBarHeight } from "@/hooks/useFloatingTabBarHeight";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const tabBarHeight = useFloatingTabBarHeight();
  const { theme } = useTheme();
  const navigation = useNavigation();

  return (
    <ThemedView style={{ flex: 1 }}>
      <View
        style={[
          styles.container,
          {
            paddingTop: headerHeight + Spacing.xl,
            paddingBottom: tabBarHeight + Spacing.xl,
            paddingHorizontal: Spacing.lg,
          },
        ]}
      >
        <View style={[styles.iconCircle, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="user" size={36} color={theme.textSecondary} />
        </View>
        <ThemedText style={styles.title}>Profile coming soon</ThemedText>
        <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
          We're putting the finishing touches on your profile. Check back shortly.
        </ThemedText>
        {navigation.canGoBack() ? (
          <Pressable
            style={[styles.button, { backgroundColor: Colors.accent }]}
            onPress={() => navigation.goBack()}
            testID="button-profile-back"
          >
            <ThemedText style={styles.buttonText}>Go back</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.title2,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  body: {
    ...Typography.body,
    textAlign: "center",
    marginBottom: Spacing.xl,
    maxWidth: 320,
  },
  button: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.button,
  },
  buttonText: {
    color: "#fff",
    ...Typography.callout,
    fontWeight: "700",
  },
});
