import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Feather } from "@expo/vector-icons";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { GlassCard } from "@/components/GlassCard";
import { FormSectionHeader } from "@/components/FormSectionHeader";
import { AddressAutocomplete, EnrichmentData } from "@/components/AddressAutocomplete";
import { Spacing, Typography, Colors, BorderRadius } from "@/constants/theme";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";
import * as Haptics from "expo-haptics";

export default function AddClientScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { theme } = useTheme();
  const { providerProfile } = useAuthStore();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [housefaxData, setHousefaxData] = useState<EnrichmentData | null>(null);

  // AddressAutocomplete is the canonical enrichment owner — it calls POST /api/housefax/enrich
  // internally when a prediction is selected, then delivers the full EnrichmentData here.
  const handleAddressSelected = (data: EnrichmentData) => {
    setAddress(data.street || "");
    setCity(data.city || "");
    setState(data.state || "");
    setZip(data.zipCode || "");
    // Store enrichment payload if Zillow property data was returned
    const hasPropertyData = data.bedrooms != null || data.bathrooms != null || data.squareFeet != null || data.yearBuilt != null;
    setHousefaxData(hasPropertyData ? data : null);
  };

  const createMutation = useMutation({
    mutationFn: async (data: {
      providerId: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone?: string;
      address?: string;
      city?: string;
      state?: string;
      zip?: string;
      notes?: string;
      housefaxData?: EnrichmentData;
    }) => {
      const response = await apiRequest("POST", "/api/clients", data);
      return response.json();
    },
    onSuccess: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerProfile?.id, "clients"] });
      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerProfile?.id, "stats"] });
      navigation.goBack();
    },
    onError: (error: any) => {
      const message = error?.message?.includes("already exists")
        ? "A client with this email already exists."
        : "Failed to create client. Please try again.";
      setErrorMessage(message);
    },
  });

  const handleSave = () => {
    setErrorMessage(null);
    if (!firstName.trim() || !lastName.trim()) {
      setErrorMessage("Please enter the client's first and last name.");
      return;
    }
    if (!providerProfile?.id) {
      setErrorMessage("Provider profile not found.");
      return;
    }
    createMutation.mutate({
      providerId: providerProfile.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      zip: zip.trim() || undefined,
      notes: notes.trim() || undefined,
      housefaxData: housefaxData ?? undefined,
    });
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAwareScrollViewCompat
        contentContainerStyle={{
          paddingTop: headerHeight + Spacing.lg,
          paddingBottom: insets.bottom + Spacing.xl,
          paddingHorizontal: Spacing.screenPadding,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Basic Info */}
        <GlassCard style={styles.section}>
          <FormSectionHeader icon="user" title="Basic Info" />
          <TextField
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            autoCapitalize="words"
            leftIcon="user"
            testID="input-first-name"
          />
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />
          <TextField
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            autoCapitalize="words"
            leftIcon="user"
            testID="input-last-name"
          />
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />
          <TextField
            value={email}
            onChangeText={setEmail}
            placeholder="Email address"
            keyboardType="email-address"
            autoCapitalize="none"
            leftIcon="mail"
            testID="input-email"
          />
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />
          <TextField
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            keyboardType="phone-pad"
            leftIcon="phone"
            testID="input-phone"
          />
        </GlassCard>

        {/* Address */}
        <GlassCard style={styles.addressSection}>
          <FormSectionHeader icon="map-pin" title="Address" />
          <AddressAutocomplete
            onAddressSelected={handleAddressSelected}
            placeholder="Search for address..."
            testID="input-address-search"
          />
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />
          <TextField
            value={address}
            onChangeText={setAddress}
            placeholder="Street address"
            leftIcon="home"
          />
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />
          <TextField
            value={city}
            onChangeText={setCity}
            placeholder="City"
            autoCapitalize="words"
            leftIcon="map"
          />
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />
          <View style={styles.row}>
            <View style={styles.halfField}>
              <TextField
                value={state}
                onChangeText={setState}
                placeholder="State"
                autoCapitalize="characters"
              />
            </View>
            <View style={styles.halfField}>
              <TextField
                value={zip}
                onChangeText={setZip}
                placeholder="ZIP Code"
                keyboardType="number-pad"
              />
            </View>
          </View>
        </GlassCard>

        {/* HouseFax Preview */}
        {housefaxData ? (
          <GlassCard style={[styles.section, styles.housefaxCard]}>
            <View style={styles.housefaxHeader}>
              <View style={[styles.housefaxIconWrap, { backgroundColor: Colors.accentLight }]}>
                <Feather name="home" size={14} color={Colors.accent} />
              </View>
              <ThemedText style={[styles.housefaxTitle, { color: Colors.accent }]}>Property Found</ThemedText>
            </View>
            <View style={styles.housefaxGrid}>
              {housefaxData.bedrooms != null ? (
                <View style={styles.housefaxStat}>
                  <ThemedText style={styles.housefaxValue}>{housefaxData.bedrooms}</ThemedText>
                  <ThemedText style={[styles.housefaxLabel, { color: theme.textSecondary }]}>Beds</ThemedText>
                </View>
              ) : null}
              {housefaxData.bathrooms != null ? (
                <View style={styles.housefaxStat}>
                  <ThemedText style={styles.housefaxValue}>{housefaxData.bathrooms}</ThemedText>
                  <ThemedText style={[styles.housefaxLabel, { color: theme.textSecondary }]}>Baths</ThemedText>
                </View>
              ) : null}
              {housefaxData.squareFeet != null ? (
                <View style={styles.housefaxStat}>
                  <ThemedText style={styles.housefaxValue}>{housefaxData.squareFeet.toLocaleString()}</ThemedText>
                  <ThemedText style={[styles.housefaxLabel, { color: theme.textSecondary }]}>Sq Ft</ThemedText>
                </View>
              ) : null}
              {housefaxData.yearBuilt != null ? (
                <View style={styles.housefaxStat}>
                  <ThemedText style={styles.housefaxValue}>{housefaxData.yearBuilt}</ThemedText>
                  <ThemedText style={[styles.housefaxLabel, { color: theme.textSecondary }]}>Built</ThemedText>
                </View>
              ) : null}
            </View>
            {housefaxData.estimatedValue != null ? (
              <ThemedText style={[styles.housefaxEstimate, { color: theme.textSecondary }]}>
                Zestimate: ${housefaxData.estimatedValue.toLocaleString()}
              </ThemedText>
            ) : null}
          </GlassCard>
        ) : null}

        {/* Notes */}
        <GlassCard style={styles.section}>
          <FormSectionHeader icon="message-circle" title="Notes" iconBg={undefined} />
          <TextField
            value={notes}
            onChangeText={setNotes}
            placeholder="Any additional notes about this client..."
            multiline
            numberOfLines={4}
            testID="input-notes"
          />
        </GlassCard>

        {errorMessage ? (
          <View style={[styles.errorBox, { backgroundColor: Colors.errorLight }]}>
            <Feather name="alert-circle" size={16} color={Colors.error} />
            <ThemedText style={[styles.errorText, { color: Colors.error }]}>
              {errorMessage}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.buttons}>
          <PrimaryButton
            onPress={handleSave}
            loading={createMutation.isPending}
            testID="button-save-client"
          >
            Save Client
          </PrimaryButton>
          <SecondaryButton
            onPress={() => navigation.goBack()}
            disabled={createMutation.isPending}
          >
            Cancel
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
  section: {
    marginBottom: Spacing.lg,
  },
  addressSection: {
    marginBottom: Spacing.lg,
    zIndex: 1000,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.xs,
  },
  row: {
    flexDirection: "row",
    gap: Spacing.md,
  },
  halfField: {
    flex: 1,
  },
  buttons: {
    gap: Spacing.md,
    marginTop: Spacing.md,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    ...Typography.subhead,
    flex: 1,
  },
  housefaxCard: {},
  housefaxHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  housefaxIconWrap: {
    width: 28,
    height: 28,
    borderRadius: BorderRadius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  housefaxTitle: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  housefaxGrid: {
    flexDirection: "row",
    gap: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  housefaxStat: {
    alignItems: "center",
  },
  housefaxValue: {
    ...Typography.h3,
    fontWeight: "700",
  },
  housefaxLabel: {
    ...Typography.caption1,
    marginTop: 2,
  },
  housefaxEstimate: {
    ...Typography.caption1,
    marginTop: Spacing.xs,
  },
});
