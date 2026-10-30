# Plan — MineToy app (iOS and Android)

> 🇪🇸 [Versión en español](../es/PLAN.md) · [ADR-0001](ADR-0001-stack.md)

Date: 2026-10-30. A "MineToy" app with the MineToy website inside and native voice chat that stays alive while
Minecraft Bedrock is open on the same phone.

## What already exists and isn't rebuilt

| Part | Where |
|---|---|
| Voice contract | `CoreVoz/docs/PROTOCOLO-VOZ.md` (section 7 overrides) |
| voz-control (mediasoup 3.19.3) | `web/voz/` in `lcaballerot/MineToyWeb`, in production on web split 68f5842c |
| Voice client to port | `web/src/components/voz/motor.ts` |
| Store, votes, ranking | The Next website (`store.minetoy.fun`, `vote.minetoy.fun`) |
| Payment gateways | `web/src/lib/payments/` (`PaymentGateway`, `finalize.ts`) |
| Game | Core-Voz (`/vc`), Core-Web (deliveries) |

## Steps

Each step ends with a report: commits, CI runs, and what was verified on a real device and what wasn't.

### 1. ADR, plan and questions — done

### 2. Voice server: a separate path for the app (`web/voz`, local commit; push and restart = explicit "sí")

| Route | What it does |
|---|---|
| `POST /api/app/vincular` | `{codigo}` or `{token}` + `dispositivo: {plataforma: "ios"\|"android", modelo?}` (≤ 64 chars). Redeems the same pending request as the website. Returns `{ok, token, idioma}`: 32 bytes base64url, only its SHA-256 in `${DATA_DIR}/voz/apps.json` (600, atomic write), 400 days sliding on every connection. `Cache-Control: no-store`. |
| `WS /app/senal` | First frame `{"t":"auth","token":"…"}` within 5 s or close 4401. After that, identical to `/senal`. |
| `GET /.well-known/apple-app-site-association` · `/.well-known/assetlinks.json` | Exact `application/json`, no CORS, no redirects, never proxied to Next. |

Rules:

- `Origin` on `/app/*` and `/api/app/*`: only absent or `minetoyvoz://app`.
- Same limits as the browser, **shared with it** (same attempt counters per IP and per code).
- One voice session per UUID, web or app; the newest closes the previous one with 4409. The app doesn't reconnect on its
  own after 4409: "In use on another device" + "Use here".
- Linking the app revokes that UUID's previous app tokens. It doesn't touch browser cookies, nor the other way round.
  `/vc desvincular` revokes both. Revoked token → 4401 "revocada" → the app goes back to linking.
- `vinculado` in the `enlace` frame also counts app tokens.
- Mic, headset, range, staff mute and vanish: exactly what the server already enforces.
- New tests in `npm run voz:test`; `PROTOCOLO-VOZ.md` section 8; new rows in the `web/voz/README.md` threat table.
- Data for the well-known files: Apple Team ID (once the account exists) and the SHA-256 fingerprint of the Android
  signing certificate (taken from the step 3 keystore).

### 3. App skeleton and green CI with a "hello" screen

- Repo `lcaballerot/MineToyApp` per `GUIA-ESTILOS-REPOSITORIOS.md`: es/en READMEs, `CHANGELOG.md`, `docs/es` + `docs/en`,
  CI-generated build badge in `.github/badges/`, release by tag.
- Expo at the latest stable SDK at that point; exact versions.
- `android.yml`: `npm ci`, `expo prebuild --platform android --clean`, signed `./gradlew assembleRelease` (keystore via
  `gh secret set`, never in the repo), APK as an artifact and on each tag's Release; AAB for Play once the account exists.
- `ios.yml`: `expo prebuild --platform ios --clean`, `pod install`, simulator `xcodebuild`; with the account, a signed IPA
  (App Store Connect API key in secrets). TestFlight only with approval.
- Working copy at `E:\MineToyApp`. Locally only `npm install`, `tsc` and `eslint`.

### 4. End-to-end voice from the Android APK

- `src/voz/` = port of `motor.ts` without the DOM, `mediasoup-client` with `ReactNative106`, reconnect on network changes
  (`@react-native-community/netinfo`), Wi-Fi↔mobile and backgrounding.
- Phase 1 audio (ADR, deviation 2) and the Android foreground service.
- Test on a real phone with Bedrock open.

### 5. The website inside the app

- Native tabs: Store · Vote · Voice · Profile. WebView only for MineToy domains; everything else in the browser.
- On the website (`MineToyWeb`): "app mode" (detected by our own parameter or header), no duplicated header or footer,
  `voicechat.minetoy.fun` goes to the native voice tab, and the `postMessage` bridge with a strict schema.
- Passkey sign-in inside the WebView (ADR risk).

### 6. iOS: background audio, optional CallKit, green simulator build and signing with the account

### 7. Apple and Google purchases (once the accounts exist)

- `apple` and `google` gateways in `web/src/lib/payments/`, server-side verification, both stores' notifications as
  webhooks, Google acknowledgement within 3 days, re-check by product and transaction.
- Website product ↔ store product mapping, editable in the admin.
- Tests in both stores' sandboxes before any submission.
- Needs from the user: enrolment in both programs, the small-business program (15 %), each store's tax and bank details,
  and the products created (or permission to create them by API).

### 8. How to test on a real phone

A checklist for the user: background voice with Bedrock in front, locked screen, Wi-Fi↔mobile, Bluetooth, whether the
game keeps sounding without ducking, signing in to the website inside the app, and a sandbox purchase.

## UI

The website's purple and gold, Outfit/Inter, ES/EN like the store.

| Screen | Content |
|---|---|
| Voice, not linked | "Escanea el QR de /vc" (camera) or "Escribe el código" |
| Voice, connected | Visualizer, read-only mic/headset/range chips ("Cámbialo en el juego con /vc"), mic and headset sliders, "Colgar" |
| Voice, in use elsewhere | "Usar aquí" |
| Store, Vote, Profile | The website in app mode |

Player names and positions are never shown in voice.

## Risks only a real phone resolves

| Risk | Plan B |
|---|---|
| Bedrock interrupts our audio session on iOS | Reactivate it when the interruption ends; if that's not enough, document it |
| CallKit interrupts or ducks the game | Default mode without CallKit |
| On Android, WebRTC sets `MODE_IN_COMMUNICATION` and the game gets quieter or changes speaker | `MODE_NORMAL` with the `VOICE_COMMUNICATION` source from `modules/voz-nativo` |
| Some vendors' battery savers kill the service | Ask to exempt the app from battery optimization |

## Needs an explicit "sí"

Pushing to `MineToyWeb` and restarting the web split, publishing the well-known files in production, any App Store,
TestFlight or Google Play submission, enrolling in paid accounts and creating store products.
