import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as Haptics from "expo-haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useMutation } from "@tanstack/react-query";

import { ThemedText } from "@/components/ThemedText";
import { GlassCard } from "@/components/GlassCard";
import { useTheme } from "@/hooks/useTheme";
import { BorderRadius, Colors, Spacing, Typography } from "@/constants/theme";
import { apiRequest } from "@/lib/query-client";

// Map is native-only; on web we render a simpler list-only experience and
// hand-off navigation to the external Google Maps URL. Importing
// react-native-maps on web pulls in iOS-only natives and crashes Metro.
let MapViewModule: typeof import("react-native-maps") | null = null;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  MapViewModule = require("react-native-maps") as typeof import("react-native-maps");
}

interface RouteStop {
  jobId: string;
  title: string;
  scheduledTime: string | null;
  clientName: string | null;
  lat: number;
  lng: number;
  address: string;
  etaMinutesFromPrev: number;
  distanceMilesFromPrev: number;
}

interface OptimizeResponse {
  origin: { lat: number; lng: number; address: string } | null;
  stops: RouteStop[];
  totalMinutes: number;
  totalMiles: number;
  driveTimeSource: "google" | "haversine";
  missing: { jobId: string; title: string; address: string }[];
}

interface Props {
  providerId: string;
  date: Date;
  onJobPress: (jobId: string) => void;
}

