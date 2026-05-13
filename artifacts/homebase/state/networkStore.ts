import { create } from "zustand";
import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";

interface NetworkState {
  isOnline: boolean;
  lastChangedAt: number;
  setOnline: (online: boolean) => void;
}

export const useNetworkStore = create<NetworkState>((set, get) => ({
  isOnline: true,
  lastChangedAt: Date.now(),
  setOnline: (online: boolean) => {
    if (get().isOnline === online) return;
    set({ isOnline: online, lastChangedAt: Date.now() });
  },
}));

function deriveOnline(state: NetInfoState): boolean {
  if (state.isConnected === false) return false;
  if (state.isInternetReachable === false) return false;
  return true;
}

let initialized = false;

export function initNetworkStore() {
  if (initialized) return;
  initialized = true;
  const apply = (state: NetInfoState) => {
    useNetworkStore.getState().setOnline(deriveOnline(state));
  };
  NetInfo.fetch().then(apply).catch(() => {});
  NetInfo.addEventListener(apply);
}
