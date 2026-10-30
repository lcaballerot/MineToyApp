# Seguridad de la app MineToy

🇬🇧 [English](../en/SECURITY.md)

Referencia: [OWASP MASVS 2](https://mas.owasp.org/MASVS/) (nivel L1, más los puntos de L2 que aplican). El servidor
de voz (`web/voz`, voz-control) y las webs aplican sus propias defensas; esta app no las relaja: usa las mismas
rutas con las mismas validaciones, límites y revocaciones (contrato `CoreVoz/docs/PROTOCOLO-VOZ.md`, secciones 7 y 8).

## Controles

| área MASVS | control | dónde |
|---|---|---|
| STORAGE | El token de voz (32 bytes aleatorios, opaco) va al Keychain / Android Keystore con `WHEN_UNLOCKED_THIS_DEVICE_ONLY`: no viaja a iCloud ni a otra copia. Los volúmenes son los únicos ajustes guardados. | `src/voz/motor.ts` |
| STORAGE | Android sin copia de seguridad ni transferencia entre dispositivos (`allowBackup=false`, `fullBackupContent=false`). | `plugins/seguridad-android.js` |
| STORAGE | Nada sensible en los registros: la app no escribe en consola; el servidor guarda solo el SHA-256 del token. | — |
| CRYPTO | Sin criptografía propia: TLS del sistema y DTLS-SRTP de WebRTC. | — |
| AUTH | Vincular: código de un solo uso y 5 min, o enlace con token, canjeados en `POST /api/app/vincular` con los mismos límites por IP y por código que la web. El token dura 400 días, se desliza al usarlo, un teléfono por jugador y `/vc desvincular` lo revoca. | voz-control |
| AUTH | Un enlace externo (`https://voicechat.minetoy.fun/…`) **pide confirmación** antes de vincular: evita que alguien te mande un enlace con su código y tu teléfono acabe en su cuenta (CSRF de inicio de sesión). El QR leído dentro de la app no pregunta. | `src/App.tsx` |
| AUTH | Lo que decide el servidor no lo decide la app: micro, cascos y alcance los aplica voz-control; la app solo puede pedir micro y cascos (`ajuste`, valor explícito, 8 cada 5 s) y el volumen de su micro (`volmic`, 0–200). Staff, vanish y silencio siguen mandando. | voz-control |
| NETWORK | Solo HTTPS y WSS. iOS: ATS por defecto, sin excepciones. Android: `usesCleartextTraffic=false`. WebView: `mixedContentMode="never"`. | `app.config.ts`, plugins |
| NETWORK | `Origin: minetoyvoz://app` fijo en el WebSocket; voz-control rechaza cualquier otro origen en `/app/*`. | `src/voz/motor.ts` |
| NETWORK | Sin anclaje de certificado (decisión): el tráfico pasa por Cloudflare, que rota certificados e intermedias; un anclaje mal mantenido dejaría la app sin servicio. Se revisará si sale un modelo de amenaza que lo pida. | — |
| PLATFORM | WebView solo para los dominios de MineToy (`store`, `vote`, `radio`, `minetoy.fun`); el resto, pagos incluidos, al navegador del sistema. Sin puente JS (`onMessage`), sin ficheros locales, sin cookies de terceros, sin ventanas por script, depuración solo en desarrollo. | `src/web/PestanaWeb.tsx` |
| PLATFORM | Mínimo privilegio: micrófono (voz), cámara (solo leer el QR), notificaciones (servicio de la llamada). Se quitan los permisos que añade WebRTC y no se usan (dibujar sobre otras apps, almacenamiento). El servicio de Android no se exporta. | `app.config.ts`, `modules/voz-nativo` |
| PLATFORM | Enlaces de entrada validados con expresiones estrictas (código de 6 del alfabeto de `/vc` o token de 43 base64url) antes de usarse. | `leerVinculo` |
| CODE | Dependencias con versión exacta y `package-lock.json`. `npm audit --omit=dev` (2026-10-30): 9 avisos, todos en herramientas de compilación de Expo (`@expo/cli`, `@expo/config`, `zod`, `deepmerge`), que no van dentro de la app. | `package.json` |
| CODE | APK firmado con la clave de subida (fuera del repo, en secretos de GitHub); R8 activo en release. | `.github/workflows/android.yml` |
| PRIVACY | Manifiesto de privacidad de iOS: sin rastreo ni datos para terceros. La app nunca muestra ni recibe nombres ni UUID de otros jugadores, solo posiciones relativas para el volumen. | `app.config.ts` |

## Fuera de alcance (por ahora)

- Detección de root/jailbreak y antimanipulación (MASVS-RESILIENCE): no protege nada que el servidor no proteja ya.
- Firma de iOS y distribución en tiendas: cuando exista la cuenta de Apple Developer (plan, paso 6).

## Avisar de un fallo

En privado al equipo de MineToy (no en un issue público).
