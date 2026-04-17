import { create } from "zustand";

export type LocationSource = "device" | "manual" | "default";

interface LocationState {
  label: string;
  coords: { lat: number; lng: number } | null;
  source: LocationSource;
  setLocation: (
    label: string,
    coords: { lat: number; lng: number } | null,
    source: LocationSource,
  ) => void;
}

export const useLocationStore = create<LocationState>((set) => ({
  label: "Set location",
  coords: null,
  source: "default",
  setLocation: (label, coords, source) => set({ label, coords, source }),
}));
