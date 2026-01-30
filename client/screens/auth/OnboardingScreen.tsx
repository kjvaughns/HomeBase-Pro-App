import React, { useState } from "react";
import { StyleSheet, View, Alert, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { CommonActions, useNavigation } from "@react-navigation/native";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { KeyboardAwareScrollViewCompat } from "@/components/KeyboardAwareScrollViewCompat";
import { AddressAutocomplete, EnrichmentData } from "@/components/AddressAutocomplete";
import { useTheme } from "@/hooks/useTheme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";

interface PropertyInfo {
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  propertyType?: string;
  estimatedValue?: number;
}

export default function OnboardingScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user } = useAuthStore();

  const [step, setStep] = useState<"welcome" | "add-home">("welcome");
  const [nickname, setNickname] = useState("My Home");
  const [loading, setLoading] = useState(false);
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentData | null>(null);
  const [propertyInfo, setPropertyInfo] = useState<PropertyInfo | null>(null);

  const goToMain = () => {
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: "Main" as never }],
      })
    );
  };

  const handleAddressSelected = (data: EnrichmentData) => {
    setEnrichmentData(data);
    if (data.bedrooms || data.squareFeet || data.yearBuilt || data.estimatedValue) {
      setPropertyInfo({
        bedrooms: data.bedrooms,
        bathrooms: data.bathrooms,
        squareFeet: data.squareFeet,
        yearBuilt: data.yearBuilt,
        propertyType: data.propertyType,
        estimatedValue: data.estimatedValue,
      });
    } else {
      setPropertyInfo(null);
    }
  };

  const handleAddHome = async () => {
    if (!enrichmentData || !user) {
      Alert.alert("Missing Address", "Please search and select an address to continue.");
      return;
    }

    setLoading(true);
    try {
      await apiRequest("POST", "/api/homes", {
        userId: user.id,
        label: nickname.trim() || "My Home",
        street: enrichmentData.street,
        city: enrichmentData.city,
        state: enrichmentData.state,
        zip: enrichmentData.zipCode,
        formattedAddress: enrichmentData.formattedAddress,
        placeId: enrichmentData.placeId,
        latitude: enrichmentData.latitude?.toString(),
        longitude: enrichmentData.longitude?.toString(),
        neighborhoodName: enrichmentData.neighborhoodName,
        countyName: enrichmentData.countyName,
        bedrooms: enrichmentData.bedrooms,
        bathrooms: enrichmentData.bathrooms,
        squareFeet: enrichmentData.squareFeet,
        yearBuilt: enrichmentData.yearBuilt,
        propertyType: enrichmentData.propertyType?.replace(/ /g, "_"),
        estimatedValue: enrichmentData.estimatedValue?.toString(),
        lotSize: enrichmentData.lotSize,
        zillowId: enrichmentData.zillowId,
        zillowUrl: enrichmentData.zillowUrl,
        taxAssessedValue: enrichmentData.taxAssessedValue?.toString(),
        lastSoldDate: enrichmentData.lastSoldDate,
        lastSoldPrice: enrichmentData.lastSoldPrice?.toString(),
      });
      goToMain();
    } catch (error) {
      Alert.alert("Error", "Unable to add your home. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatNumber = (value: number) => {
    return new Intl.NumberFormat("en-US").format(value);
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
            Search for your address to find local service providers
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

          <View style={styles.fieldContainer}>
            <ThemedText style={[styles.label, { color: theme.textSecondary }]}>Address</ThemedText>
            <AddressAutocomplete
              onAddressSelected={handleAddressSelected}
              placeholder="Search for your address..."
              testID="input-address-search"
            />
          </View>

          {enrichmentData ? (
            <View style={[styles.addressConfirmation, { backgroundColor: Colors.accentLight, borderColor: Colors.accent }]}>
              <View style={styles.addressConfirmHeader}>
                <Feather name="check-circle" size={20} color={Colors.accent} />
                <ThemedText style={styles.addressConfirmTitle}>Address Found</ThemedText>
              </View>
              <ThemedText style={[styles.addressConfirmText, { color: theme.text }]}>
                {enrichmentData.street}
              </ThemedText>
              <ThemedText style={[styles.addressConfirmSubtext, { color: theme.textSecondary }]}>
                {enrichmentData.city}, {enrichmentData.state} {enrichmentData.zipCode}
              </ThemedText>
            </View>
          ) : null}

          {propertyInfo ? (
            <View style={[styles.propertyCard, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
              <View style={styles.propertyHeader}>
                <Feather name="info" size={18} color={Colors.accent} />
                <ThemedText style={styles.propertyTitle}>Property Details</ThemedText>
              </View>
              
              <View style={styles.propertyGrid}>
                {propertyInfo.bedrooms ? (
                  <View style={styles.propertyItem}>
                    <ThemedText style={[styles.propertyValue, { color: theme.text }]}>
                      {propertyInfo.bedrooms}
                    </ThemedText>
                    <ThemedText style={[styles.propertyLabel, { color: theme.textSecondary }]}>
                      Beds
                    </ThemedText>
                  </View>
                ) : null}
                
                {propertyInfo.bathrooms ? (
                  <View style={styles.propertyItem}>
                    <ThemedText style={[styles.propertyValue, { color: theme.text }]}>
                      {propertyInfo.bathrooms}
                    </ThemedText>
                    <ThemedText style={[styles.propertyLabel, { color: theme.textSecondary }]}>
                      Baths
                    </ThemedText>
                  </View>
                ) : null}
                
                {propertyInfo.squareFeet ? (
                  <View style={styles.propertyItem}>
                    <ThemedText style={[styles.propertyValue, { color: theme.text }]}>
                      {formatNumber(propertyInfo.squareFeet)}
                    </ThemedText>
                    <ThemedText style={[styles.propertyLabel, { color: theme.textSecondary }]}>
                      Sq Ft
                    </ThemedText>
                  </View>
                ) : null}
                
                {propertyInfo.yearBuilt ? (
                  <View style={styles.propertyItem}>
                    <ThemedText style={[styles.propertyValue, { color: theme.text }]}>
                      {propertyInfo.yearBuilt}
                    </ThemedText>
                    <ThemedText style={[styles.propertyLabel, { color: theme.textSecondary }]}>
                      Built
                    </ThemedText>
                  </View>
                ) : null}
              </View>

              {propertyInfo.estimatedValue ? (
                <View style={[styles.valueRow, { borderTopColor: theme.borderLight }]}>
                  <ThemedText style={[styles.valueLabel, { color: theme.textSecondary }]}>
                    Estimated Value
                  </ThemedText>
                  <ThemedText style={[styles.valueAmount, { color: Colors.accent }]}>
                    {formatCurrency(propertyInfo.estimatedValue)}
                  </ThemedText>
                </View>
              ) : null}

              {propertyInfo.propertyType ? (
                <View style={[styles.typeRow, { borderTopColor: theme.borderLight }]}>
                  <ThemedText style={[styles.typeLabel, { color: theme.textSecondary }]}>
                    Type
                  </ThemedText>
                  <ThemedText style={[styles.typeValue, { color: theme.text }]}>
                    {propertyInfo.propertyType.charAt(0).toUpperCase() + propertyInfo.propertyType.slice(1)}
                  </ThemedText>
                </View>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.formFooter}>
          <PrimaryButton
            onPress={handleAddHome}
            loading={loading}
            disabled={loading || !enrichmentData}
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
  fieldContainer: {
    gap: Spacing.xs,
  },
  label: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  addressConfirmation: {
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  addressConfirmHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  addressConfirmTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    color: Colors.accent,
  },
  addressConfirmText: {
    ...Typography.body,
    fontWeight: "500",
  },
  addressConfirmSubtext: {
    ...Typography.caption1,
    marginTop: 2,
  },
  propertyCard: {
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  propertyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  propertyTitle: {
    ...Typography.subhead,
    fontWeight: "600",
    color: Colors.accent,
  },
  propertyGrid: {
    flexDirection: "row",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  propertyItem: {
    flex: 1,
    alignItems: "center",
  },
  propertyValue: {
    ...Typography.title2,
    fontWeight: "700",
  },
  propertyLabel: {
    ...Typography.caption1,
    marginTop: 2,
  },
  valueRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: Spacing.md,
    borderTopWidth: 1,
  },
  valueLabel: {
    ...Typography.subhead,
  },
  valueAmount: {
    ...Typography.headline,
    fontWeight: "700",
  },
  typeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
  },
  typeLabel: {
    ...Typography.caption1,
  },
  typeValue: {
    ...Typography.caption1,
    fontWeight: "500",
  },
  formFooter: {
    marginTop: "auto",
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
});
