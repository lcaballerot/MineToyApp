# ADR-0001 — MineToy app stack (iOS and Android)

> 🇪🇸 [Versión en español](../es/ADR-0001-pila.md) · [Plan](PLAN.md)

Status: **accepted** (2026-10-30, user's answers). Voice contract: `CoreVoz/docs/PROTOCOLO-VOZ.md` (section 7 overrides;
the new section 8 will cover the app).

## Context

The user wants **a single "MineToy" app** with everything on the website (store, votes, ranking, profile…) plus voice
chat. The Next website already does all of that; the one thing a mobile browser can't do is voice while Minecraft
Bedrock is open on the same phone: iOS Safari ends the microphone in the background and Chrome on Android cuts WebRTC.

Machine limits: Windows with no Mac, no local Android SDK or CocoaPods, drive C: nearly full, RAM for one heavy process
at a time. Everything native is compiled on GitHub Actions and driven with `gh`. No EAS.

## User decisions (2026-10-30)

| Topic | Decision |
|---|---|
| Name and identifier | "MineToy", `fun.minetoy.app` on iOS and Android; repo `lcaballerot/MineToyApp` |
| Content | The Next website inside the app (WebView) + voice as the native part |
| Purchases | **Apple and Google payments** (In-App Purchase / Play Billing) wired to Core-Web deliveries |
| Apple Developer | Will sign up: until then, iOS is simulator only |
| Android | APK on the Release and also Google Play |
| `Origin` on `/app/*` | Absent or exactly `minetoyvoz://app` (deviation 1, approved) |

## Technical decision

| Part | Choice | Why |
|---|---|---|
| Framework | React Native + Expo **prebuild** (CNG), TypeScript | The `motor.ts` protocol is TypeScript and is reused. |
| Native folders | **Not committed**: `expo prebuild --clean` runs in CI | Can't be maintained by hand without a Mac or local SDK. Our native code lives in `modules/voz-nativo` (local Expo module) and config plugins. |
| Website | `react-native-webview` with `store.minetoy.fun` and `vote.minetoy.fun`, native tabs at the bottom (Store · Vote · Voice · Profile) | Website changes show up in the app without shipping a version. Own domains open inside; anything else in the system browser. |
| Web ↔ app bridge | `postMessage` with a strict schema, accepted only from MineToy's exact origins; the website detects the app by its own parameter or header and swaps the pay button for "Buy with Apple/Google" | The website stays the source of truth for catalogue and cart. |
| Voice | Native screen (not the WebView): `react-native-webrtc` + `mediasoup-client` (`ReactNative106`) over `/app/senal` | The part that has to stay alive in the background. |
| iOS background | `UIBackgroundModes: audio`, `AVAudioSession` `.playAndRecord` + `.mixWithOthers` + `.allowBluetooth` (+ `.defaultToSpeaker`) | Don't silence the game. |
| CallKit | **Optional** ("Show as a call"), `react-native-callkeep` | A CallKit call doesn't mix and usually interrupts other apps' audio. Decided by a test on a real iPhone. `voip` is declared only if CallKit is used. |
| Android | `microphone` foreground service (Android 14+) with the "Chat de voz activo" notification and "Colgar", in `modules/voz-nativo` | No exclusive audio focus request. |
| Purchases | `react-native-iap` (StoreKit 2 and Play Billing 7+) | One JS API for both stores. |
| Voice token | `expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | Not carried in backups. |
| QR | `expo-camera` | Already part of Expo. |
| Links | Universal Links and verified App Links for `voicechat.minetoy.fun` (later `store.`) | `https://voicechat.minetoy.fun/CODE` opens the app when installed. |
| Builds | `android.yml` (ubuntu-24.04) and `ios.yml` (macos) on GitHub Actions | No EAS. |

## Apple and Google purchases (website server)

