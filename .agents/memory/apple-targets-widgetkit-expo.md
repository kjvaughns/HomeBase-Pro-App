---
name: WidgetKit via @bacons/apple-targets in Expo (no bare eject)
description: How to add native iOS home/lock-screen widgets to an Expo-managed app without ejecting, and how it behaves in environments without Xcode.
---

Use `@bacons/apple-targets` to add a WidgetKit extension target to an Expo-managed app: a `targets/<name>/expo-target.config.js` file plus plain Swift files define the extension, and the plugin wires it into the generated Xcode project on `expo prebuild`. No bare ejection needed.

`ExtensionStorage` (from the package's JS side) is the bridge for sharing data between the RN app and the widget via an App Group's UserDefaults (`set/get/remove`, `ExtensionStorage.reloadWidget()`). Its JS implementation falls back to silent no-ops when the native module isn't present, so it's safe to import and call unconditionally — no need to guard every call behind `Platform.OS === "ios"` checks for crash-safety (still worth gating to avoid pointless work on other platforms).

**Why:** Confirmed by reading the package source directly — `ExtensionStorageModule` is optional-chained and defaults to a no-op object if `expo.modules.ExtensionStorage` is undefined (e.g. non-iOS, or native module not yet compiled/linked).

**How to apply:** When wiring app data into a widget, write to shared storage from the RN side on data changes, and independently give the widget's own Swift `TimelineProvider` a network fallback (e.g. polling a small public/token-guarded API endpoint) so it can refresh even when the app hasn't been opened recently.

**Environment limitation:** In a Linux/no-Xcode environment, none of this can be built or run — `expo prebuild -p ios`, opening Xcode, and EAS iOS builds are unavailable. Expo will print `ios.appleTeamId` warnings at dev-server start once the plugin is added; this is expected, not a bug. Treat the Swift/plugin code as best-effort scaffolding that requires a real Xcode environment to validate.
