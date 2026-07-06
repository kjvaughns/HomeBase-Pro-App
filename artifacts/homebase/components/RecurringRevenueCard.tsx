/**
 * Task #488: "Locked-in revenue" surface for recurring/repeating visits.
 *
 * Shows a single normalized "booked per month" number derived from every
 * active recurring job_series (weekly/biweekly/monthly/quarterly all rolled
 * up to a monthly-equivalent dollar figure), plus a small forward-looking
 * calendar heatmap of upcoming recurring visit density so a provider can see
 * their booked recurring pipeline at a glance.
 */
import React, { useMemo } from "react";
import { View, StyleSheet } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";

import { GlassCard } from "@/components/GlassCard";
import { ThemedText } from "@/components/ThemedText";
import { formatMoney } from "@/lib/format";
import { useTheme } from "@/hooks/useTheme";
import { Colors, Spacing, BorderRadius } from "@/constants/theme";

interface RecurringRevenueSummary {
  monthlyRevenue: number;
  activeSeriesCount: number;
  calendar: { date: string; count: number; revenue: number }[];
}

const HEATMAP_DAYS = 42; // 6 full weeks

function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function heatColor(count: number, theme: ReturnType<typeof useTheme>["theme"]): string {
  if (count <= 0) return theme.separator;
  if (count === 1) return Colors.accent + "40";
  if (count === 2) return Colors.accent + "80";
  return Colors.accent;
}

function ForwardHeatmap({
  calendar,
  theme,
}: {
  calendar: RecurringRevenueSummary["calendar"];
  theme: ReturnType<typeof useTheme>["theme"];
}) {
  const countsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const day of calendar) map.set(day.date, day.count);
    return map;
  }, [calendar]);

  const days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const startOffset = today.getDay(); // align to start of week (Sun)
    const start = new Date(today);
    start.setDate(start.getDate() - startOffset);

    const result: { key: string; count: number; isPast: boolean }[] = [];
    for (let i = 0; i < HEATMAP_DAYS; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const key = dateKey(d);
      result.push({
        key,
        count: countsByDate.get(key) ?? 0,
        isPast: d < today,
      });
    }
    return result;
  }, [countsByDate]);

  const weeks: typeof days[] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  return (
    <View style={styles.heatmapRow} testID="recurring-revenue-heatmap">
      {weeks.map((week, wi) => (
        <View key={wi} style={styles.heatmapColumn}>
          {week.map((day) => (
            <View
              key={day.key}
              style={[
                styles.heatmapCell,
                {
                  backgroundColor: day.isPast
                    ? theme.separator + "60"
                    : heatColor(day.count, theme),
                },
              ]}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

export function RecurringRevenueCard({ providerId }: { providerId: string | undefined }) {
  const { theme } = useTheme();

  const { data, isLoading } = useQuery<RecurringRevenueSummary>({
    queryKey: ["/api/provider", providerId, "recurring-revenue"],
    enabled: !!providerId,
  });

  if (isLoading || !data) return null;
  if (data.activeSeriesCount === 0) return null;

  const upcomingCount = data.calendar.reduce((sum, d) => sum + d.count, 0);

  return (
    <GlassCard style={styles.card} testID="card-recurring-revenue">
      <View style={styles.headerRow}>
        <View style={[styles.icon, { backgroundColor: Colors.accentLight }]}>
          <Feather name="repeat" size={18} color={Colors.accent} />
        </View>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.title}>Locked-in revenue</ThemedText>
          <ThemedText style={[styles.subtitle, { color: theme.textSecondary }]}>
            {data.activeSeriesCount} recurring{" "}
            {data.activeSeriesCount === 1 ? "client" : "clients"} booked
          </ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.amount, { color: Colors.accent }]}>
        {formatMoney(data.monthlyRevenue, { showCents: false })}
        <ThemedText style={[styles.amountUnit, { color: theme.textSecondary }]}> /mo booked</ThemedText>
      </ThemedText>

      <View style={styles.heatmapSection}>
        <ThemedText style={[styles.heatmapLabel, { color: theme.textSecondary }]}>
          Next 6 weeks · {upcomingCount} upcoming {upcomingCount === 1 ? "visit" : "visits"}
        </ThemedText>
        <ForwardHeatmap calendar={data.calendar} theme={theme} />
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: Spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: Spacing.sm,
  },
  icon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: Spacing.sm,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  amount: {
    fontSize: 28,
    fontWeight: "800",
  },
  amountUnit: {
    fontSize: 13,
    fontWeight: "500",
  },
  heatmapSection: {
    marginTop: Spacing.md,
  },
  heatmapLabel: {
    fontSize: 11,
    marginBottom: Spacing.xs,
  },
  heatmapRow: {
    flexDirection: "row",
    gap: 3,
  },
  heatmapColumn: {
    gap: 3,
  },
  heatmapCell: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
});
