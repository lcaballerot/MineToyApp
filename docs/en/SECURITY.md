# MineToy app security

🇪🇸 [Español](../es/SEGURIDAD.md)

Reference: [OWASP MASVS 2](https://mas.owasp.org/MASVS/) (level L1, plus the L2 items that apply) and
[OWASP Mobile Top 10 (2024)](https://owasp.org/www-project-mobile-top-10/). The voice server (`web/voz`, voz-control)
and the websites have their own defences; this app does not weaken them: it uses the same routes with the same
validation, limits and revocation (contract `CoreVoz/docs/PROTOCOLO-VOZ.md`, sections 7, 8 and 9).

The rules that decide what gets into the app live together in `src/seguridad/reglas.ts`, with no React Native, and
`npm test` (`pruebas/reglas.test.ts`) has one test per rule; CI runs it before building.

Status: ✅ done and tested · 🟡 done, not yet tried on a phone · ⚪ out of scope (with the reason).

## Controls

| MASVS area | control | status | evidence |
|---|---|---|---|
| STORAGE-1 | The voice token (32 random bytes, opaque) is kept in the Keychain / Android Keystore with `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: readable with the screen locked (background reconnection) but never goes to iCloud or another phone. Older tokens (`WHEN_UNLOCKED_…`) are rewritten on start. Volumes are the only other saved settings. | 🟡 | `src/voz/motor.ts` (`LLAVERO`) |
| STORAGE-2 | Android with no backup and no device-to-device transfer (`allowBackup=false`, `fullBackupContent=false`, no `dataExtractionRules`). | ✅ | `plugins/seguridad-android.js`; `expo prebuild` manifest |
| STORAGE-2 | The link code and the QR scanner stay out of screenshots, recordings and the recent-apps thumbnail (`FLAG_SECURE` on Android; recording is masked on iOS). Only while they are on screen. | 🟡 | `src/voz/PantallaVoz.tsx` (`expo-screen-capture`) |
| STORAGE-2 | Nothing sensitive in logs: the app does not write to the console; the only `NSLog` is an audio-session system error with no player data. The server stores only the token's SHA-256. | ✅ | `grep console.` empty in `src/` |
| CRYPTO-1 | No home-made cryptography: system TLS and WebRTC DTLS-SRTP. | ✅ | — |
| AUTH-1 | Linking: a single-use 5-minute code, or a link with a token, redeemed at `POST /api/app/vincular` with the same per-IP and per-code limits as the website. The token lasts 400 days, slides on use, one phone per player, and `/vc desvincular` revokes it. | ✅ | voz-control (its tests) |
| AUTH-2 | An external link (`https://voicechat.minetoy.fun/…`) **asks for confirmation** before linking: stops someone sending you a link with their code so your phone ends up on their account (login CSRF). A QR scanned inside the app does not ask. | 🟡 | `src/App.tsx` (`abrirVoz`) |
| AUTH-3 | The app does not decide what the server decides: mic, headphones, radio and range are applied by voz-control; the app can only request mic and headphones (`ajuste` with `que` mic/cascos and a boolean `v`, no extra fields, at most 8 per 5 s in the app too) and its own mic volume (`volmic`, integer 0–200). The radio chip paints `estado.radio` as received; a field with the wrong type changes nothing. | ✅ | `frameAjuste`, `crearLimiteAjustes`, `volumen`, `leerEstado` + tests |
| AUTH | Website accounts: each host has its own `__Host-cuenta` session (HttpOnly, Secure, SameSite=Lax). The four tabs share the system's persistent cookie store (`sharedCookiesEnabled`; `WKWebsiteDataStore.default` / `CookieManager`), so single sign-on store → vote/radio works the same as in the browser. | 🟡 | `src/web/PestanaWeb.tsx` |
| NETWORK-1 | HTTPS and WSS only. iOS: default ATS, no exceptions. Android: `usesCleartextTraffic=false` and a `network_security_config` with no cleartext and **system CAs only** (user-installed ones are not trusted: an interception proxy cannot see the traffic). WebView: `mixedContentMode="never"`, `http://` blocked on our domains too. | ✅ | `plugins/seguridad-android.js`, `destinoUrl` + tests |
| NETWORK-1 | Fixed `Origin: minetoyvoz://app` on the WebSocket; voz-control rejects any other origin on `/app/*`. | ✅ | `src/voz/motor.ts` |
| NETWORK-2 | No certificate pinning (decision): traffic goes through Cloudflare, which rotates certificates and intermediates; a badly maintained pin would take the app offline. To be revisited if a threat model calls for it. | ⚪ | — |
| PLATFORM-1 | WebView only for `store`, `vote`, `radio` and `www.minetoy.fun` (https, no user info or port). `voicechat` opens the native voice tab. The `minetoy.fun` apex (the game's IP, not a website), payments and any other site go to the system browser; `mailto:`/`tel:` to their apps; `javascript:`, `file:`, `intent:` and the rest are blocked. | ✅ | `destinoUrl` + tests |
| PLATFORM-2 | No JS bridge: the website has no `onMessage` and cannot call anything native. No local files (`allowFileAccess*` false), no third-party cookies, no script-opened windows, remote debugging only in development (`webviewDebuggingEnabled={__DEV__}`). | ✅ | `src/web/PestanaWeb.tsx` |
| PLATFORM-1 | Incoming links validated before use: voice (6-character code from the `[2-9A-HJKMNP-Z]` alphabet or 43-character base64url token, only `https://voicechat.minetoy.fun`) and account `/link` (`https://store.minetoy.fun/[es|en/][cuenta/]link/<CODE>` or `minetoy://link/<CODE>`, same alphabet as the website's `RE_CODIGO_LINK`): with an invalid code nothing loads, and only the store opens. | ✅ | `leerVinculo`, `leerEnlaceLink` + tests |
| PLATFORM-3 | Least privilege: microphone (voice), camera (QR reading only), notifications (call service). Permissions added by WebRTC and not used (draw over other apps, storage, media) are removed. The Android service is not exported; only the main activity is (launcher and links). | ✅ | `app.config.ts`, `modules/voz-nativo`, manifest |
| CODE-1 | Sanitised input: the code field only accepts its alphabet and 6 characters; the phone model sent to voz-control goes through NFC, no control/bidi/zero-width characters and the server's exact pattern (`[\w .,()+-]{0,64}`). The app paints no free text from the server (only booleans and bounded numbers). | ✅ | `sanearTexto`, `modeloSeguro` + tests |
| CODE-3 | Exact dependency versions and `package-lock.json`. `overrides` lifts `minimatch` to 11.0.3 and `glob` to 14.0.3 (clears the 11 moderate advisories; tested with `expo config` and `expo prebuild`). `npm audit --omit=dev` (2026-10-31): 3 high (one cause: `zod` 3 inside `@expo/cli`; the fix only exists in zod 4, which changes the API the CLI uses) and 2 low (`deepmerge`, no fixed version). All of it is build tooling that runs in CI on our own config and does not ship inside the app. CI fails on anything critical. | 🟡 | `package.json`, `.github/workflows/*.yml` |
| CODE-4 | APK signed with the upload key (outside the repo, in GitHub secrets); R8 enabled in release. No secrets in the binary: the token is obtained when linking. | ✅ | `.github/workflows/android.yml` |
| PRIVACY-1 | iOS privacy manifest: no tracking and no data for third parties. The app never shows or receives other players' names or UUIDs, only relative positions for volume. | ✅ | `app.config.ts` |

## OWASP Mobile Top 10 (2024)

| risk | where it stands |
|---|---|
| M1 Credentials | Opaque, revocable token in Keychain/Keystore; no passwords in the app (accounts belong to the website). |
| M2 Supply chain | Exact versions, lockfile, `npm audit` in CI (see CODE-3). |
| M3 Authentication/authorisation | voz-control and the website decide everything; the app only asks. |
| M4 Input/output validation | `src/seguridad/reglas.ts` + tests. |
| M5 Insecure communication | HTTPS/WSS, ATS, no cleartext, system CAs only on Android. |
| M6 Privacy | Privacy manifest, no data about other players. |
| M7 Binary protection | R8 on Android; no secrets inside. Anti-tampering out of scope (below). |
| M8 Misconfiguration | No backups, no debugging in release, least privilege, service not exported. |
| M9 Storage | Keychain/Keystore `THIS_DEVICE_ONLY` only; screen capture masked where a code is shown. |
| M10 Cryptography | No home-made cryptography. |

## Not verified yet (needs a phone)

There is no Mac or Android SDK on the development PC; this is checked on a real iPhone and Android with the CI APK/IPA:

1. Sign in on store → open the radio tab already signed in with your avatar (silent single sign-on). This depends on
   the WebView sending `Sec-Fetch-Mode: navigate` / `Sec-Fetch-Dest: document`; if it does not, "Sign in" shows,
   which also works. Write down here what each OS does.
2. Sign out on store → radio asks you to sign in.
3. `minetoy://link/<CODE>` with a valid code opens the store at `/cuenta/link/<CODE>`; with an invalid one, nothing.
4. The radio chip changes when you use `/vc` in game.
5. Screenshot on the link view: black (Android) / masked when recording (iOS); normal on the connected view.
6. Lock the phone with voice connected and cut the network: when the network returns it reconnects without unlocking.

## Out of scope (for now)

- Root/jailbreak detection and anti-tampering (MASVS-RESILIENCE): the server trusts nothing the app says, it is
  bypassed in minutes and would add a native dependency. The user's call if they want it as a warning only.
- Universal links for `store.minetoy.fun` (`/link` opening the app): needs an `apple-app-site-association` signed with
  the Apple team and an `assetlinks.json`; until then those links open the browser.
- WebView cookies on iOS go into the iCloud backup like any app's; excluding them needs native code. The website
  session is still bound to its host and expires on the server.
- iOS signing and store distribution: once the Apple Developer account exists (plan, step 6).

## Reporting a flaw

Privately to the MineToy team (not in a public issue).
