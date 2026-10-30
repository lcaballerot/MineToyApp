# MineToy app security

🇪🇸 [Español](../es/SEGURIDAD.md)

Reference: [OWASP MASVS 2](https://mas.owasp.org/MASVS/) (level L1, plus the L2 items that apply). The voice server
(`web/voz`, voz-control) and the websites have their own defences; this app does not weaken them: it uses the same
routes with the same validation, limits and revocation (contract `CoreVoz/docs/PROTOCOLO-VOZ.md`, sections 7 and 8).

## Controls

| MASVS area | control | where |
|---|---|---|
| STORAGE | The voice token (32 random bytes, opaque) is kept in the Keychain / Android Keystore with `WHEN_UNLOCKED_THIS_DEVICE_ONLY`: it never goes to iCloud or any other backup. Volumes are the only other saved settings. | `src/voz/motor.ts` |
| STORAGE | Android with no backup and no device-to-device transfer (`allowBackup=false`, `fullBackupContent=false`). | `plugins/seguridad-android.js` |
| STORAGE | Nothing sensitive in logs: the app does not write to the console; the server stores only the token's SHA-256. | — |
| CRYPTO | No home-made cryptography: system TLS and WebRTC DTLS-SRTP. | — |
| AUTH | Linking: a single-use 5-minute code, or a link with a token, redeemed at `POST /api/app/vincular` with the same per-IP and per-code limits as the website. The token lasts 400 days, slides on use, one phone per player, and `/vc desvincular` revokes it. | voz-control |
| AUTH | An external link (`https://voicechat.minetoy.fun/…`) **asks for confirmation** before linking: stops someone sending you a link with their code so your phone ends up on their account (login CSRF). A QR scanned inside the app does not ask. | `src/App.tsx` |
| AUTH | The app does not decide what the server decides: mic, headphones and range are applied by voz-control; the app can only request mic and headphones (`ajuste`, explicit value, 8 per 5 s) and its own mic volume (`volmic`, 0–200). Staff mute, vanish and silence still win. | voz-control |
| NETWORK | HTTPS and WSS only. iOS: default ATS, no exceptions. Android: `usesCleartextTraffic=false`. WebView: `mixedContentMode="never"`. | `app.config.ts`, plugins |
| NETWORK | Fixed `Origin: minetoyvoz://app` on the WebSocket; voz-control rejects any other origin on `/app/*`. | `src/voz/motor.ts` |
| NETWORK | No certificate pinning (decision): traffic goes through Cloudflare, which rotates certificates and intermediates; a badly maintained pin would take the app offline. To be revisited if a threat model calls for it. | — |
| PLATFORM | WebView only for MineToy domains (`store`, `vote`, `minetoy.fun`); everything else, payments included, opens in the system browser. No JS bridge (`onMessage`), no local files, no third-party cookies, no script-opened windows, debugging only in development. | `src/web/PestanaWeb.tsx` |
| PLATFORM | Least privilege: microphone (voice), camera (QR reading only), notifications (call service). Permissions added by WebRTC and not used (draw over other apps, storage) are removed. The Android service is not exported. | `app.config.ts`, `modules/voz-nativo` |
| PLATFORM | Incoming links validated with strict patterns (6-character `/vc` alphabet code or 43-character base64url token) before use. | `leerVinculo` |
| CODE | Exact dependency versions and `package-lock.json`. `npm audit --omit=dev` (2026-10-30): 9 advisories, all in Expo build tooling (`@expo/cli`, `@expo/config`, `zod`, `deepmerge`), which does not ship inside the app. | `package.json` |
| CODE | APK signed with the upload key (outside the repo, in GitHub secrets); R8 enabled in release. | `.github/workflows/android.yml` |
| PRIVACY | iOS privacy manifest: no tracking and no data for third parties. The app never shows or receives other players' names or UUIDs, only relative positions for volume. | `app.config.ts` |

## Out of scope (for now)

- Root/jailbreak detection and anti-tampering (MASVS-RESILIENCE): it would protect nothing the server does not already protect.
- iOS signing and store distribution: once the Apple Developer account exists (plan, step 6).

## Reporting a flaw

Privately to the MineToy team (not in a public issue).
