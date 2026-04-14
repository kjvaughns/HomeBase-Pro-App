import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  StyleSheet,
  View,
  TextInput,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Keyboard,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { Spacing, Colors, BorderRadius, Typography } from "@/constants/theme";

interface Prediction {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
}

export interface EnrichmentData {
  // Address fields
  street: string;
  city: string;
  state: string;
  zipCode: string;
  formattedAddress: string;
  placeId: string;
  
  // Location
  latitude?: number;
  longitude?: number;
  neighborhoodName?: string;
  countyName?: string;
  
  // Property data from Zillow
  bedrooms?: number;
  bathrooms?: number;
  squareFeet?: number;
  yearBuilt?: number;
  propertyType?: string;
  estimatedValue?: number;
  lotSize?: number;
  zillowId?: string;
  zillowUrl?: string;
  taxAssessedValue?: number;
  lastSoldDate?: string;
  lastSoldPrice?: number;
}

interface AddressAutocompleteProps {
  onAddressSelected: (data: EnrichmentData) => void;
  placeholder?: string;
  testID?: string;
}

export function AddressAutocomplete({
  onAddressSelected,
  placeholder = "Search for your address...",
  testID,
}: AddressAutocompleteProps) {
  const { theme } = useTheme();
  const [query, setQuery] = useState("");
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isEnriching, setIsEnriching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchAddresses = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3) {
      setPredictions([]);
      setShowDropdown(false);
      return;
    }

    setIsLoading(true);
    try {
      const url = new URL("/api/housefax/autocomplete", getApiUrl());
      url.searchParams.set("q", searchQuery);
      const response = await fetch(url.href);
      const data = await response.json();
      setPredictions(data.predictions || []);
      setShowDropdown(true);
    } catch (error) {
      console.error("Address search error:", error);
      setPredictions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTextChange = (text: string) => {
    setQuery(text);
    setSelectedAddress(null);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchAddresses(text);
    }, 300);
  };

  const handleSelectPrediction = async (prediction: Prediction) => {
    void Haptics.selectionAsync();
    Keyboard.dismiss();
    setQuery(prediction.description);
    setSelectedAddress(prediction.description);
    setPredictions([]);
    setShowDropdown(false);
    setIsEnriching(true);

    try {
      const response = await apiRequest("POST", "/api/housefax/enrich", { address: prediction.description });
      
      const data = await response.json();
      
      if (data.success) {
        const zillow = data.zillow || {};
        const google = data.google || {};
        
        const enrichmentData: EnrichmentData = {
          street: prediction.mainText || zillow.address?.split(",")[0] || "",
          city: google.city || "",
          state: google.state || "",
          zipCode: google.zipCode || "",
          formattedAddress: google.formattedAddress || prediction.description,
          placeId: google.placeId || prediction.placeId,
          latitude: google.latitude,
          longitude: google.longitude,
          neighborhoodName: google.neighborhood,
          countyName: google.county,
          bedrooms: zillow.bedrooms,
          bathrooms: zillow.bathrooms,
          squareFeet: zillow.livingArea,
          yearBuilt: zillow.yearBuilt,
          propertyType: zillow.propertyType?.toLowerCase().replace(/_/g, " "),
          estimatedValue: zillow.zestimate,
          lotSize: zillow.lotSize,
          zillowId: zillow.zpid,
          zillowUrl: zillow.url,
          taxAssessedValue: zillow.taxAssessedValue,
          lastSoldDate: zillow.lastSoldDate != null ? String(zillow.lastSoldDate) : undefined,
          lastSoldPrice: zillow.lastSoldPrice,
        };
        
        onAddressSelected(enrichmentData);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        const parts = prediction.description.split(", ");
        const stateZip = parts[parts.length - 2]?.split(" ") || [];
        onAddressSelected({
          street: parts[0] || prediction.mainText,
          city: parts[1] || "",
          state: stateZip[0] || "",
          zipCode: stateZip[1] || "",
          formattedAddress: prediction.description,
          placeId: prediction.placeId,
        });
      }
    } catch (error) {
      console.error("Enrichment error:", error);
      const parts = prediction.description.split(", ");
      const stateZip = parts[parts.length - 2]?.split(" ") || [];
      onAddressSelected({
        street: parts[0] || prediction.mainText,
        city: parts[1] || "",
        state: stateZip[0] || "",
        zipCode: stateZip[1] || "",
        formattedAddress: prediction.description,
        placeId: prediction.placeId,
      });
    } finally {
      setIsEnriching(false);
    }
  };

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.inputContainer,
          {
            backgroundColor: theme.backgroundSecondary,
            borderColor: showDropdown ? Colors.accent : theme.borderLight,
          },
        ]}
      >
        <Feather name="search" size={20} color={theme.textTertiary} style={styles.icon} />
        <TextInput
          style={[styles.input, { color: theme.text }]}
          placeholder={placeholder}
          placeholderTextColor={theme.textTertiary}
          value={query}
          onChangeText={handleTextChange}
          autoCorrect={false}
          autoCapitalize="words"
          testID={testID}
        />
        {(isLoading || isEnriching) ? (
          <ActivityIndicator size="small" color={Colors.accent} style={styles.loader} />
        ) : selectedAddress ? (
          <View style={styles.checkIcon}>
            <Feather name="check-circle" size={20} color={Colors.accent} />
          </View>
        ) : null}
      </View>

      {showDropdown && predictions.length > 0 ? (
        <View style={[styles.dropdown, { backgroundColor: theme.cardBackground, borderColor: theme.borderLight }]}>
          <ScrollView keyboardShouldPersistTaps="handled" nestedScrollEnabled style={styles.dropdownScroll}>
            {predictions.map((prediction, index) => (
              <Pressable
                key={prediction.placeId}
                onPress={() => handleSelectPrediction(prediction)}
                style={({ pressed }) => [
                  styles.predictionItem,
                  pressed && { backgroundColor: theme.backgroundSecondary },
                  index < predictions.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.borderLight },
                ]}
              >
                <Feather name="map-pin" size={16} color={theme.textTertiary} style={styles.predictionIcon} />
                <View style={styles.predictionText}>
                  <ThemedText style={styles.mainText} numberOfLines={1}>
                    {prediction.mainText}
                  </ThemedText>
                  <ThemedText style={[styles.secondaryText, { color: theme.textSecondary }]} numberOfLines={1}>
                    {prediction.secondaryText}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {isEnriching ? (
        <View style={[styles.enrichingBanner, { backgroundColor: Colors.accentLight }]}>
          <ActivityIndicator size="small" color={Colors.accent} />
          <ThemedText style={styles.enrichingText}>Finding property details...</ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1000,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: 52,
  },
  icon: {
    marginRight: Spacing.sm,
  },
  input: {
    flex: 1,
    ...Typography.body,
    height: "100%",
  },
  loader: {
    marginLeft: Spacing.sm,
  },
  checkIcon: {
    marginLeft: Spacing.sm,
  },
  dropdown: {
    position: "absolute",
    top: 56,
    left: 0,
    right: 0,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    maxHeight: 240,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownScroll: {
    maxHeight: 240,
  },
  predictionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
  },
  predictionIcon: {
    marginRight: Spacing.sm,
  },
  predictionText: {
    flex: 1,
  },
  mainText: {
    ...Typography.subhead,
    fontWeight: "500",
  },
  secondaryText: {
    ...Typography.caption1,
    marginTop: 2,
  },
  enrichingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.sm,
    marginTop: Spacing.sm,
    gap: Spacing.sm,
  },
  enrichingText: {
    ...Typography.caption1,
    color: Colors.accent,
    fontWeight: "500",
  },
});
