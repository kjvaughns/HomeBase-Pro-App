import React, { useState } from "react";
import {
  View,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  Linking,
} from "react-native";
import { useHeaderHeight } from "@react-navigation/elements";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";

import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, Typography, BorderRadius } from "@/constants/theme";

interface FAQItem {
  id: string;
  question: string;
  answer: string;
}

interface FAQSection {
  id: string;
  title: string;
  icon: keyof typeof Feather.glyphMap;
  items: FAQItem[];
}

const FAQ_SECTIONS: FAQSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "play-circle",
    items: [
      {
        id: "gs-1",
        question: "How do I book a service?",
        answer:
          "You can book a service by browsing providers in the Find tab, selecting a provider, choosing a service, and completing the booking flow. You'll describe your issue, select a date and time, and confirm your booking.",
      },
      {
        id: "gs-2",
        question: "What is the AI assistant?",
        answer:
          "Our AI assistant can answer questions about home maintenance and repairs, help you understand issues, and guide you to the right service provider. Just tap 'Ask HomeBase AI' on the home screen.",
      },
      {
        id: "gs-3",
        question: "How do I add my home address?",
        answer:
          "Go to your profile, tap 'My Addresses', then tap the '+' button to add a new address. You can set one address as your default for quick booking.",
      },
    ],
  },
  {
    id: "booking",
    title: "Bookings & Appointments",
    icon: "calendar",
    items: [
      {
        id: "bk-1",
        question: "Can I cancel or reschedule a booking?",
        answer:
          "Yes, you can cancel or reschedule a booking from the job details page. Contact the provider directly if the appointment is within 24 hours.",
      },
      {
        id: "bk-2",
        question: "How do I know when my provider will arrive?",
        answer:
          "You'll receive notifications when your provider is on the way. You can also track the status of your job in the Jobs tab.",
      },
      {
        id: "bk-3",
        question: "What if the provider doesn't show up?",
        answer:
          "If your provider doesn't arrive at the scheduled time, contact them through the app. If unresponsive, reach out to our support team for assistance.",
      },
    ],
  },
  {
    id: "payments",
    title: "Payments & Pricing",
    icon: "credit-card",
    items: [
      {
        id: "py-1",
        question: "How do I pay for services?",
        answer:
          "After your service is completed, the provider will send you an invoice through the app. You can pay securely using your saved payment methods.",
      },
      {
        id: "py-2",
        question: "Are prices negotiable?",
        answer:
          "Prices shown are estimates. The final price depends on the actual scope of work. Providers will confirm pricing before starting work.",
      },
      {
        id: "py-3",
        question: "What payment methods are accepted?",
        answer:
          "We accept major credit cards, debit cards, and Apple Pay. You can manage your payment methods in your profile settings.",
      },
    ],
  },
  {
    id: "providers",
    title: "About Providers",
    icon: "users",
    items: [
      {
        id: "pv-1",
        question: "How are providers vetted?",
        answer:
          "All providers are background-checked and must provide proof of licensing and insurance. We also verify reviews and track performance metrics.",
      },
      {
        id: "pv-2",
        question: "What if I'm not satisfied with the work?",
        answer:
          "Contact the provider first to resolve any issues. If you can't reach a resolution, our support team can help mediate and find a solution.",
      },
      {
        id: "pv-3",
        question: "Can I request a specific provider?",
        answer:
          "Yes! You can save your favorite providers and book directly with them for future jobs. Just tap the heart icon on their profile.",
      },
    ],
  },
];

function FAQItemComponent({ item, isExpanded, onToggle }: { 
  item: FAQItem; 
  isExpanded: boolean; 
  onToggle: () => void;
}) {
  const { theme, isDark } = useTheme();

  return (
    <Pressable
      style={[styles.faqItem, { borderColor: theme.border }]}
      onPress={onToggle}
    >
      <View style={styles.faqQuestion}>
        <ThemedText style={styles.faqQuestionText} numberOfLines={isExpanded ? undefined : 2}>
          {item.question}
        </ThemedText>
        <Feather
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={20}
          color={theme.textSecondary}
        />
      </View>
      {isExpanded ? (
        <ThemedText style={[styles.faqAnswer, { color: theme.textSecondary }]}>
          {item.answer}
        </ThemedText>
      ) : null}
    </Pressable>
  );
}

function FAQSectionComponent({ section }: { section: FAQSection }) {
  const { theme, isDark } = useTheme();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleItem = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <View style={styles.sectionContainer}>
      <View style={styles.sectionHeader}>
        <View style={[styles.sectionIcon, { backgroundColor: Colors.accent + "15" }]}>
          <Feather name={section.icon} size={18} color={Colors.accent} />
        </View>
        <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
      </View>
      <View style={[styles.sectionCard, { overflow: "hidden", borderRadius: BorderRadius.lg }]}>
        {Platform.OS === "ios" ? (
          <BlurView
            intensity={60}
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View
            style={[
              StyleSheet.absoluteFill,
              { backgroundColor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)" },
            ]}
          />
        )}
        {section.items.map((item, index) => (
          <FAQItemComponent
            key={item.id}
            item={item}
            isExpanded={expandedId === item.id}
            onToggle={() => toggleItem(item.id)}
          />
        ))}
      </View>
    </View>
  );
}

export default function HelpCenterScreen() {
  const { theme, isDark } = useTheme();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();

  const handleContactSupport = () => {
    Linking.openURL("mailto:support@homebase.app");
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: headerHeight + Spacing.md,
            paddingBottom: insets.bottom + Spacing.xl,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <ThemedText style={styles.headerTitle}>How can we help?</ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
            Find answers to common questions below
          </ThemedText>
        </View>

        {FAQ_SECTIONS.map((section) => (
          <FAQSectionComponent key={section.id} section={section} />
        ))}

        <View style={styles.contactSection}>
          <ThemedText style={[styles.contactText, { color: theme.textSecondary }]}>
            Can't find what you're looking for?
          </ThemedText>
          <Pressable
            style={[styles.contactButton, { backgroundColor: Colors.accent }]}
            onPress={handleContactSupport}
          >
            <Feather name="mail" size={18} color="#FFF" />
            <ThemedText style={styles.contactButtonText}>Contact Support</ThemedText>
          </Pressable>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: Spacing.screenPadding,
  },
  header: {
    marginBottom: Spacing.xl,
  },
  headerTitle: {
    ...Typography.title2,
    fontWeight: "700",
    marginBottom: Spacing.xs,
  },
  headerSubtitle: {
    ...Typography.body,
  },
  sectionContainer: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  sectionTitle: {
    ...Typography.headline,
    fontWeight: "600",
  },
  sectionCard: {
    borderRadius: BorderRadius.lg,
  },
  faqItem: {
    padding: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  faqQuestion: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: Spacing.sm,
  },
  faqQuestionText: {
    ...Typography.callout,
    fontWeight: "500",
    flex: 1,
  },
  faqAnswer: {
    ...Typography.subhead,
    marginTop: Spacing.sm,
    lineHeight: 22,
  },
  contactSection: {
    alignItems: "center",
    marginTop: Spacing.xl,
    paddingTop: Spacing.xl,
  },
  contactText: {
    ...Typography.body,
    marginBottom: Spacing.md,
  },
  contactButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 12,
  },
  contactButtonText: {
    ...Typography.callout,
    fontWeight: "600",
    color: "#FFF",
  },
});