function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDuration(min: number): string {
  if (!Number.isFinite(min) || min <= 0) return "—";
  const total = Math.round(min);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

function formatMiles(mi: number): string {
  if (!Number.isFinite(mi) || mi <= 0) return "—";
  return mi < 10 ? `${mi.toFixed(1)} mi` : `${Math.round(mi)} mi`;
}

function formatTime(time: string | null): string {
  if (!time) return "";
  const [hStr, mStr] = time.split(":");
  const h = parseInt(hStr, 10);
  const m = mStr || "00";
  const ampm = h >= 12 ? "PM" : "AM";
  const display = h % 12 || 12;
  return `${display}:${m} ${ampm}`;
}

/**
 * Build a multi-waypoint navigation URL for the platform's preferred map app.
 * Apple Maps takes `+to:` separators; Google Maps takes `&waypoints=` (and is
 * also used as the universal web/Android fallback).
 */
function buildNavUrl(
  origin: { lat: number; lng: number },
  stops: { lat: number; lng: number }[],
): string {
  if (stops.length === 0) return "";
  const final = stops[stops.length - 1];
  const middle = stops.slice(0, -1);
  if (Platform.OS === "ios") {
    const saddr = `${origin.lat},${origin.lng}`;
    const daddrs = [
      ...middle.map((s) => `${s.lat},${s.lng}`),
      `${final.lat},${final.lng}`,
    ].join("+to:");
    return `https://maps.apple.com/?saddr=${saddr}&daddr=${daddrs}&dirflg=d`;
  }
  // Google Maps universal URL — works on Android, web, and as iOS fallback.
  const params = new URLSearchParams({
    api: "1",
    travelmode: "driving",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${final.lat},${final.lng}`,
  });
  if (middle.length > 0) {
    params.set(
      "waypoints",
      middle.map((s) => `${s.lat},${s.lng}`).join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

const STORAGE_KEY_PREFIX = "@homebase/route-order/";

export function RouteView({ providerId, date, onJobPress }: Props) {
  const { theme } = useTheme();
  const dateKey = useMemo(() => ymd(date), [date]);

  const [origin, setOrigin] = useState<
    | { kind: "coords"; lat: number; lng: number; address: string }
    | { kind: "address"; address: string }
    | null
  >(null);
  const [originError, setOriginError] = useState<string | null>(null);
  const [originAddressInput, setOriginAddressInput] = useState("");
  const [permissionState, setPermissionState] = useState<
    "checking" | "granted" | "denied" | "unsupported"
  >("checking");
  const [route, setRoute] = useState<OptimizeResponse | null>(null);
  const [manualOrder, setManualOrder] = useState<string[] | undefined>(
    undefined,
  );

  const optimizeMutation = useMutation({
    mutationFn: (body: {
      date: string;
      originLat?: number;
      originLng?: number;
      originAddress?: string;
      order?: string[];
    }) =>
      apiRequest(
        "POST",
        `/api/provider/${providerId}/route/optimize`,
        body,
      ).then((r) => r.json() as Promise<OptimizeResponse>),
    onSuccess: (data) => {
      setRoute(data);
    },
  });

  // Load any persisted manual order for this day. Server is source of truth
  // (survives reinstall / device changes); AsyncStorage is an offline cache
  // that we fall back to when the API is unreachable.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await apiRequest(
          "GET",
          `/api/provider/${providerId}/route/order/${dateKey}`,
        );
        const data = (await r.json()) as { order: string[] | null };
        if (cancelled) return;
        if (data.order && Array.isArray(data.order)) {
          setManualOrder(data.order);
          AsyncStorage.setItem(
            STORAGE_KEY_PREFIX + dateKey,
            JSON.stringify(data.order),
          ).catch(() => {});
        } else {
          setManualOrder(undefined);
        }
        return;
      } catch {
        // Server unavailable — fall through to AsyncStorage cache.
      }
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY_PREFIX + dateKey);
        if (cancelled) return;
        if (raw) {
          const parsed = JSON.parse(raw) as string[];
          if (Array.isArray(parsed)) setManualOrder(parsed);
        } else {
          setManualOrder(undefined);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dateKey, providerId]);

  // Try foreground location once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (Platform.OS === "web") {
        setPermissionState("unsupported");
        return;
      }
      try {
        const { status, canAskAgain } =
          await Location.getForegroundPermissionsAsync();
        let granted = status === Location.PermissionStatus.GRANTED;
        if (!granted && canAskAgain) {
          const r = await Location.requestForegroundPermissionsAsync();
          granted = r.status === Location.PermissionStatus.GRANTED;
        }
        if (cancelled) return;
        if (!granted) {
          setPermissionState("denied");
          return;
        }
        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;
        setOrigin({
          kind: "coords",
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          address: "Current location",
        });
        setPermissionState("granted");
      } catch (err) {
        if (cancelled) return;
        setOriginError("Could not detect your location.");
        setPermissionState("denied");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Re-fetch route whenever origin or manual order changes.
  useEffect(() => {
    if (!providerId) return;
    const body: {
      date: string;
      originLat?: number;
      originLng?: number;
      originAddress?: string;
      order?: string[];
    } = { date: dateKey, order: manualOrder };
    if (origin?.kind === "coords") {
      body.originLat = origin.lat;
      body.originLng = origin.lng;
      body.originAddress = origin.address;
    } else if (origin?.kind === "address") {
      body.originAddress = origin.address;
    }
    optimizeMutation.mutate(body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    providerId,
    dateKey,
    origin?.kind,
    origin?.kind === "coords" ? origin.lat : undefined,
    origin?.kind === "coords" ? origin.lng : undefined,
    origin?.kind === "address" ? origin.address : undefined,
    manualOrder?.join(","),
  ]);

  const persistOrder = useCallback(
    (order: string[]) => {
      setManualOrder(order);
      AsyncStorage.setItem(
        STORAGE_KEY_PREFIX + dateKey,
        JSON.stringify(order),
      ).catch(() => {});
      apiRequest(
        "PUT",
        `/api/provider/${providerId}/route/order/${dateKey}`,
        { order },
      ).catch(() => {
        // Queued in AsyncStorage; server will catch up on next reorder.
      });
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    },
    [dateKey, providerId],
  );

  const moveStop = useCallback(
    (jobId: string, direction: -1 | 1) => {
      if (!route) return;
      const ids = route.stops.map((s) => s.jobId);
      const idx = ids.indexOf(jobId);
      const target = idx + direction;
      if (idx < 0 || target < 0 || target >= ids.length) return;
      const next = ids.slice();
      const [moved] = next.splice(idx, 1);
      next.splice(target, 0, moved);
      persistOrder(next);
    },
    [route, persistOrder],
  );

  const resetOrder = useCallback(() => {
    setManualOrder(undefined);
    AsyncStorage.removeItem(STORAGE_KEY_PREFIX + dateKey).catch(() => {});
    apiRequest(
      "PUT",
      `/api/provider/${providerId}/route/order/${dateKey}`,
      { clear: true },
    ).catch(() => {});
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [dateKey, providerId]);

  const handleStartRoute = useCallback(async () => {
    if (!route || !route.origin || route.stops.length === 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const url = buildNavUrl(route.origin, route.stops);
    try {
      await Linking.openURL(url);
    } catch {
      /* unsupported scheme — ignore */
    }
  }, [route]);

  const handleApplyManualAddress = useCallback(() => {
    const addr = originAddressInput.trim();
    if (addr.length < 3) return;
    // Setting origin triggers the optimize effect with originAddress only,
    // so the server geocodes the address (no (0,0) sentinel).
    setOrigin({ kind: "address", address: addr });
  }, [originAddressInput]);

  const stops = route?.stops ?? [];
  const isLoading = optimizeMutation.isPending && !route;
  const isEmpty = !isLoading && stops.length === 0;
  const missingCount = route?.missing?.length ?? 0;

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      {/* Permission / origin picker */}
      {permissionState !== "granted" && (
        <GlassCard style={styles.originCard}>
          <View style={styles.originHeader}>
            <Feather name="map-pin" size={16} color={Colors.accent} />
            <ThemedText style={styles.originTitle}>Starting point</ThemedText>
          </View>
          <ThemedText
            style={[styles.originHelp, { color: theme.textSecondary }]}
          >
            {permissionState === "denied"
              ? "Location is off. Type a starting address to plan your route."
              : permissionState === "unsupported"
                ? "Set a starting address — location isn't available on web."
                : "Detecting your location…"}
          </ThemedText>
          <View style={styles.originRow}>
            <TextInput
              testID="input-origin-address"
              value={originAddressInput}
              onChangeText={setOriginAddressInput}
              placeholder="123 Main St, City"
              placeholderTextColor={theme.textTertiary}
              style={[
                styles.originInput,
                {
                  backgroundColor: theme.backgroundSecondary,
                  color: theme.text,
                },
              ]}
              autoCorrect={false}
              autoCapitalize="words"
            />
            <Pressable
              testID="button-apply-origin"
              onPress={handleApplyManualAddress}
              style={[styles.originBtn, { backgroundColor: Colors.accent }]}
              disabled={originAddressInput.trim().length < 3}
            >
              <ThemedText style={styles.originBtnText}>Use</ThemedText>
            </Pressable>
          </View>
          {originError && (
            <ThemedText style={[styles.originHelp, { color: Colors.error }]}>
              {originError}
            </ThemedText>
          )}
        </GlassCard>
      )}

      {/* Map */}
      {route && route.origin && stops.length > 0 ? (
        Platform.OS === "web" ? (
          <WebRouteMap origin={route.origin} stops={stops} />
        ) : (
          <NativeRouteMap origin={route.origin} stops={stops} />
        )
      ) : null}

      {/* Summary */}
      {route && stops.length > 0 ? (
        <GlassCard style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <ThemedText
                style={[styles.summaryLabel, { color: theme.textTertiary }]}
              >
                Stops
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {stops.length}
              </ThemedText>
            </View>
            <View
              style={[
                styles.summaryDivider,
                { backgroundColor: theme.separator },
              ]}
            />
            <View style={styles.summaryItem}>
              <ThemedText
                style={[styles.summaryLabel, { color: theme.textTertiary }]}
              >
                Drive time
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {formatDuration(route.totalMinutes)}
              </ThemedText>
            </View>
            <View
              style={[
                styles.summaryDivider,
                { backgroundColor: theme.separator },
              ]}
            />
            <View style={styles.summaryItem}>
              <ThemedText
                style={[styles.summaryLabel, { color: theme.textTertiary }]}
              >
                Distance
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {formatMiles(route.totalMiles)}
              </ThemedText>
            </View>
          </View>
          {route.driveTimeSource === "haversine" ? (
            <ThemedText
              style={[styles.summaryNote, { color: theme.textTertiary }]}
            >
              Drive times are estimates — connect Google Maps for live data.
            </ThemedText>
          ) : null}
          <Pressable
            testID="button-start-route"
            onPress={handleStartRoute}
            style={[styles.startBtn, { backgroundColor: Colors.accent }]}
          >
            <Feather name="navigation" size={16} color="#FFFFFF" />
            <ThemedText style={styles.startBtnText}>
              Start route in {Platform.OS === "ios" ? "Apple Maps" : "Maps"}
            </ThemedText>
          </Pressable>
        </GlassCard>
      ) : null}

      {/* Stops list */}
      {isLoading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={Colors.accent} />
        </View>
      ) : null}

      {isEmpty ? (
        <GlassCard style={styles.emptyCard}>
          <Feather name="map" size={28} color={theme.textTertiary} />
          <ThemedText style={[styles.emptyText, { color: theme.textSecondary }]}>
            No jobs to route
          </ThemedText>
          <ThemedText
            style={[styles.emptySubtext, { color: theme.textTertiary }]}
          >
            Add jobs with addresses to see your driving route.
          </ThemedText>
        </GlassCard>
      ) : null}

      {stops.length > 0 ? (
        <View style={styles.stopsHeaderRow}>
          <ThemedText
            style={[styles.stopsHeader, { color: theme.textTertiary }]}
          >
            STOPS
          </ThemedText>
          {manualOrder ? (
            <Pressable
              testID="button-reset-order"
              onPress={resetOrder}
              hitSlop={8}
            >
              <ThemedText style={[styles.linkText, { color: Colors.accent }]}>
                Re-optimize
              </ThemedText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {stops.map((stop, idx) => (
        <GlassCard key={stop.jobId} style={styles.stopCard}>
          <Pressable
            onPress={() => onJobPress(stop.jobId)}
            style={styles.stopRow}
            testID={`stop-${stop.jobId}`}
          >
            <View
              style={[
                styles.stopBadge,
                { backgroundColor: Colors.accent },
              ]}
            >
              <ThemedText style={styles.stopBadgeText}>{idx + 1}</ThemedText>
            </View>
            <View style={styles.stopBody}>
              <ThemedText style={styles.stopTitle} numberOfLines={1}>
                {stop.title}
              </ThemedText>
              <ThemedText
                style={[styles.stopMeta, { color: theme.textSecondary }]}
                numberOfLines={1}
              >
                {[
                  stop.clientName,
                  stop.scheduledTime ? formatTime(stop.scheduledTime) : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Stop"}
              </ThemedText>
              <ThemedText
                style={[styles.stopMeta, { color: theme.textTertiary }]}
                numberOfLines={1}
              >
                {stop.address}
              </ThemedText>
              <ThemedText
                style={[styles.stopLeg, { color: theme.textTertiary }]}
              >
                {idx === 0 ? "From start · " : "From previous · "}
                {formatDuration(stop.etaMinutesFromPrev)} ·{" "}
                {formatMiles(stop.distanceMilesFromPrev)}
              </ThemedText>
            </View>
            <View style={styles.stopReorder}>
              <Pressable
                testID={`button-stop-up-${stop.jobId}`}
                onPress={() => moveStop(stop.jobId, -1)}
                disabled={idx === 0}
                hitSlop={6}
                style={styles.reorderBtn}
              >
                <Feather
                  name="chevron-up"
                  size={18}
                  color={idx === 0 ? theme.textTertiary : theme.textSecondary}
                />
              </Pressable>
              <Pressable
                testID={`button-stop-down-${stop.jobId}`}
                onPress={() => moveStop(stop.jobId, 1)}
                disabled={idx === stops.length - 1}
                hitSlop={6}
                style={styles.reorderBtn}
              >
                <Feather
                  name="chevron-down"
                  size={18}
                  color={
                    idx === stops.length - 1
                      ? theme.textTertiary
                      : theme.textSecondary
                  }
                />
              </Pressable>
            </View>
          </Pressable>
        </GlassCard>
      ))}

      {missingCount > 0 ? (
        <GlassCard style={styles.missingCard}>
          <Feather name="alert-circle" size={16} color={Colors.warning} />
          <ThemedText
            style={[styles.missingText, { color: theme.textSecondary }]}
          >
            {missingCount === 1
              ? "1 job is missing an address and isn't on the route."
              : `${missingCount} jobs are missing addresses and aren't on the route.`}
          </ThemedText>
        </GlassCard>
      ) : null}
    </ScrollView>
  );
}

