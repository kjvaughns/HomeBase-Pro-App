import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View, Animated, Pressable, Dimensions, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Feather } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { ThemedText } from "@/components/ThemedText";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";
import type { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useOnboardingStore, AccountType } from "@/state/onboardingStore";

const { width } = Dimensions.get("window");

type Props = NativeStackScreenProps<RootStackParamList, "AccountTypeSelection">;

export default function AccountTypeSelectionScreen({ navigation }: Props) {
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const { setAccountType } = useOnboardingStore();
  const [selected, setSelected] = useState<AccountType | null>(null);

  const headerOpacity = useRef(new Animated.Value(0)).current;
  const headerTranslateY = useRef(new Animated.Value(-20)).current;
  const card1Opacity = useRef(new Animated.Value(0)).current;
  const card1TranslateY = useRef(new Animated.Value(40)).current;
  const card2Opacity = useRef(new Animated.Value(0)).current;
  const card2TranslateY = useRef(new Animated.Value(40)).current;
  const buttonOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(headerOpacity, {
          toValue: 1,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.spring(headerTranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(card1Opacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: false,
        }),
        Animated.spring(card1TranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: false,
        }),
      ]),
      Animated.parallel([
        Animated.timing(card2Opacity, {
          toValue: 1,
          duration: 350,
          useNativeDriver: false,
        }),
        Animated.spring(card2TranslateY, {
          toValue: 0,
          tension: 50,
          friction: 8,
          useNativeDriver: false,
        }),
      ]),
      Animated.timing(buttonOpacity, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
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

  const GlassRoleCard = ({
    type,
    icon,
    title,
    description,
    features,
    isSelected,
    onSelect,
    animStyle,
  }: {
    type: AccountType;
    icon: keyof typeof Feather.glyphMap;
    title: string;
    description: string;
    features: { icon: keyof typeof Feather.glyphMap; text: string }[];
    isSelected: boolean;
    onSelect: () => void;
    animStyle: any;
  }) => (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onSelect}
        style={({ pressed }) => [
          styles.glassCard,
          {
            borderColor: isSelected ? Colors.accent : "rgba(255,255,255,0.12)",
            borderWidth: isSelected ? 2 : StyleSheet.hairlineWidth,
            transform: [{ scale: pressed ? 0.98 : 1 }],
          },
        ]}
        testID={`card-${type}`}
      >
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={isDark ? 35 : 55}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              {
                backgroundColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.85)",
              },
            ]}
          />
        )}

        {isSelected && (
          <LinearGradient
            colors={[Colors.accent + "15", "transparent"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        )}

        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View
              style={[
                styles.iconContainer,
                {
                  backgroundColor: isSelected ? Colors.accent + "25" : Colors.accent + "12",
                },
              ]}
            >
              <LinearGradient
                colors={isSelected ? [Colors.accent, "#2D9A4E"] : [Colors.accent + "80", Colors.accent + "60"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={[StyleSheet.absoluteFill, { borderRadius: 28 }]}
              />
              <Feather name={icon} size={28} color="#FFFFFF" />
            </View>

            {isSelected && (
              <View style={styles.selectedIndicator}>
                <LinearGradient
                  colors={[Colors.accent, "#2D9A4E"]}
                  style={StyleSheet.absoluteFill}
                />
                <Feather name="check" size={16} color="#FFFFFF" />
              </View>
            )}
          </View>

          <View style={styles.cardTextSection}>
            <ThemedText type="h3" style={styles.cardTitle}>
              {title}
            </ThemedText>
            <ThemedText
              type="caption"
              style={[styles.cardDescription, { color: theme.textSecondary }]}
            >
              {description}
            </ThemedText>
          </View>

          <View style={styles.featuresGrid}>
            {features.map((feature, index) => (
              <View
                key={index}
                style={[
                  styles.featurePill,
                  {
                    backgroundColor: isDark
                      ? "rgba(255,255,255,0.06)"
                      : "rgba(56,174,95,0.08)",
                  },
                ]}
              >
                <Feather name={feature.icon} size={13} color={Colors.accent} />
                <ThemedText type="caption" style={{ color: theme.textSecondary, fontSize: 12 }}>
                  {feature.text}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>
      </Pressable>
    </Animated.View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <LinearGradient
        colors={
          isDark
            ? [Colors.accent + "10", "transparent", Colors.accent + "05"]
            : [Colors.accent + "08", "transparent", Colors.accent + "04"]
        }
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={[styles.content, { paddingTop: insets.top + Spacing.xl }]}>
        <Animated.View
          style={{
            opacity: headerOpacity,
            transform: [{ translateY: headerTranslateY }],
          }}
        >
          <ThemedText type="h2" style={styles.title}>
            Choose Your Path
          </ThemedText>
          <ThemedText type="body" style={[styles.subtitle, { color: theme.textSecondary }]}>
            Select your primary role to get started. You can switch anytime.
          </ThemedText>
        </Animated.View>

        <View style={styles.cardsContainer}>
          <GlassRoleCard
            type="homeowner"
            icon="home"
            title="Homeowner"
            description="Find and book trusted service providers for your home"
            features={[
              { icon: "search", text: "Find pros" },
              { icon: "calendar", text: "Easy booking" },
              { icon: "file-text", text: "Track history" },
              { icon: "cpu", text: "AI assistant" },
            ]}
            isSelected={selected === "homeowner"}
            onSelect={() => setSelected("homeowner")}
            animStyle={{
              opacity: card1Opacity,
              transform: [{ translateY: card1TranslateY }],
            }}
          />

          <GlassRoleCard
            type="provider"
            icon="briefcase"
            title="Service Provider"
            description="Grow your business and manage clients professionally"
            features={[
              { icon: "users", text: "CRM tools" },
              { icon: "dollar-sign", text: "Invoicing" },
              { icon: "link", text: "Booking links" },
              { icon: "trending-up", text: "Analytics" },
            ]}
            isSelected={selected === "provider"}
            onSelect={() => setSelected("provider")}
            animStyle={{
              opacity: card2Opacity,
              transform: [{ translateY: card2TranslateY }],
            }}
          />
        </View>
      </View>

      <Animated.View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + Spacing.lg, opacity: buttonOpacity },
        ]}
      >
        <View style={styles.buttonContainer}>
          {Platform.OS === "ios" && (
            <BlurView
              intensity={isDark ? 20 : 35}
              tint={isDark ? "dark" : "light"}
              style={[StyleSheet.absoluteFill, { borderRadius: BorderRadius.lg }]}
            />
          )}
          <PrimaryButton
            onPress={handleContinue}
            disabled={!selected}
            testID="button-continue"
          >
            Continue
          </PrimaryButton>
        </View>

        <Pressable onPress={handleLogin} style={styles.loginLink} testID="button-login">
          <ThemedText type="body" style={{ color: theme.textSecondary }}>
            Already have an account?{" "}
          </ThemedText>
          <ThemedText type="body" style={{ color: Colors.accent, fontWeight: "600" }}>
            Sign In
          </ThemedText>
        </Pressable>
      </Animated.View>
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
    marginBottom: Spacing.xs,
    letterSpacing: -0.3,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: Spacing.xl,
  },
  cardsContainer: {
    flex: 1,
    gap: Spacing.lg,
    justifyContent: "center",
    paddingBottom: Spacing.xl,
  },
  glassCard: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
  },
  cardContent: {
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: Spacing.md,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  selectedIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  cardTextSection: {
    marginBottom: Spacing.md,
  },
  cardTitle: {
    marginBottom: Spacing.xs,
    letterSpacing: -0.2,
  },
  cardDescription: {
    lineHeight: 20,
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 12,
  },
  footer: {
    paddingHorizontal: Spacing.screenPadding,
    gap: Spacing.md,
  },
  buttonContainer: {
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  loginLink: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: Spacing.sm,
  },
});
