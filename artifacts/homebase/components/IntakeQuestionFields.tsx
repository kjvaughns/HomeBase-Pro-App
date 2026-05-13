import React from "react";
import { StyleSheet, View, Pressable, TextInput } from "react-native";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing, BorderRadius, Typography, Colors } from "@/constants/theme";
import type { IntakeQuestionDef } from "@/shared/jobSummary";

interface Props {
  questions: IntakeQuestionDef[];
  answers: Record<string, string>;
  onChange: (answers: Record<string, string>) => void;
  /** Optional test-id prefix for individual question fields. */
  testIDPrefix?: string;
}

/**
 * Shared renderer for service intake questions. Used by both the provider
 * Add Job screen and the homeowner Simple Booking screen so the same intake
 * UI appears regardless of who is filling it out.
 */
export function IntakeQuestionFields({
  questions,
  answers,
  onChange,
  testIDPrefix = "intake",
}: Props) {
  const { theme } = useTheme();

  if (!questions || questions.length === 0) return null;

  const setAnswer = (id: string, value: string) => {
    onChange({ ...answers, [id]: value });
  };

  return (
    <View>
      {questions.map((q, i) => (
        <View
          key={q.id}
          style={[
            styles.question,
            i > 0 && {
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: theme.borderLight,
            },
          ]}
        >
          <ThemedText style={[styles.label, { color: theme.text }]}>
            {q.question}
            {q.required ? " *" : ""}
          </ThemedText>

          {q.options && q.options.length > 0 ? (
            <View style={styles.optionsRow}>
              {q.options.map((opt: string) => {
                const isSelected = answers[q.id] === opt;
                return (
                  <Pressable
                    key={opt}
                    onPress={() => setAnswer(q.id, opt)}
                    style={[
                      styles.option,
                      {
                        backgroundColor: isSelected
                          ? Colors.accent + "18"
                          : theme.backgroundElevated,
                        borderColor: isSelected
                          ? Colors.accent
                          : theme.borderLight,
                      },
                    ]}
                    testID={`${testIDPrefix}-option-${q.id}-${opt}`}
                  >
                    <ThemedText
                      style={[
                        styles.optionText,
                        {
                          color: isSelected ? Colors.accent : theme.text,
                        },
                      ]}
                    >
                      {opt}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : (
            <TextInput
              value={answers[q.id] || ""}
              onChangeText={(text) => setAnswer(q.id, text)}
              placeholder={
                q.type === "number" ? "Enter a number" : "Your answer..."
              }
              placeholderTextColor={theme.textTertiary}
              keyboardType={q.type === "number" ? "numeric" : "default"}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.borderLight,
                  backgroundColor: theme.backgroundElevated,
                },
              ]}
              testID={`${testIDPrefix}-input-${q.id}`}
            />
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  question: {
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  label: {
    ...Typography.body,
    fontWeight: "600",
  },
  optionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.xs,
  },
  option: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
  },
  optionText: {
    ...Typography.subhead,
  },
  input: {
    borderWidth: 1,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Typography.body,
  },
});
