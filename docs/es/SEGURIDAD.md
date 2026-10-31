# Seguridad de la app MineToy

🇬🇧 [English](../en/SECURITY.md)

Referencia: [OWASP MASVS 2](https://mas.owasp.org/MASVS/) (nivel L1, más los puntos de L2 que aplican) y
[OWASP Mobile Top 10 (2024)](https://owasp.org/www-project-mobile-top-10/). El servidor de voz (`web/voz`, voz-control)
y las webs aplican sus propias defensas; esta app no las relaja: usa las mismas rutas con las mismas validaciones,
límites y revocaciones (contrato `CoreVoz/docs/PROTOCOLO-VOZ.md`, secciones 7, 8 y 9).

Las reglas que deciden qué entra en la app están juntas en `src/seguridad/reglas.ts`, sin React Native, y
`npm test` (`pruebas/reglas.test.ts`) tiene una prueba por regla; CI la pasa antes de compilar.

Estado: ✅ hecho y probado · 🟡 hecho, sin probar en un teléfono · ⚪ fuera de alcance (con motivo).

## Controles

| área MASVS | control | estado | evidencia |
|---|---|---|---|
| STORAGE-1 | El token de voz (32 bytes aleatorios, opaco) va al Keychain / Android Keystore con `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`: se lee con la pantalla bloqueada (reconexión en segundo plano) pero no viaja a iCloud ni a otro teléfono. Los tokens de antes (`WHEN_UNLOCKED_…`) se reescriben al arrancar. Los volúmenes son los únicos ajustes guardados. | 🟡 | `src/voz/motor.ts` (`LLAVERO`) |
| STORAGE-2 | Android sin copia de seguridad ni transferencia entre dispositivos (`allowBackup=false`, `fullBackupContent=false`, sin `dataExtractionRules`). | ✅ | `plugins/seguridad-android.js`; manifiesto de `expo prebuild` |
| STORAGE-2 | El código de vincular y el escáner QR no salen en capturas, grabaciones ni en la miniatura de apps recientes (`FLAG_SECURE` en Android; en iOS se tapa la grabación). Solo mientras se ven. | 🟡 | `src/voz/PantallaVoz.tsx` (`expo-screen-capture`) |
| STORAGE-2 | Nada sensible en los registros: la app no escribe en consola; el único `NSLog` es un error del sistema de audio, sin datos del jugador. El servidor guarda solo el SHA-256 del token. | ✅ | `grep console.` vacío en `src/` |
| CRYPTO-1 | Sin criptografía propia: TLS del sistema y DTLS-SRTP de WebRTC. | ✅ | — |
| AUTH-1 | Vincular: código de un solo uso y 5 min, o enlace con token, canjeados en `POST /api/app/vincular` con los mismos límites por IP y por código que la web. El token dura 400 días, se desliza al usarlo, un teléfono por jugador y `/vc desvincular` lo revoca. | ✅ | voz-control (sus pruebas) |
| AUTH-2 | Un enlace externo (`https://voicechat.minetoy.fun/…`) **pide confirmación** antes de vincular: evita que alguien te mande un enlace con su código y tu teléfono acabe en su cuenta (CSRF de inicio de sesión). El QR leído dentro de la app no pregunta. | 🟡 | `src/App.tsx` (`abrirVoz`) |
| AUTH-3 | Lo que decide el servidor no lo decide la app: micro, cascos, radio y alcance los aplica voz-control; la app solo puede pedir micro y cascos (`ajuste` con `que` mic/cascos y `v` booleano, sin campos de más, como mucho 8 cada 5 s también en la app) y el volumen de su micro (`volmic`, entero 0–200). La ficha de radio pinta `estado.radio` tal cual llega; un campo con otro tipo no cambia nada. | ✅ | `frameAjuste`, `crearLimiteAjustes`, `volumen`, `leerEstado` + pruebas |
| AUTH | Cuentas de la web: cada host tiene su sesión `__Host-cuenta` (HttpOnly, Secure, SameSite=Lax). Las cuatro pestañas comparten el almacén de cookies del sistema, persistente (`sharedCookiesEnabled`; `WKWebsiteDataStore.default` / `CookieManager`), así que el inicio de sesión único store → vote/radio funciona igual que en el navegador. | 🟡 | `src/web/PestanaWeb.tsx` |
| NETWORK-1 | Solo HTTPS y WSS. iOS: ATS por defecto, sin excepciones. Android: `usesCleartextTraffic=false` y `network_security_config` sin texto en claro y **solo las CA del sistema** (las que instala el usuario no valen: un proxy de intercepción no ve el tráfico). WebView: `mixedContentMode="never"`, `http://` bloqueado también en nuestros dominios. | ✅ | `plugins/seguridad-android.js`, `destinoUrl` + pruebas |
| NETWORK-1 | `Origin: minetoyvoz://app` fijo en el WebSocket; voz-control rechaza cualquier otro origen en `/app/*`. | ✅ | `src/voz/motor.ts` |
| NETWORK-2 | Sin anclaje de certificado (decisión): el tráfico pasa por Cloudflare, que rota certificados e intermedias; un anclaje mal mantenido dejaría la app sin servicio. Se revisará si sale un modelo de amenaza que lo pida. | ⚪ | — |
| PLATFORM-1 | WebView solo para `store`, `vote`, `radio` y `www.minetoy.fun` (https, sin usuario ni puerto). `voicechat` abre la pestaña nativa de voz. El apex `minetoy.fun` (es la IP del juego, no una web), los pagos y cualquier otro sitio, al navegador del sistema; `mailto:`/`tel:` a su app; `javascript:`, `file:`, `intent:` y demás, bloqueados. | ✅ | `destinoUrl` + pruebas |
| PLATFORM-2 | Sin puente JS: la web no tiene `onMessage` y no puede llamar a nada nativo. Sin ficheros locales (`allowFileAccess*` false), sin cookies de terceros, sin ventanas por script, depuración remota solo en desarrollo (`webviewDebuggingEnabled={__DEV__}`). | ✅ | `src/web/PestanaWeb.tsx` |
| PLATFORM-1 | Enlaces de entrada validados antes de usarse: voz (código de 6 del alfabeto `[2-9A-HJKMNP-Z]` o token de 43 base64url, solo `https://voicechat.minetoy.fun`) y `/link` de cuentas (`https://store.minetoy.fun/[es|en/][cuenta/]link/<CÓDIGO>` o `minetoy://link/<CÓDIGO>`, mismo alfabeto que `RE_CODIGO_LINK` de la web): con un código inválido no se carga nada, y solo se abre la tienda. | ✅ | `leerVinculo`, `leerEnlaceLink` + pruebas |
| PLATFORM-3 | Mínimo privilegio: micrófono (voz), cámara (solo leer el QR), notificaciones (servicio de la llamada). Se quitan los permisos que añade WebRTC y no se usan (dibujar sobre otras apps, almacenamiento, medios). El servicio de Android no se exporta; solo se exporta la actividad principal (lanzador y enlaces). | ✅ | `app.config.ts`, `modules/voz-nativo`, manifiesto |
| CODE-1 | Entradas saneadas: lo que se escribe en el código solo admite su alfabeto y 6 caracteres; el modelo del teléfono que se manda a voz-control pasa por NFC, sin controles/bidi/ancho cero y con el patrón exacto del servidor (`[\w .,()+-]{0,64}`). La app no pinta texto libre del servidor (solo booleanos y números acotados). | ✅ | `sanearTexto`, `modeloSeguro` + pruebas |
| CODE-3 | Dependencias con versión exacta y `package-lock.json`. `overrides` sube `minimatch` a 11.0.3 y `glob` a 14.0.3 (quita los 11 avisos moderados; probado con `expo config` y `expo prebuild`). `npm audit --omit=dev` (2026-10-31): 3 altos (una sola causa: `zod` 3 en `@expo/cli`; el arreglo solo existe en zod 4, que cambia la API que usa la CLI) y 2 bajos (`deepmerge`, sin versión arreglada). Todo es herramienta de compilación que corre en CI con nuestra configuración y no va dentro de la app. CI corta si aparece algo crítico. | 🟡 | `package.json`, `.github/workflows/*.yml` |
| CODE-4 | APK firmado con la clave de subida (fuera del repo, en secretos de GitHub); R8 activo en release. Sin secretos en el binario: el token se obtiene al vincular. | ✅ | `.github/workflows/android.yml` |
| PRIVACY-1 | Manifiesto de privacidad de iOS: sin rastreo ni datos para terceros. La app nunca muestra ni recibe nombres ni UUID de otros jugadores, solo posiciones relativas para el volumen. | ✅ | `app.config.ts` |

## OWASP Mobile Top 10 (2024)

| riesgo | cómo queda |
|---|---|
| M1 Credenciales | Token opaco en Keychain/Keystore, revocable; sin contraseñas en la app (las cuentas son de la web). |
| M2 Cadena de suministro | Versiones exactas, lockfile, `npm audit` en CI (ver CODE-3). |
| M3 Autenticación/autorización | Todo lo decide voz-control y la web; la app solo pide. |
| M4 Validación de entrada/salida | `src/seguridad/reglas.ts` + pruebas. |
| M5 Comunicación insegura | HTTPS/WSS, ATS, sin texto en claro, solo CA del sistema en Android. |
| M6 Privacidad | Manifiesto de privacidad, sin datos de otros jugadores. |
| M7 Protección del binario | R8 en Android; sin secretos dentro. Antimanipulación fuera de alcance (abajo). |
| M8 Configuración | Sin copias, sin depuración en release, permisos mínimos, servicio no exportado. |
| M9 Almacenamiento | Solo Keychain/Keystore `THIS_DEVICE_ONLY`; capturas tapadas donde hay un código. |
| M10 Criptografía | Sin criptografía propia. |

## Sin verificar todavía (hace falta un teléfono)

No hay Mac ni SDK de Android en el PC de desarrollo; esto se comprueba en un iPhone y un Android reales con el APK/IPA de CI:

1. Entrar en store → abrir la pestaña de radio ya con sesión y avatar (inicio de sesión único silencioso). Depende de que
   la WebView mande `Sec-Fetch-Mode: navigate` / `Sec-Fetch-Dest: document`; si no los manda, se ve «Entrar», que
   también funciona. Apuntar aquí lo que se vea en cada sistema.
2. Salir en store → la radio pide entrar.
3. `minetoy://link/<CÓDIGO>` con un código válido abre la tienda en `/cuenta/link/<CÓDIGO>`; con uno inválido, nada.
4. La ficha de radio cambia al hacer `/vc` en el juego.
5. Captura de pantalla en la vista de vincular: negra (Android) / tapada al grabar (iOS); en la vista conectada, normal.
6. Bloquear el teléfono con la voz conectada y cortar la red: al volver la red, reconecta sin desbloquear.

## Fuera de alcance (por ahora)

- Detección de root/jailbreak y antimanipulación (MASVS-RESILIENCE): el servidor no se fía de nada que diga la app, se
  salta en minutos y añadiría una dependencia nativa. Decisión del usuario si la quiere solo como aviso.
- Enlaces universales de `store.minetoy.fun` (`/link` abriría la app): hace falta `apple-app-site-association` firmado con
  el equipo de Apple y `assetlinks.json`; hasta entonces esos enlaces abren el navegador.
- Las cookies de la WebView en iOS van en la copia de iCloud como las de cualquier app; excluirlas pide código nativo. La
  sesión de la web sigue atada a su host y caduca en el servidor.
- Firma de iOS y distribución en tiendas: cuando exista la cuenta de Apple Developer (plan, paso 6).

## Avisar de un fallo

En privado al equipo de MineToy (no en un issue público).
