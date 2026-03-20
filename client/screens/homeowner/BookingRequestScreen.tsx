import React, { useState } from "react";
import { StyleSheet, View, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useRoute, useNavigation, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { UrgencyLevel, JobSize } from "@/state/types";

type ScreenRouteProp = RouteProp<RootStackParamList, "BookingRequest">;
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const URGENCY_OPTIONS: { value: UrgencyLevel; label: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: "flexible", label: "Flexible", icon: "calendar" },
  { value: "soon", label: "Soon (1-2 weeks)", icon: "clock" },
  { value: "urgent", label: "Urgent (2-3 days)", icon: "alert-circle" },
  { value: "emergency", label: "Emergency", icon: "zap" },
];

const SIZE_OPTIONS: { value: JobSize; label: string; description: string }[] = [
  { value: "small", label: "Small", description: "Quick fix, under 2 hours" },
  { value: "medium", label: "Medium", description: "Half day job" },
  { value: "large", label: "Large", description: "Full day or more" },
];

export default function BookingRequestScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const route = useRoute<ScreenRouteProp>();
  const navigation = useNavigation<NavigationProp>();
  const { theme } = useTheme();
  const { providerId, categoryId, service } = route.params;

  const [description, setDescription] = useState("");
  const [urgency, setUrgency] = useState<UrgencyLevel>("flexible");
  const [size, setSize] = useState<JobSize>("small");

  const handleNext = () => {
    if (!description.trim()) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("BookingSchedule", {
      providerId,
      categoryId,
      service,
      description: description.trim(),
      urgency,
      size,
      photoUrls: [],
    });
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + 100,
          paddingHorizontal: Spacing.screenPadding,
        }}
      >
        <ThemedText style={styles.stepIndicator}>Step 1 of 4</ThemedText>

        <ThemedText style={styles.sectionTitle}>Describe Your Issue</ThemedText>
        <TextField
          placeholder="Tell us what you need help with..."
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={4}
          style={styles.textArea}
        />

        <ThemedText style={[styles.sectionTitle, styles.sectionMargin]}>
          How Urgent Is This?
        </ThemedText>
        <View style={styles.optionsGrid}>
          {URGENCY_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              onPress={() => {
                Haptics.selectionAsync();
                setUrgency(option.value);
              }}
              style={[
                styles.optionCard,
                {
                  backgroundColor:
                    urgency === option.value ? Colors.accentLight : theme.cardBackground,
                  borderColor:
                    urgency === option.value ? Colors.accent : theme.borderLight,
                },
              ]}
            >
              <Feather
                name={option.icon}
                size={20}
                color={urgency === option.value ? Colors.accent : theme.textSecondary}
              />
              <ThemedText
                style={[
                  styles.optionLabel,
                  { color: urgency === option.value ? Colors.accent : theme.text },
                ]}
              >
                {option.label}
              </ThemedText>
            </Pressable>
          ))}
        </View>

        <ThemedText style={[styles.sectionTitle, styles.sectionMargin]}>
          Job Size Estimate
        </ThemedText>
        {SIZE_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            onPress={() => {
              Haptics.selectionAsync();
              setSize(option.value);
            }}
            style={[
              styles.sizeOption,
              {
                backgroundColor:
                  size === option.value ? Colors.accentLight : theme.cardBackground,
                borderColor: size === option.value ? Colors.accent : theme.borderLight,
              },
            ]}
          >
            <View
              style={[
                styles.radioOuter,
                { borderColor: size === option.value ? Colors.accent : theme.borderLight },
              ]}
            >
              {size === option.value && <View style={styles.radioInner} />}
            </View>
            <View style={styles.sizeContent}>
              <ThemedText style={styles.sizeLabel}>{option.label}</ThemedText>
              <ThemedText style={[styles.sizeDesc, { color: theme.textSecondary }]}>
                {option.description}
              </ThemedText>
            </View>
          </Pressable>
        ))}
      </KeyboardAwareScrollViewCompat>

      <View
        style={[
          styles.bottomBar,
          { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + Spacing.md },
        ]}
      >
        <PrimaryButton
          onPress={handleNext}
          disabled={!description.trim()}
        >
          Continue to Schedule
        </PrimaryButton>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  stepIndicator: {
    ...Typography.caption1,
    color: Colors.accent,
    fontWeight: "600",
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
  },
  sectionMargin: {
    marginTop: Spacing.xl,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.sm,
  },
  optionCard: {
    width: "48%",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  optionLabel: {
    ...Typography.subhead,
    fontWeight: "500",
    flex: 1,
  },
  sizeOption: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    marginBottom: Spacing.sm,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.accent,
  },
  sizeContent: {
    flex: 1,
  },
  sizeLabel: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  sizeDesc: {
    ...Typography.caption1,
    marginTop: 2,
  },
  bottomBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
  },
});
