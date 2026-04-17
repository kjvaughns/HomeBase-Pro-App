import { useEffect, useRef } from "react";
import * as Location from "expo-location";
import { useLocationStore } from "@/state/locationStore";

function formatLabel(
  addr: Location.LocationGeocodedAddress | undefined,
): string {
  if (!addr) return "Current location";
  const city = addr.city || addr.subregion || addr.district || "";
  const region = addr.region || "";
  if (city && region) return `${city}, ${region}`;
  return city || region || addr.country || "Current location";
}

/**
 * Detects device location once on mount (with permission). Updates the global
 * locationStore with detected coords + "City, ST" label. No-ops if the user has
 * already manually picked a location, or if permission is denied.
 */
export function useDetectUserLocation() {
  const setLocation = useLocationStore((s) => s.setLocation);
  const source = useLocationStore((s) => s.source);
  const ranRef = useRef(false);

  useEffect(() => {
    if (ranRef.current) return;
    if (source === "manual") return;
    ranRef.current = true;

    let cancelled = false;

    (async () => {
      try {
        const { status, canAskAgain } =
          await Location.getForegroundPermissionsAsync();
        let granted = status === Location.PermissionStatus.GRANTED;
        if (!granted && canAskAgain) {
          const req = await Location.requestForegroundPermissionsAsync();
          granted = req.status === Location.PermissionStatus.GRANTED;
        }
        if (!granted || cancelled) return;

        const pos = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        if (cancelled) return;

        let label = "Current location";
        let geocoded = false;
        try {
          const results = await Location.reverseGeocodeAsync({
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          });
          if (results[0]) {
            label = formatLabel(results[0]);
            geocoded = true;
          }
        } catch {
          // reverse-geocode failed (common on web); fall through
        }
        if (!geocoded) {
          label = "Detect failed — tap to set";
        }

        if (cancelled) return;
        setLocation(
          label,
          { lat: pos.coords.latitude, lng: pos.coords.longitude },
          "device",
        );
      } catch {
        // permission flow or geolocation hardware failed; leave defaults
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setLocation, source]);
}

/**
 * Forward-geocodes a free-text or preset location string and stores it as the
 * active manual location. Returns true on success, false otherwise.
 */
export async function setManualLocation(input: string): Promise<boolean> {
  const trimmed = input.trim();
  if (!trimmed) return false;
  try {
    const results = await Location.geocodeAsync(trimmed);
    const first = results[0];
    if (
      first &&
      Number.isFinite(first.latitude) &&
      Number.isFinite(first.longitude)
    ) {
      useLocationStore
        .getState()
        .setLocation(
          trimmed,
          { lat: first.latitude, lng: first.longitude },
          "manual",
        );
      return true;
    }
  } catch {
    // fall through
  }
  // No coords resolved — still store the label so the chip updates, but clear coords
  useLocationStore.getState().setLocation(trimmed, null, "manual");
  return false;
}
