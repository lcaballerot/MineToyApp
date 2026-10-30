# ADR-0001 — MineToy Voz stack (iOS and Android apps)

> 🇪🇸 [Versión en español](../es/ADR-0001-pila.md) · [Plan](PLAN.md)

Status: **proposed** (2026-10-30). Reference contract: `CoreVoz/docs/PROTOCOLO-VOZ.md` (section 7 overrides; the new
section 8 will cover the app).

## Context

Proximity voice works today in a browser tab (`voicechat.minetoy.fun`). On a phone that breaks when the player has
Minecraft Bedrock open on the same device: iOS Safari ends the microphone in the background and Chrome on Android cuts
WebRTC in the background. A native app that behaves like a phone call is needed.

Machine limits: Windows with no Mac, no local Android SDK or CocoaPods, drive C: nearly full, RAM for one heavy process
at a time. Everything native is compiled on GitHub Actions and driven with `gh`. No EAS.

## Decision

| Part | Choice | Why |
|---|---|---|
| Framework | React Native + Expo **prebuild** (CNG), TypeScript | The `motor.ts` protocol is TypeScript and is reused. Prebuild generates `ios/` and `android/` from `app.config.ts` and plugins. |
| Native folders | **Not committed**: `expo prebuild --clean` runs in CI | They can't be maintained by hand without a Mac or a local SDK. Our own native code lives in a local Expo module (`modules/voz-nativo`) and in config plugins, which are committed. |
| WebRTC | `react-native-webrtc` (with `@config-plugins/react-native-webrtc`) + `mediasoup-client` (`ReactNative106` handler) | Same mediasoup client the website uses: transports, producer and consumers port almost unchanged. |
| iOS background | `UIBackgroundModes: audio` and `AVAudioSession` `.playAndRecord` + `.mixWithOthers` + `.allowBluetooth` (+ `.defaultToSpeaker`), from `modules/voz-nativo` | The only way to guarantee the game isn't silenced. See "CallKit" below. |
| CallKit | **Optional** ("Show as a call" setting), with `react-native-callkeep` | A CallKit call activates a non-mixable audio session and usually interrupts other apps' audio, the game's included. Tested on a real device; if it interrupts or ducks Minecraft, the default is "background audio only" and CallKit stays a documented option. `voip` in `UIBackgroundModes` is declared only if CallKit is used (Apple rejects `voip` without real use). |
| Android | `microphone` foreground service (`FOREGROUND_SERVICE_MICROPHONE`, Android 14+) with the persistent "Chat de voz activo" notification and a "Colgar" button, in `modules/voz-nativo` (Kotlin) | No extra dependency for a single notification. Audio focus is not requested exclusively (no `AUDIOFOCUS_GAIN`) so the game isn't silenced. |
| Token | `expo-secure-store` (Keychain / Keystore), `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | Not copied into backups or to another device. |
| QR | `expo-camera` (barcode scanner) | Already part of Expo; no third-party QR library. |
| Links | Universal Links (iOS) and verified App Links (Android) for `voicechat.minetoy.fun` | `https://voicechat.minetoy.fun/CODE` opens the app when installed; otherwise it still opens the website. |
| Builds | GitHub Actions: `android.yml` (ubuntu-24.04, Gradle) and `ios.yml` (macos, Xcode) | No EAS, as briefed. |

## Deviations from the brief that need approval

### 1. "Reject any `Origin` on `/app/*`" locks out the app itself

Checked in the React Native source (`ReactAndroid/.../websocket/WebSocketModule.kt`): when the app sets no `Origin`
header, Android adds `origin: https://<host>` from the URL. For our URL that is `https://voicechat.minetoy.fun`, the
website's own origin. On iOS, SocketRocket adds it. JS can't remove the header, only change its value.

**Proposal:** on `/app/*` the server accepts **only** two cases: no `Origin`, or `Origin` exactly `minetoyvoz://app`
(set by the app with `new WebSocket(url, [], { headers: { Origin: "minetoyvoz://app" } })`). Any other value, including
`https://voicechat.minetoy.fun` and `null`, is rejected. A browser never sends an `Origin` with a non-web scheme (opaque
pages send `null`), so the goal holds: no web page can use `/app/*`. On top of that, `/app/senal` authenticates with a
token in the first frame, not a cookie the browser attaches on its own, so CSWSH doesn't apply in the first place. If
SocketRocket on iOS overwrites the app's `Origin`, the step 4 test will show it and it will be raised again before going on.

### 2. HRTF spatialization, spectrum visualizer and mic above 100 %

On the website these rely on Web Audio (`PannerNode`, `AnalyserNode`, `GainNode`), which React Native doesn't have.
`react-native-webrtc` plays remote audio inside the native WebRTC engine.

| Feature | Phase 1 (this delivery) | Later, if wanted |
|---|---|---|
| Distance | Per-consumer volume with `track._setVolume()` using the same linear curve up to R from the `p` frame (no server change) | Real HRTF: process remote audio natively |
| Left/right | **Not** in phase 1 (centred sound) | Same as above |
| Visualizer | Driven by your voice level (`audioLevel` from `getStats()` at ~10 Hz) | Spectrum from a native mic tap |
| Headset volume | 0–200 %, multiplying each consumer's volume | — |
| Mic volume | 0–200 % in the UI; above 100 % needs native processing of the capture. Attempted in `modules/voz-nativo`; if it doesn't make phase 1, the slider is capped at 0–100 % and that's stated | — |

The protocol doesn't change in any case: the server still sends relative positions and decides who hears whom.

## Consequences

- `ios/` and `android/` are disposable; every native change goes through `app.config.ts`, a plugin or `modules/voz-nativo`.
- Without an Apple Developer account, iOS stays at simulator builds (proves it compiles, can't be installed on an iPhone).
- Whether the game keeps its sound while voice is active **can only be verified on a real phone**; CI doesn't test it.
