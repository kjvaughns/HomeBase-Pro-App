import React, { useState, useRef, useCallback, useEffect } from "react";
import {
  StyleSheet,
  View,
  FlatList,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
} from "react-native";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown, FadeInUp } from "react-native-reanimated";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { GlassCard } from "@/components/GlassCard";
import { PrimaryButton } from "@/components/PrimaryButton";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors, Typography, BorderRadius } from "@/constants/theme";
import { getApiUrl, apiRequest } from "@/lib/query-client";
import { RootStackParamList } from "@/navigation/RootStackNavigator";
import { useAuthStore } from "@/state/authStore";
import { useQueryClient } from "@tanstack/react-query";

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  options?: ServiceOption[];
  showInput?: boolean;
  inputType?: "text" | "price" | "select";
  field?: string;
}

interface ServiceOption {
  id: string;
  label: string;
  icon?: string;
  description?: string;
}

interface ServiceDraft {
  businessType?: string;
  serviceName?: string;
  description?: string;
  pricingModel?: string;
  basePrice?: number;
  priceUnit?: string;
  duration?: string;
  addOns?: string[];
}

const BUSINESS_TYPES: ServiceOption[] = [
  { id: "hvac", label: "HVAC", icon: "thermometer", description: "Heating, cooling & ventilation" },
  { id: "plumbing", label: "Plumbing", icon: "droplet", description: "Pipes, fixtures & water systems" },
  { id: "electrical", label: "Electrical", icon: "zap", description: "Wiring, outlets & panels" },
  { id: "cleaning", label: "Cleaning", icon: "home", description: "Residential & commercial cleaning" },
  { id: "landscaping", label: "Lawn & Garden", icon: "sun", description: "Lawn care & landscaping" },
  { id: "handyman", label: "Handyman", icon: "tool", description: "General repairs & maintenance" },
  { id: "painting", label: "Painting", icon: "edit-3", description: "Interior & exterior painting" },
  { id: "roofing", label: "Roofing", icon: "triangle", description: "Roof repair & installation" },
];