The website already has a common gateway interface (`src/lib/payments/types.ts`, `PaymentGateway`) and a single point that
marks an order paid (`finalize.ts`, which re-checks amount and currency before delivering). Apple and Google come in as
**two new redirect-less gateways**:

1. The app asks the website to create the order (`MT-XXXXXXXX`) like the checkout does, with gateway `apple` or `google`.
2. The app buys the store product with the order attached: `appAccountToken` = a UUID derived from the order (Apple),
   `obfuscatedAccountId` = the order reference (Google).
3. The app sends the server the signed transaction (Apple, StoreKit 2 JWS) or the `purchaseToken` (Google). The server
   **verifies it itself**: Apple with Apple's certificate chain and the App Store Server API; Google with the Google Play
   Developer API (service account). It checks product, attached order, environment (sandbox/production) and that the
   transaction hasn't been used before.
4. `finalize.ts` marks it paid and queues the Core-Web delivery like any other.
5. Refunds and revocations: App Store Server Notifications V2 and Google Real-time Developer Notifications (Pub/Sub) as
   webhooks. Google also requires **acknowledging** the purchase within 3 days or it refunds it.

Differences from the other gateways:

- **Price:** set by the store per country, not by the website. Every website product sold in the app needs its matching
  product in App Store Connect and Play Console (created by the user, or by API once accounts exist). The `finalize.ts`
  re-check compares **product and transaction id**, not the euro amount.
- **Product type:** ranks, keys and kits belong to the Minecraft account, not the Apple ID, so they are **consumables**
  (can be bought for another player or repeated); no "restore purchases".
- **Coupons, promotions and the multi-item cart** don't exist in the stores: in the app you buy one product at a time.
- **Fee:** 15 % (Apple's and Google's small-business programs, which the user applies for) or 30 %.

## Deviations from the original brief

### 1. `Origin` on `/app/*` (approved)

React Native adds `origin: https://<host>` to every WebSocket that has none (checked in
`ReactAndroid/.../websocket/WebSocketModule.kt`; on iOS SocketRocket does it), and for our URL that's the website's origin.
On `/app/*` the server accepts **only** an absent `Origin` or exactly `minetoyvoz://app`, set by the app with
`new WebSocket(url, [], { headers: { Origin: "minetoyvoz://app" } })`. No browser sends an `Origin` with that scheme. If
SocketRocket overwrites the value on iOS, the step 4 test will show it and it will be raised again.

### 2. Audio without Web Audio

`PannerNode`, `AnalyserNode` and `GainNode` don't exist in React Native; remote audio plays inside native WebRTC.

| Feature | Phase 1 | Later |
|---|---|---|
| Distance | Per-consumer volume with `track._setVolume()`, same linear curve up to R from the `p` frame | HRTF with native processing |
| Left/right | No (centred) | Same |
| Visualizer | From your voice level (`audioLevel` from `getStats()`, ~10 Hz) | Spectrum from a native tap |
| Headset 0–200 % | Multiplying each consumer's volume | — |
| Mic 0–200 % | Above 100 % needs native processing of the capture; if it doesn't make phase 1, it's capped at 0–100 % and that's stated | — |

The server doesn't change for this.

## Store risks

| Risk | Mitigation |
|---|---|
| Apple 4.2 (an app that only wraps a website) | Native voice, QR and native tabs are real app functionality |
| Passkey sign-in inside the WebView (the website requires it for staff) | iOS: `webcredentials:` associated domain; Android: WebView with WebAuthn enabled. If it doesn't work, the admin panel opens in the browser |
| Purchase review | Sandbox test account and a test player for the reviewer |
| The website sells something in the app through another gateway | In app mode, the other gateways' buttons aren't shown |

## Consequences

- `ios/` and `android/` are disposable.
- Without Apple and Google accounts, products can't be created and purchases can't be tested: the purchase part is built
  and tested against both sandboxes once they exist.
- Whether the game keeps sounding with voice active is only verified on a real phone.
