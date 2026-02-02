import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Animated, Pressable, Dimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOnboardingStore, AccountType } from "@/state/onboardingStore";

const { width } = Dimensions.get("window");

type Props = NativeStackScreenProps<RootStackParamList, "AccountTypeSelection">;

export default function AccountTypeSelectionScreen({ navigation }: Props) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { setAccountType } = useOnboardingStore();
  const [selected, setSelected] = useState<AccountType | null>(null);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-20)).current;
  const card1Opacity = useRef(new Animated.Value(0)).current;
  const card1TranslateX = useRef(new Animated.Value(-30)).current;
  const card2Opacity = useRef(new Animated.Value(0)).current;
  const card2TranslateX = useRef(new Animated.Value(30)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(headerTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(card1Opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(card1TranslateX, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.parallel([
        Animated.timing(card2Opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(card2TranslateX, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleContinue = () => {
    if (!selected) return;
    setAccountType(selected);
    if (selected === "homeowner") {
      navigation.navigate("HomeownerOnboarding");
    } else {
      navigation.navigate("ProviderOnboarding");
    }
  };

  const handleLogin = () => {
    navigation.navigate("Login");
  };

  return (
    <ThemedView style={styles.container}>
      <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
        <Animated.View
          style={{
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
          }}
        >
          <ThemedText type="h2" style={styles.title}>
            How will you use HomeBase?
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Choose your primary role. You can always switch later.
          </ThemedText>
        </Animated.View>

        <View style={styles.cardsContainer}>
          <Animated.View
            style={{
              opacity: card1Opacity,
              transform: [{ translateX: card1TranslateX }],
            }}
          >
            <Pressable
              onPress={() => setSelected("homeowner")}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: selected === "homeowner" ? Colors.accent : theme.border,
                  borderWidth: selected === "homeowner" ? 2 : 1,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
              testID="card-homeowner"
            >
              <View style={[styles.cardIcon, { backgroundColor: Colors.accent + "15" }]}>
                <Feather name="home" size={32} color={Colors.accent} />
              </View>
              <ThemedText type="h3" style={styles.cardTitle}>
                Homeowner
              </ThemedText>
              <ThemedText
                type="caption"
                style={[styles.cardDescription, { color: theme.textSecondary }]}
              >
                Find and book trusted service providers for your home
              </ThemedText>
              <View style={styles.cardFeatures}>
                <FeatureItem icon="search" text="Find local pros" />
                <FeatureItem icon="calendar" text="Easy booking" />
                <FeatureItem icon="file-text" text="Track history" />
                <FeatureItem icon="cpu" text="AI assistance" />
              </View>
              {selected === "homeowner" && (
                <View style={[styles.selectedBadge, { backgroundColor: Colors.accent }]}>
                  <Feather name="check" size={16} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
          </Animated.View>

          <Animated.View
            style={{
              opacity: card2Opacity,
              transform: [{ translateX: card2TranslateX }],
            }}
          >
            <Pressable
              onPress={() => setSelected("provider")}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: theme.backgroundSecondary,
                  borderColor: selected === "provider" ? Colors.accent : theme.border,
                  borderWidth: selected === "provider" ? 2 : 1,
                  opacity: pressed ? 0.9 : 1,
                  transform: [{ scale: pressed ? 0.98 : 1 }],
                },
              ]}
              testID="card-provider"
            >
              <View style={[styles.cardIcon, { backgroundColor: Colors.accent + "15" }]}>
                <Feather name="briefcase" size={32} color={Colors.accent} />
              </View>
              <ThemedText type="h3" style={styles.cardTitle}>
                Service Provider
              </ThemedText>
              <ThemedText
                type="caption"
                style={[styles.cardDescription, { color: theme.textSecondary }]}
              >
                Grow your business and manage clients professionally
              </ThemedText>
              <View style={styles.cardFeatures}>
                <FeatureItem icon="users" text="CRM tools" />
                <FeatureItem icon="dollar-sign" text="Invoicing" />
                <FeatureItem icon="link" text="Booking links" />
                <FeatureItem icon="trending-up" text="Analytics" />
              </View>
              {selected === "provider" && (
                <View style={[styles.selectedBadge, { backgroundColor: Colors.accent }]}>
                  <Feather name="check" size={16} color="#FFFFFF" />
                </View>
              )}
            </Pressable>
          </Animated.View>
        </View>
      </View>

      <Animated.View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing.lg, opacity: buttonOpacity },
        ]}
      >
        <PrimaryButton
          onPress={handleContinue}
          disabled={!selected}
          testID="button-continue"
        >
          Continue
        </PrimaryButton>
        <Pressable onPress={handleLogin} style={styles.loginLink} testID="button-login">
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Already have an account?{" "}
          </ThemedText>
          <ThemedText type="body" style={{ color: Colors.accent, fontWeight: "600" }}>
            Sign In
          </ThemedText>
        </Pressable>
      </Animated.View>
    </ThemedView>
  );
}

function FeatureItem({ icon, text }: { icon: keyof typeof Feather.glyphMap; text: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.featureItem}>
      <Feather name={icon} size={14} color={Colors.accent} />
      <ThemedText type="caption" style={{ color: theme.textSecondary }}>
        {text}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  title: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  cardsContainer: {
    flex: 1,
    gap: Spacing.lg,
  },
  card: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    position: "relative",
  },
  cardIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.md,
  },
  cardTitle: {
    marginBottom: Spacing.xs,
  },
  cardDescription: {
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  cardFeatures: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(56, 174, 95, 0.08)",
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  selectedBadge: {
    position: "absolute",
    top: Spacing.md,
    right: Spacing.md,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.md,
  },
  loginLink: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
});
