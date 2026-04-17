import React, { useState, useCallback } from "react";
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Linking,
  ActivityIndicator,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";

const MANAGE_URL = "https://homebaseproapp.com";

export default function SubscriptionScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(false);

  const handleOpen = useCallback(async () => {
    setLoading(true);
    try {
      await Linking.openURL(MANAGE_URL);
    } catch {}
    finally {
      setLoading(false);
    }
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.xl,
          paddingBottom: insets.bottom + Spacing.xl * 2,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: isDark ? "#1C2E24" : "#F0FAF4",
              borderColor: Colors.accent + "40",
            },
          ]}
        >
          <View style={[styles.iconCircle, { backgroundColor: Colors.accentLight }]}>
            <Feather name="external-link" size={22} color={Colors.accent} />
          </View>

          <ThemedText style={styles.title}>Manage on the web</ThemedText>

          <ThemedText style={[styles.body, { color: theme.textSecondary }]}>
            Manage your HomeBase subscription at homebaseproapp.com
          </ThemedText>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              { backgroundColor: pressed ? Colors.accentPressed : Colors.accent },
            ]}
            onPress={handleOpen}
            disabled={loading}
            testID="button-open-subscription-portal"
          >
            {loading ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="external-link" size={16} color="#fff" />
                <ThemedText style={styles.buttonText}>Open homebaseproapp.com</ThemedText>
              </>
            )}
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    borderRadius: BorderRadius.card,
    borderWidth: 1.5,
    padding: Spacing.lg,
    alignItems: "center",
  },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  title: {
    ...Typography.headline,
    fontWeight: "700",
    marginBottom: Spacing.sm,
    textAlign: "center",
  },
  body: {
    ...Typography.subhead,
    textAlign: "center",
    marginBottom: Spacing.lg,
    lineHeight: 22,
  },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.button,
    paddingVertical: 14,
    paddingHorizontal: Spacing.xl,
    alignSelf: "stretch",
  },
  buttonText: {
    color: "#fff",
    ...Typography.callout,
    fontWeight: "700",
  },
});