export default function ServiceBuilderScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavigationProp>();
  const { theme, isDark } = useTheme();
  const { providerProfile } = useAuthStore();
  const queryClient = useQueryClient();
  const flatListRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<"welcome" | "type" | "name" | "pricing" | "details" | "review">("welcome");
  const [serviceDraft, setServiceDraft] = useState<ServiceDraft>({});

  useEffect(() => {
    startConversation();
  }, []);

  const startConversation = () => {
    const welcomeMessage: Message = {
      id: "welcome-1",
      role: "assistant",
      content: "Welcome to the Service Builder! I'll help you create a professional service listing optimized for your industry.",
    };

    const typeQuestion: Message = {
      id: "welcome-2",
      role: "assistant",
      content: "What type of home service do you provide?",
      options: BUSINESS_TYPES,
    };

    setMessages([welcomeMessage, typeQuestion]);
    setCurrentStep("type");
  };

  const handleOptionSelect = async (option: ServiceOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: option.label,
    };

    setMessages((prev) => [...prev, userMessage]);
    setServiceDraft((prev) => ({ ...prev, businessType: option.id }));
    setIsLoading(true);

    await generateNextStep(option.id, "type");
  };

  const handleTextSubmit = async () => {
    if (!inputText.trim()) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: inputText.trim(),
    };

    setMessages((prev) => [...prev, userMessage]);
    const savedInput = inputText.trim();
    setInputText("");
    setIsLoading(true);

    if (currentStep === "name") {
      setServiceDraft((prev) => ({ ...prev, serviceName: savedInput }));
      await generateNextStep(savedInput, "name");
    } else if (currentStep === "details") {
      await generateNextStep(savedInput, "details");
    }
  };

  const handlePricingSelect = async (option: ServiceOption) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: option.label,
    };

    setMessages((prev) => [...prev, userMessage]);
    setServiceDraft((prev) => ({ ...prev, pricingModel: option.id }));
    setIsLoading(true);

    await generateNextStep(option.id, "pricing");
  };

  const generateNextStep = async (input: string, step: string) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(new URL("/api/service-builder/next", apiUrl).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          step,
          input,
          serviceDraft,
        }),
      });

      if (!response.ok) throw new Error("Failed to get AI response");

      const data = await response.json();

      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: data.message,
        options: data.options,
        showInput: data.showInput,
        inputType: data.inputType,
      };

      setMessages((prev) => [...prev, aiMessage]);
      setCurrentStep(data.nextStep);

      if (data.serviceDraft) {
        setServiceDraft((prev) => ({ ...prev, ...data.serviceDraft }));
      }

      if (data.nextStep === "review") {
        setTimeout(() => {
          const reviewCard: Message = {
            id: `review-${Date.now()}`,
            role: "system",
            content: "REVIEW_CARD",
          };
          setMessages((prev) => [...prev, reviewCard]);
        }, 500);
      }
    } catch (error) {
      console.error("Service builder error:", error);
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "I encountered an issue. Let me try a different approach.",
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePublishService = async () => {
    if (!providerProfile?.id) {
      Alert.alert("Error", "Provider profile not found. Please complete your profile setup.");
      return;
    }
    if (!serviceDraft.serviceName) {
      Alert.alert("Error", "Please complete the service name before publishing.");
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const url = new URL(`/api/provider/${providerProfile.id}/custom-services`, getApiUrl());
      const response = await apiRequest("POST", url.toString(), {
        name: serviceDraft.serviceName,
        category: serviceDraft.businessType || "General",
        description: serviceDraft.description || null,
        pricingType: serviceDraft.pricingModel === "flat" ? "fixed" :
          serviceDraft.pricingModel === "hourly" ? "variable" :
          serviceDraft.pricingModel === "service_call" ? "service_call" : "quote",
        basePrice: serviceDraft.basePrice ? String(serviceDraft.basePrice) : null,
        duration: null,
        isPublished: true,
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Unknown error" }));
        Alert.alert("Error", err.error || "Failed to publish service");
        return;
      }

      queryClient.invalidateQueries({ queryKey: ["/api/provider", providerProfile.id, "custom-services"] });
      navigation.goBack();
    } catch {
      Alert.alert("Error", "Failed to publish service. Please try again.");
    }
  };

  const getPricingDisplay = () => {
    const { pricingModel, basePrice } = serviceDraft;
    if (!basePrice) return "Price TBD";

    switch (pricingModel) {
      case "hourly":
        return `$${basePrice}/hour`;
      case "per_sqft":
        return `$${basePrice}/sq ft`;
      case "flat":
        return `$${basePrice} flat rate`;
      case "service_call":
        return `$${basePrice} service call + labor`;
      default:
        return `$${basePrice}`;
    }
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    if (item.role === "system" && item.content === "REVIEW_CARD") {
      return (
        <Animated.View
          entering={FadeInUp.delay(100).duration(400)}
          style={styles.reviewContainer}
        >
          <GlassCard style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <View style={[styles.reviewIcon, { backgroundColor: Colors.accentLight }]}>
                <Feather name="check-circle" size={24} color={Colors.accent} />
              </View>
              <ThemedText style={styles.reviewTitle}>Your Service</ThemedText>
            </View>

            <View style={styles.reviewRow}>
              <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>
                Service Name
              </ThemedText>
              <ThemedText style={styles.reviewValue}>
                {serviceDraft.serviceName || "Untitled Service"}
              </ThemedText>
            </View>

            <View style={styles.reviewRow}>
              <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>
                Category
              </ThemedText>
              <ThemedText style={styles.reviewValue}>
                {BUSINESS_TYPES.find((t) => t.id === serviceDraft.businessType)?.label || "General"}
              </ThemedText>
            </View>

            <View style={styles.reviewRow}>
              <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary }]}>
                Pricing
              </ThemedText>
              <ThemedText style={[styles.reviewValue, { color: Colors.accent }]}>
                {getPricingDisplay()}
              </ThemedText>
            </View>

            {serviceDraft.description ? (
              <View style={[styles.reviewRow, { flexDirection: "column", alignItems: "flex-start" }]}>
                <ThemedText style={[styles.reviewLabel, { color: theme.textSecondary, marginBottom: 4 }]}>
                  Description
                </ThemedText>
                <ThemedText style={styles.reviewDescription}>
                  {serviceDraft.description}
                </ThemedText>
              </View>
            ) : null}

            <View style={styles.reviewActions}>
              <PrimaryButton onPress={handlePublishService}>
                Publish Service
              </PrimaryButton>
            </View>
          </GlassCard>
        </Animated.View>
      );
    }

    const isUser = item.role === "user";

    return (
      <Animated.View
        entering={FadeInDown.delay(index * 30).duration(300)}
        style={[
          styles.messageContainer,
          isUser ? styles.userMessageContainer : styles.assistantMessageContainer,
        ]}
      >
        {!isUser ? (
          <View style={[styles.avatarContainer, { backgroundColor: Colors.accentLight }]}>
            <Feather name="cpu" size={16} color={Colors.accent} />
          </View>
        ) : null}
        <View style={styles.messageContent}>
          <View
            style={[
              styles.messageBubble,
              isUser
                ? { backgroundColor: Colors.accent }
                : { backgroundColor: theme.backgroundSecondary },
            ]}
          >
            <ThemedText
              style={[
                styles.messageText,
                isUser ? { color: "#FFFFFF" } : { color: theme.text },
              ]}
            >
              {item.content}
            </ThemedText>
          </View>

          {item.options && item.options.length > 0 ? (
            <View style={styles.optionsContainer}>
              {item.options.map((option) => (
                <Pressable
                  key={option.id}
                  style={[styles.optionCard, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => {
                    if (currentStep === "type") {
                      handleOptionSelect(option);
                    } else if (currentStep === "pricing") {
                      handlePricingSelect(option);
                    }
                  }}
                >
                  {option.icon ? (
                    <View style={[styles.optionIcon, { backgroundColor: Colors.accentLight }]}>
                      <Feather name={option.icon as any} size={18} color={Colors.accent} />
                    </View>
                  ) : null}
                  <View style={styles.optionText}>
                    <ThemedText style={styles.optionLabel}>{option.label}</ThemedText>
                    {option.description ? (
                      <ThemedText style={[styles.optionDescription, { color: theme.textSecondary }]}>
                        {option.description}
                      </ThemedText>
                    ) : null}
                  </View>
                  <Feather name="chevron-right" size={18} color={theme.textTertiary} />
                </Pressable>
              ))}
            </View>
          ) : null}
        </View>
      </Animated.View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyStateContainer}>
      <Animated.View entering={FadeIn.delay(100).duration(400)}>
        <View style={[styles.logoContainer, { backgroundColor: Colors.accentLight }]}>
          <Feather name="briefcase" size={32} color={Colors.accent} />
        </View>
      </Animated.View>

      <Animated.View entering={FadeIn.delay(200).duration(400)}>
        <ThemedText style={styles.emptyTitle}>AI Service Builder</ThemedText>
        <ThemedText style={[styles.emptySubtitle, { color: theme.textSecondary }]}>
          Create optimized service listings for your home services business.
        </ThemedText>
      </Animated.View>
    </View>
  );

  const showTextInput = currentStep === "name" || currentStep === "details" || 
    messages[messages.length - 1]?.showInput;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior="padding"
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          ListEmptyComponent={renderEmptyState}
          contentContainerStyle={[
            styles.messagesList,
            { paddingTop: insets.top + 60, paddingBottom: Spacing.xl },
          ]}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => {
            if (messages.length > 0) {
              flatListRef.current?.scrollToEnd({ animated: true });
            }
          }}
        />

        {showTextInput ? (
          <Animated.View
            entering={FadeInUp.duration(300)}
            style={[
              styles.inputContainer,
              {
                paddingBottom: insets.bottom + Spacing.sm,
                backgroundColor: theme.backgroundDefault,
                borderTopColor: theme.borderLight,
              },
            ]}
          >
            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary }]}>
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={currentStep === "name" ? "Enter service name..." : "Type your response..."}
                placeholderTextColor={theme.textTertiary}
                value={inputText}
                onChangeText={setInputText}
                onSubmitEditing={handleTextSubmit}
                returnKeyType="send"
                editable={!isLoading}
              />
              <Pressable
                onPress={handleTextSubmit}
                disabled={isLoading || !inputText.trim()}
                style={[
                  styles.sendButton,
                  {
                    backgroundColor: inputText.trim() ? Colors.accent : theme.backgroundTertiary,
                    opacity: isLoading ? 0.5 : 1,
                  },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Feather name="arrow-up" size={20} color="#FFFFFF" />
                )}
              </Pressable>
            </View>
          </Animated.View>
        ) : null}

        {isLoading && !showTextInput ? (
          <View style={[styles.loadingContainer, { paddingBottom: insets.bottom + Spacing.lg }]}>
            <ActivityIndicator size="small" color={Colors.accent} />
            <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
              Thinking...
            </ThemedText>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: Spacing.screenPadding,
    flexGrow: 1,
  },
  messageContainer: {
    flexDirection: "row",
    marginBottom: Spacing.md,
    maxWidth: "90%",
  },
  userMessageContainer: {
    alignSelf: "flex-end",
    justifyContent: "flex-end",
  },
  assistantMessageContainer: {
    alignSelf: "flex-start",
  },
  avatarContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
    marginTop: 4,
  },
  messageContent: {
    flex: 1,
  },
  messageBubble: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: BorderRadius.lg,
  },
  messageText: {
    ...Typography.body,
    lineHeight: 22,
  },
  optionsContainer: {
    marginTop: Spacing.md,
    gap: Spacing.sm,
  },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  optionDescription: {
    ...Typography.caption1,
    marginTop: 2,
  },
  emptyStateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing["2xl"],
  },
  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    ...Typography.title2,
    textAlign: "center",
    marginBottom: Spacing.sm,
  },
  emptySubtitle: {
    ...Typography.body,
    textAlign: "center",
    maxWidth: 280,
  },
  inputContainer: {
    paddingHorizontal: Spacing.screenPadding,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: BorderRadius.full,
    paddingLeft: Spacing.md,
    paddingRight: 4,
    paddingVertical: 4,
  },
  input: {
    flex: 1,
    ...Typography.body,
    paddingVertical: Spacing.sm,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
  },
  loadingText: {
    ...Typography.footnote,
  },
  reviewContainer: {
    marginTop: Spacing.md,
    marginBottom: Spacing.lg,
  },
  reviewCard: {
    padding: Spacing.lg,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.lg,
  },
  reviewIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.md,
  },
  reviewTitle: {
    ...Typography.title3,
    fontWeight: "700",
  },
  reviewRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  reviewLabel: {
    ...Typography.subhead,
  },
  reviewValue: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  reviewDescription: {
    ...Typography.body,
    lineHeight: 20,
  },
  reviewActions: {
    marginTop: Spacing.xl,
  },
});
