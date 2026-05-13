import React from "react";
import { StyleSheet, Pressable, View } from "react-native";
import * as Haptics from "expo-haptics";

import { Avatar } from "@/components/Avatar";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, Colors } from "@/constants/theme";
import { Message } from "@/state/mockData";

interface MessageRowProps {
  message: Message;
  onPress: () => void;
  testID?: string;
}

export function MessageRow({ message, onPress, testID }: MessageRowProps) {
  const { theme } = useTheme();

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      testID={testID}
      onPress={handlePress}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: pressed ? theme.backgroundDefault : "transparent",
        },
      ]}
    >
      <Avatar
        uri={message.recipientAvatar}
        name={message.recipientName}
        size="medium"
      />

      <View style={styles.content}>
        <View style={styles.header}>
          <ThemedText type="h4" numberOfLines={1} style={styles.name}>
            {message.recipientName}
          </ThemedText>
          <ThemedText type="caption" style={{ color: theme.textTertiary }}>
            {message.timestamp}
          </ThemedText>
        </View>

        <View style={styles.messageRow}>
          <ThemedText
            type="small"
            style={[
              styles.preview,
              {
                color: message.unreadCount > 0 ? theme.text : theme.textSecondary,
                fontWeight: message.unreadCount > 0 ? "500" : "400",
              },
            ]}
            numberOfLines={1}
          >
            {message.lastMessage}
          </ThemedText>

          {message.unreadCount > 0 ? (
            <View style={styles.badge}>
              <ThemedText type="caption" style={styles.badgeText}>
                {message.unreadCount}
              </ThemedText>
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
  },
  content: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  name: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  preview: {
    flex: 1,
  },
  badge: {
    backgroundColor: Colors.accent,
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    marginLeft: Spacing.sm,
  },
  badgeText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 11,
  },
});
