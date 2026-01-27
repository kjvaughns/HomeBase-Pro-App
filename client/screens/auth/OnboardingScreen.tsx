import React, { useState } from "react";
import { StyleSheet, View, Alert } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { CommonActions, useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";
import { Spacing, Colors, BorderRadius } from "@/constants/theme";

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [step, setStep] = useState<"welcome" | "add-home">("welcome");
  const [nickname, setNickname] = useState("My Home");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const goToMain = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Main" as never }],
      })
    );
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    
    if (!address.trim()) {
      newErrors.address = "Street address is required";
    }
    if (!city.trim()) {
      newErrors.city = "City is required";
    }
    if (!state.trim()) {
      newErrors.state = "State is required";
    }
    if (!zipCode.trim()) {
      newErrors.zipCode = "ZIP code is required";
    } else if (!/^\d{5}(-\d{4})?$/.test(zipCode.trim())) {
      newErrors.zipCode = "Enter a valid ZIP code";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddHome = async () => {
    if (!validate() || !user) return;

    setLoading(true);
    try {
      await apiRequest("POST", "/api/homes", {
        userId: user.id,
        nickname: nickname.trim() || "My Home",
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        zipCode: zipCode.trim(),
      });
      goToMain();
    } catch (error) {
      Alert.alert("Error", "Unable to add your home. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const clearError = (field: string) => {
    if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }
  };

  if (step === "welcome") {
    return (
      <ThemedView style={styles.container}>
        <View style={[styles.welcomeContent, { paddingTop: insets.top + Spacing["3xl"], paddingBottom: insets.bottom + Spacing.xl }]}>
          <View style={styles.welcomeHeader}>
            <View style={[styles.welcomeIcon, { backgroundColor: Colors.accent + "20" }]}>
              <Feather name="check-circle" size={48} color={Colors.accent} />
            </View>
            <ThemedText type="h1" style={styles.welcomeTitle}>
              Welcome, {user?.name?.split(" ")[0] || "there"}!
            </ThemedText>
            <ThemedText type="body" style={[styles.welcomeSubtitle, { color: theme.textSecondary }]}>
              Your account is ready. Let's add your first home to get started with HomeBase.
            </ThemedText>
          </View>

          <View style={styles.welcomeFooter}>
            <PrimaryButton
              onPress={() => setStep("add-home")}
              testID="button-add-home"
            >
              Add My Home
            </PrimaryButton>
            <SecondaryButton
              onPress={goToMain}
              testID="button-skip"
            >
              Skip for Now
            </SecondaryButton>
          </View>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={[
          styles.formContent,
          { paddingTop: insets.top + Spacing.xl, paddingBottom: insets.bottom + Spacing.xl },
        ]}
      >
        <View style={styles.formHeader}>
          <View style={[styles.homeIcon, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="home" size={32} color={Colors.accent} />
          </View>
          <ThemedText type="h1" style={styles.formTitle}>
            Add your home
          </ThemedText>
          <ThemedText type="body" style={[styles.formSubtitle, { color: theme.textSecondary }]}>
            Enter your home address to find local service providers
          </ThemedText>
        </View>

        <View style={styles.form}>
          <TextField
            label="Home Nickname (optional)"
            placeholder="e.g., My Home, Beach House"
            leftIcon="tag"
            value={nickname}
            onChangeText={setNickname}
            testID="input-nickname"
          />

          <TextField
            label="Street Address"
            placeholder="123 Main Street"
            leftIcon="map-pin"
            autoComplete="street-address"
            value={address}
            onChangeText={(text) => {
              setAddress(text);
              clearError("address");
            }}
            error={errors.address}
            testID="input-address"
          />

          <TextField
            label="City"
            placeholder="City"
            leftIcon="navigation"
            autoComplete="postal-address-locality"
            value={city}
            onChangeText={(text) => {
              setCity(text);
              clearError("city");
            }}
            error={errors.city}
            testID="input-city"
          />

          <View style={styles.row}>
            <View style={styles.stateField}>
              <TextField
                label="State"
                placeholder="CA"
                autoComplete="postal-address-region"
                autoCapitalize="characters"
                maxLength={2}
                value={state}
                onChangeText={(text) => {
                  setState(text.toUpperCase());
                  clearError("state");
                }}
                error={errors.state}
                testID="input-state"
              />
            </View>
            <View style={styles.zipField}>
              <TextField
                label="ZIP Code"
                placeholder="12345"
                keyboardType="number-pad"
                autoComplete="postal-code"
                maxLength={10}
                value={zipCode}
                onChangeText={(text) => {
                  setZipCode(text);
                  clearError("zipCode");
                }}
                error={errors.zipCode}
                testID="input-zip"
              />
            </View>
          </View>
        </View>

        <View style={styles.formFooter}>
          <PrimaryButton
            onPress={handleAddHome}
            loading={loading}
            disabled={loading}
            testID="button-submit"
          >
            Continue
          </PrimaryButton>
          <SecondaryButton
            onPress={goToMain}
            testID="button-skip"
          >
            Skip for Now
          </SecondaryButton>
        </View>
      </KeyboardAwareScrollViewCompat>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  welcomeContent: {
    flex: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  welcomeHeader: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  welcomeIcon: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.xl,
  },
  welcomeTitle: {
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  welcomeSubtitle: {
    textAlign: "center",
    lineHeight: 24,
    paddingHorizontal: Spacing.lg,
  },
  welcomeFooter: {
    gap: Spacing.md,
  },
  formContent: {
    flexGrow: 1,
    paddingHorizontal: Spacing.screenPadding,
  },
  formHeader: {
    alignItems: "center",
    marginBottom: Spacing.xl,
  },
  homeIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  formTitle: {
    textAlign: "center",
    marginBottom: Spacing.xs,
  },
  formSubtitle: {
    textAlign: "center",
    lineHeight: 22,
  },
  form: {
    gap: Spacing.lg,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  stateField: {
    flex: 1,
  },
  zipField: {
    flex: 2,
  },
  formFooter: {
    marginTop: "auto",
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
});
