---
name: expo-audio + expo-file-system v55 recording API
description: Correct API shapes for mic recording and base64 upload in Expo SDK 55 (not the legacy expo-av / readAsStringAsync APIs).
---

Expo SDK 55 replaced `expo-av` recording with `expo-audio`, and `expo-file-system` got a new class-based API. Both are easy to get wrong by reaching for older/legacy signatures.

- `expo-audio`: `useAudioRecorder(RecordingPresets.HIGH_QUALITY)` + `useAudioRecorderState(recorder)` for duration/status; `AudioModule.requestRecordingPermissionsAsync()` for mic permission; `setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true })` before recording. Start/stop via `recorder.prepareToRecordAsync()` / `recorder.record()` / `await recorder.stop()`, then read `recorder.uri`.
- `expo-file-system` v55: use `new File(uri).base64()` to get base64 content — the legacy `FileSystem.readAsStringAsync(uri, { encoding: 'base64' })` free-function API is gone/deprecated.

**Why:** these are recent breaking API changes; TypeScript will simply fail to resolve the old imports/signatures, and it's not obvious from React Native general knowledge which API generation is current for a given Expo SDK version.

**How to apply:** when adding audio recording or base64 file reads in an Expo 55+ app, check the installed `expo-audio`/`expo-file-system` versions and use the class-based/hook APIs above rather than remembered `expo-av`/`FileSystem.readAsStringAsync` patterns.