// ─── Native map (extracted so the import is conditional) ─────────────────────

interface MapProps {
  origin: { lat: number; lng: number };
  stops: { jobId: string; title: string; lat: number; lng: number }[];
}

// Web fallback: embedded Google Maps Directions iframe (no API key required
// for the public /maps/embed/v1/dir endpoint via the basic /maps/dir/ form
// in an iframe). Uses the same multi-waypoint URL shape as Start Route.
function WebRouteMap({ origin, stops }: MapProps) {
  const points = [
    `${origin.lat},${origin.lng}`,
    ...stops.map((s) => `${s.lat},${s.lng}`),
  ].join("/");
  const src = `https://www.google.com/maps/dir/${points}`;
  return (
    <View style={styles.mapWrap}>
      {React.createElement("iframe", {
        src,
        style: { border: 0, width: "100%", height: "100%" },
        loading: "lazy",
        referrerPolicy: "no-referrer-when-downgrade",
        title: "Today's route",
      })}
    </View>
  );
}

function NativeRouteMap({ origin, stops }: MapProps) {
  if (!MapViewModule) return null;
  const MapView = MapViewModule.default;
  const { Marker, Polyline } = MapViewModule;

  const allLats = [origin.lat, ...stops.map((s) => s.lat)];
  const allLngs = [origin.lng, ...stops.map((s) => s.lng)];
  const minLat = Math.min(...allLats);
  const maxLat = Math.max(...allLats);
  const minLng = Math.min(...allLngs);
  const maxLng = Math.max(...allLngs);
  const latDelta = Math.max(0.02, (maxLat - minLat) * 1.6);
  const lngDelta = Math.max(0.02, (maxLng - minLng) * 1.6);

  return (
    <View style={styles.mapWrap}>
      <MapView
        style={styles.map}
        initialRegion={{
          latitude: (minLat + maxLat) / 2,
          longitude: (minLng + maxLng) / 2,
          latitudeDelta: latDelta,
          longitudeDelta: lngDelta,
        }}
      >
        <Marker
          coordinate={{ latitude: origin.lat, longitude: origin.lng }}
          title="Start"
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={[styles.numMarker, styles.startMarker]}>
            <Feather name="navigation" size={12} color="#FFFFFF" />
          </View>
        </Marker>
        {stops.map((s, i) => (
          <Marker
            key={s.jobId}
            coordinate={{ latitude: s.lat, longitude: s.lng }}
            title={`${i + 1}. ${s.title}`}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.numMarker}>
              <ThemedText style={styles.numMarkerText}>{i + 1}</ThemedText>
            </View>
          </Marker>
        ))}
        <Polyline
          coordinates={[
            { latitude: origin.lat, longitude: origin.lng },
            ...stops.map((s) => ({ latitude: s.lat, longitude: s.lng })),
          ]}
          strokeColor={Colors.accent}
          strokeWidth={3}
        />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  originCard: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  originHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.xs,
  },
  originTitle: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  originHelp: {
    ...Typography.caption1,
  },
  originRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  originInput: {
    flex: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
    ...Typography.subhead,
  },
  originBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
  originBtnText: {
    ...Typography.subhead,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  mapWrap: {
    height: 240,
    borderRadius: BorderRadius.lg,
    overflow: "hidden",
  },
  map: { flex: 1 },
  numMarker: {
    minWidth: 26,
    height: 26,
    paddingHorizontal: 6,
    borderRadius: 13,
    backgroundColor: Colors.accent,
    borderWidth: 2,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  startMarker: {
    backgroundColor: "#1F1F1F",
  },
  numMarkerText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 16,
  },
  summaryCard: {
    padding: Spacing.md,
    gap: Spacing.md,
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryItem: { flex: 1, alignItems: "center" },
  summaryLabel: {
    ...Typography.caption2,
    fontWeight: "700",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  summaryValue: {
    ...Typography.title3,
    fontWeight: "700",
  },
  summaryDivider: {
    width: StyleSheet.hairlineWidth,
    height: 28,
  },
  summaryNote: {
    ...Typography.caption1,
    textAlign: "center",
  },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  startBtnText: {
    ...Typography.subhead,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  loadingBox: {
    padding: Spacing.lg,
    alignItems: "center",
  },
  emptyCard: {
    padding: Spacing.lg,
    alignItems: "center",
    gap: Spacing.sm,
  },
  emptyText: {
    ...Typography.subhead,
    fontWeight: "600",
  },
  emptySubtext: {
    ...Typography.caption1,
    textAlign: "center",
  },
  stopsHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: Spacing.xs,
  },
  stopsHeader: {
    ...Typography.caption2,
    fontWeight: "700",
    letterSpacing: 0.6,
  },
  linkText: {
    ...Typography.caption1,
    fontWeight: "700",
  },
  stopCard: {
    padding: 0,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing.md,
    gap: Spacing.md,
  },
  stopBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stopBadgeText: {
    ...Typography.subhead,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  stopBody: { flex: 1, gap: 2 },
  stopTitle: {
    ...Typography.subhead,
    fontWeight: "700",
  },
  stopMeta: {
    ...Typography.caption1,
  },
  stopLeg: {
    ...Typography.caption2,
    marginTop: 2,
  },
  stopReorder: {
    gap: Spacing.xs,
  },
  reorderBtn: {
    padding: 2,
  },
  missingCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  missingText: {
    ...Typography.caption1,
    flex: 1,
  },
});
