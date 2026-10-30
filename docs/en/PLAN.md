# Plan — MineToy Voz (iOS and Android)

> 🇪🇸 [Versión en español](../es/PLAN.md) · [ADR-0001](ADR-0001-stack.md)

Date: 2026-10-30. A native app that keeps proximity voice alive while Minecraft Bedrock is open on the same phone.

## What already exists and isn't rebuilt

| Part | Where |
|---|---|
| Contract | `CoreVoz/docs/PROTOCOLO-VOZ.md` (section 7 overrides) |
| Server (voz-control, mediasoup 3.19.3) | `web/voz/` in `lcaballerot/MineToyWeb`, in production on web split 68f5842c |
| Web client to port | `web/src/components/voz/motor.ts` |
| Game | Core-Voz, `/vc` with code, short link and QR `https://voicechat.minetoy.fun/CODE` |

## Steps

### 1. ADR and plan (this document) and questions for the user

### 2. Server: a separate path for the app (`web/voz`, local commit; push and restart = explicit "sí")

The browser path is untouched. New:

| Route | What it does |
|---|---|
| `POST /api/app/vincular` | Body `{codigo}` or `{token}` (the long link's `#t=`) plus `dispositivo: {plataforma: "ios"\|"android", modelo?}` (model ≤ 64 chars). Redeems the same pending request as the website (single use, 5 min). Returns `{ok, token, idioma}`: 32 random bytes in base64url, stored only as SHA-256 in `${DATA_DIR}/voz/apps.json` (600, atomic write), 400-day expiry that slides on every connection. `Cache-Control: no-store`. |
| `WS /app/senal` | First frame `{"t":"auth","token":"…"}` within 5 s or close 4401. After that, identical to `/senal`: same `ini`, same frames, same schemas. |
| `GET /.well-known/apple-app-site-association` and `/.well-known/assetlinks.json` | Exact `Content-Type: application/json`, no CORS, no redirects, never proxied to Next. |

Rules:

- **`Origin` on `/app/*` and `/api/app/*`**: everything is rejected except absent or `minetoyvoz://app` (see ADR,
  deviation 1). No browser `Sec-Fetch-Site` requirement, but `application/json` and the 1 KiB cap still apply.
- **Same limits as the browser**, **shared with it**: the same attempt counters per IP and per code (using both paths
  doesn't double the attempts), 4 KiB per frame, 50 frames/s, 8 connections per IP.
- **One voice session per UUID**, web or app: the newest closes the previous one with 4409. The app doesn't reconnect on
  its own after a 4409: it shows "In use on another device" and a "Use here" button (already in the website).
- **Tokens:** linking the app revokes that UUID's previous app tokens (one phone per player). It doesn't touch browser
  cookies, and linking the browser doesn't touch app tokens. `/vc desvincular` revokes both. A revoked or expired token →
  close 4401 "revocada" and the app goes back to the linking screen.
- `vinculado` in the `enlace` frame also counts app tokens.
- Mic, headset, range, staff mute and vanish: exactly what the server already enforces (app and web sessions are the same
  `S` object inside voz-control; only authentication differs).
- New tests in `voz/pruebas/seguridad.test.mjs` (`npm run voz:test`): link by code and by token, reuse, limit shared with
  the website, web or `null` `Origin` rejected on `/app/*`, late or bad auth, token revoked by `desvincular`, newest
  session closes the old one (web↔app), exact well-known files with no CORS, token never on disk or in the log.
- `PROTOCOLO-VOZ.md` gets **section 8 (app)** and `web/voz/README.md` the new threat-table rows.
- **Data the user provides** for the well-known files: Apple Team ID (if there's an account) and the SHA-256 fingerprint
  of the Android signing certificate (I generate it with the step 3 keystore).

### 3. App skeleton and green CI with a "hello" screen (before WebRTC)

- Private repo `lcaballerot/MineToyVoz` per `GUIA-ESTILOS-REPOSITORIOS.md`: `README.md` / `README.en.md`, `CHANGELOG.md`,
  `docs/es` + `docs/en`, CI-generated build badge in `.github/badges/`, release by tag.
- Expo at the latest stable SDK at that point, exact versions in `package.json`.
- `android.yml` (ubuntu-24.04): `npm ci`, `expo prebuild --platform android --clean`, `./gradlew assembleRelease` signed
  with a keystore generated once (`gh secret set` as base64, never in the repo), APK as an artifact and attached to the
  Release on tags.
- `ios.yml` (macos): `expo prebuild --platform ios --clean`, `pod install`, `xcodebuild` for the simulator always; with an
  Apple account, archive + IPA signed with an App Store Connect API key in secrets. TestFlight only with approval.
- Working copy at `E:\MineToyVoz` (C: has 2.3 GB free). Locally only `npm install`, `tsc` and `eslint`.

### 4. Protocol and audio; end-to-end call from the Android APK

- `src/motor/` = port of `motor.ts` without the DOM: same protocol, `mediasoup-client` with `ReactNative106`, reconnect
  with growing backoff on network changes (`@react-native-community/netinfo`), Wi-Fi↔mobile and backgrounding.
- Phase 1 audio as in the ADR table (distance by volume, no left/right).
- Android foreground service and a test on a real phone with Bedrock open.

### 5. iOS: background audio, optional CallKit, green simulator build and signing with the account

### 6. How to test on a real phone

A checklist for the user: app in the background with Bedrock in front, locked screen, Wi-Fi↔mobile, Bluetooth
headphones, and whether the game's sound is kept without ducking.

## UI

The website's purple and gold, Outfit/Inter, ES/EN like the store.

| Screen | Content |
|---|---|
| Start | "Escanea el QR de /vc" (camera) or "Escribe el código" |
| Connected | Visualizer, read-only mic/headset/range chips ("Cámbialo en el juego con /vc"), mic and headset sliders, "Colgar" |
| In use elsewhere | "Usar aquí" |

Player names and positions are never shown.

## Risks only a real phone resolves

| Risk | Plan B |
|---|---|
| Bedrock activates an audio session that interrupts ours on iOS | Reactivate the session when the interruption ends; if that's not enough, document it |
| CallKit interrupts or ducks the game | Default mode without CallKit (ADR) |
| On Android, WebRTC sets `MODE_IN_COMMUNICATION` and the game gets quieter or changes speaker | Try `MODE_NORMAL` with the `VOICE_COMMUNICATION` source from `modules/voz-nativo` |
| The system kills the background service (some vendors' battery savers) | Ask to exempt the app from battery optimization and explain it in the app |

## Needs an explicit "sí"

Pushing to `MineToyWeb` and restarting the web split, publishing the well-known files in production, any store or
TestFlight submission, and any paid account.
