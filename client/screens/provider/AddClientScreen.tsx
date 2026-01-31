import React, { useState } from "react";
import { StyleSheet, ScrollView, View, Alert, KeyboardAvoidingView, Platform } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useHeaderHeight } from "@react-navigation/elements";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { ThemedView } from "@/components/ThemedView";
import { ThemedText } from "@/components/ThemedText";
import { TextField } from "@/components/TextField";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { GlassCard } from "@/components/GlassCard";
import { AddressAutocomplete, EnrichmentData } from "@/components/AddressAutocomplete";
import { Spacing, Typography } from "@/constants/theme";
import { useAuthStore } from "@/state/authStore";
import { apiRequest } from "@/lib/query-client";

export default function AddClientScreen() {
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
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

  const handleAddressSelected = (data: EnrichmentData) => {
    setAddress(data.street || "");
    setCity(data.city || "");
    setState(data.state || "");
    setZip(data.zipCode || "");
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
    }) => {
      const response = await apiRequest("POST", "/api/clients", data);
      return response.json();
    },
    onSuccess: (data) => {
      Alert.alert("Success", "Client added successfully!", [
        {
          text: "OK",
          onPress: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/provider", providerProfile?.id, "clients"] });
            queryClient.invalidateQueries({ queryKey: ["/api/provider", providerProfile?.id, "stats"] });
            navigation.goBack();
          },
        },
      ]);
    },
    onError: (error) => {
      Alert.alert("Error", "Failed to create client. Please try again.");
      console.error("Create client error:", error);
    },
  });

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert("Required Fields", "Please enter the client's first and last name.");
      return;
    }

    if (!providerProfile?.id) {
      Alert.alert("Error", "Provider profile not found.");
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
    });
  };

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        keyboardVerticalOffset={headerHeight}
      >
        <ScrollView
          contentContainerStyle={{
            paddingTop: headerHeight + Spacing.lg,
            paddingBottom: insets.bottom + Spacing.xl,
            paddingHorizontal: Spacing.screenPadding,
          }}
          showsVerticalScrollIndicator={false}
        >
          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Basic Info</ThemedText>
            
            <TextField
              label="First Name"
              value={firstName}
              onChangeText={setFirstName}
              placeholder="John"
              autoCapitalize="words"
            />
            
            <TextField
              label="Last Name"
              value={lastName}
              onChangeText={setLastName}
              placeholder="Doe"
              autoCapitalize="words"
            />
            
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="john@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            
            <TextField
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
            />
          </GlassCard>

          <GlassCard style={StyleSheet.flatten([styles.section, { zIndex: 1000 }])}>
            <ThemedText style={styles.sectionTitle}>Address</ThemedText>
            
            <AddressAutocomplete
              onAddressSelected={handleAddressSelected}
              placeholder="Search for address..."
              testID="input-address-search"
            />
            
            <TextField
              label="Street Address"
              value={address}
              onChangeText={setAddress}
              placeholder="123 Main St"
            />
            
            <TextField
              label="City"
              value={city}
              onChangeText={setCity}
              placeholder="San Francisco"
              autoCapitalize="words"
            />
            
            <View style={styles.row}>
              <View style={styles.halfField}>
                <TextField
                  label="State"
                  value={state}
                  onChangeText={setState}
                  placeholder="CA"
                  autoCapitalize="characters"
                />
              </View>
              <View style={styles.halfField}>
                <TextField
                  label="ZIP Code"
                  value={zip}
                  onChangeText={setZip}
                  placeholder="94102"
                  keyboardType="number-pad"
                />
              </View>
            </View>
          </GlassCard>

          <GlassCard style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Notes</ThemedText>
            
            <TextField
              label="Notes (optional)"
              value={notes}
              onChangeText={setNotes}
              placeholder="Any additional notes about this client..."
              multiline
              numberOfLines={4}
            />
          </GlassCard>

          <View style={styles.buttons}>
            <PrimaryButton
              onPress={handleSave}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Saving..." : "Save Client"}
            </PrimaryButton>
            
            <SecondaryButton
              onPress={() => navigation.goBack()}
              disabled={createMutation.isPending}
            >
              Cancel
            </SecondaryButton>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  sectionTitle: {
    ...Typography.headline,
    marginBottom: Spacing.md,
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
});
