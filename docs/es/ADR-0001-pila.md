# ADR-0001 — Pila de la app MineToy (iOS y Android)

> 🇬🇧 [English version](../en/ADR-0001-stack.md) · [Plan](PLAN.md)

Estado: **aceptado** (2026-10-30, respuestas del usuario). Contrato de voz: `CoreVoz/docs/PROTOCOLO-VOZ.md` (la sección 7
manda; la 8, nueva, cubrirá la app).

## Contexto

El usuario quiere **una sola app «MineToy»** con todo lo de la web (tienda, votos, ranking, perfil…) y el chat de voz.
La web de Next ya hace todo eso; lo único que el navegador no puede hacer en el móvil es la voz con Minecraft Bedrock
abierto en el mismo teléfono: Safari en iOS corta el micrófono en segundo plano y Chrome en Android corta WebRTC.

Límites de esta máquina: Windows sin Mac, sin SDK de Android ni CocoaPods en local, disco C: casi lleno, RAM para un solo
proceso pesado a la vez. Todo lo nativo se compila en GitHub Actions y se maneja con `gh`. Sin EAS.

## Decisiones del usuario (2026-10-30)

| Tema | Decisión |
|---|---|
| Nombre e identificador | «MineToy», `fun.minetoy.app` en iOS y Android; repo `lcaballerot/MineToyApp` |
| Contenido | La web de Next dentro de la app (WebView) + la voz como parte nativa |
| Compras | **Pago de Apple y de Google** (In-App Purchase / Play Billing) conectado con las entregas de Core-Web |
| Apple Developer | Lo va a contratar: hasta entonces, iOS solo en simulador |
| Android | APK en la Release y además Google Play |
| `Origin` en `/app/*` | Ausente o exactamente `minetoyvoz://app` (desviación 1, aprobada) |

## Decisión técnica

| Pieza | Elección | Por qué |
|---|---|---|
| Marco | React Native + Expo **prebuild** (CNG), TypeScript | El protocolo de `motor.ts` es TypeScript y se reutiliza. |
| Carpetas nativas | **No se versionan**: `expo prebuild --clean` corre en CI | Sin Mac ni SDK local no se mantienen a mano. El código nativo propio va en `modules/voz-nativo` (módulo local de Expo) y en plugins de configuración. |
| Web | `react-native-webview` con `store.minetoy.fun` y `vote.minetoy.fun`, pestañas nativas abajo (Tienda · Votar · Voz · Perfil) | Lo que cambie en la web aparece en la app sin publicar versión. Los dominios propios se abren dentro; cualquier otro, en el navegador del sistema. |
| Puente web ↔ app | `postMessage` con esquema estricto, aceptado solo desde los orígenes exactos de MineToy; la web detecta la app por un parámetro o cabecera propia y cambia el botón de pagar por «Comprar con Apple/Google» | La web sigue siendo la fuente de verdad del catálogo y del carrito. |
| Voz | Pantalla nativa (no el WebView): `react-native-webrtc` + `mediasoup-client` (`ReactNative106`) por `/app/senal` | Es la parte que tiene que seguir viva en segundo plano. |
| iOS en segundo plano | `UIBackgroundModes: audio`, `AVAudioSession` `.playAndRecord` + `.mixWithOthers` + `.allowBluetooth` (+ `.defaultToSpeaker`) | No silenciar el juego. |
| CallKit | **Opcional** («Mostrar como llamada»), `react-native-callkeep` | Una llamada de CallKit no se mezcla y suele interrumpir el audio de otras apps. Se decide con una prueba en un iPhone real. `voip` solo se declara si CallKit se usa. |
| Android | Servicio en primer plano tipo `microphone` (Android 14+) con la notificación «Chat de voz activo» y «Colgar», en `modules/voz-nativo` | Sin pedir foco de audio exclusivo. |
| Compras | `react-native-iap` (StoreKit 2 y Play Billing 7+) | Una sola API en JS para las dos tiendas. |
| Token de voz | `expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | No viaja en copias de seguridad. |
| QR | `expo-camera` | Ya incluido en Expo. |
| Enlaces | Universal Links y App Links verificados para `voicechat.minetoy.fun` (y luego `store.`) | `https://voicechat.minetoy.fun/CODIGO` abre la app si está instalada. |
| Compilación | `android.yml` (ubuntu-24.04) y `ios.yml` (macos) en GitHub Actions | Sin EAS. |

## Compras con Apple y Google (servidor de la web)

La web ya tiene una interfaz común de pasarelas (`src/lib/payments/types.ts`, `PaymentGateway`) y un único punto que da un
pedido por pagado (`finalize.ts`, que vuelve a comprobar importe y divisa antes de entregar). Apple y Google entran como
**dos pasarelas nuevas sin redirección**:

1. La app pide a la web crear el pedido (`MT-XXXXXXXX`) igual que el checkout, con pasarela `apple` o `google`.
2. La app compra el producto de la tienda con el pedido atado: `appAccountToken` = UUID derivado del pedido (Apple),
   `obfuscatedAccountId` = referencia del pedido (Google).
3. La app manda al servidor la transacción firmada (Apple, JWS de StoreKit 2) o el `purchaseToken` (Google). El servidor
   **la verifica él mismo**: Apple con la cadena de certificados de Apple y la App Store Server API; Google con la
   Google Play Developer API (cuenta de servicio). Comprueba producto, pedido atado, entorno (sandbox/producción) y que la
   transacción no se ha usado antes.
4. `finalize.ts` la da por pagada y encola la entrega de Core-Web como cualquier otra.
5. Reembolsos y anulaciones: App Store Server Notifications V2 y Real-time Developer Notifications de Google (Pub/Sub)
   como webhooks. Google exige además **confirmar** (`acknowledge`) la compra en 3 días o la devuelve.

Diferencias con las otras pasarelas:

- **Precio:** lo fija la tienda por país, no la web. Cada producto de la web que se venda en la app necesita su producto
  equivalente en App Store Connect y en Play Console (lo crea el usuario, o se crea por API cuando haya cuentas). El
  re-chequeo de `finalize.ts` pasa a comparar **producto e identificador de la transacción**, no el importe en euros.
- **Tipo de producto:** los rangos, llaves y kits son de la cuenta de Minecraft, no del Apple ID, así que van como
  **consumibles** (se puede comprar para otro jugador o repetir); nada de «restaurar compras».
- **Cupones, promociones y el carrito múltiple** de la web no existen en las tiendas: en la app se compra un producto cada vez.
- **Comisión:** 15 % (programas de pequeña empresa de Apple y Google, a solicitar por el usuario) o 30 %.

## Desviaciones del encargo original

### 1. `Origin` en `/app/*` (aprobada)

React Native añade `origin: https://<host>` a todo WebSocket que no lo traiga (comprobado en
`ReactAndroid/.../websocket/WebSocketModule.kt`; en iOS lo hace SocketRocket), y para nuestro URL ese es el origen de la web.
El servidor acepta en `/app/*` **solo** `Origin` ausente o exactamente `minetoyvoz://app`, que la app pone con
`new WebSocket(url, [], { headers: { Origin: "minetoyvoz://app" } })`. Ningún navegador manda un `Origin` con ese
esquema. Si SocketRocket pisa el valor en iOS, se verá en la prueba del paso 4 y se volverá a plantear.

### 2. Audio sin Web Audio

`PannerNode`, `AnalyserNode` y `GainNode` no existen en React Native; el audio remoto se reproduce dentro de WebRTC nativo.

| Función | Fase 1 | Más adelante |
|---|---|---|
| Distancia | Volumen por consumer con `track._setVolume()`, misma curva lineal hasta R a partir del frame `p` | HRTF con procesado nativo |
| Izquierda/derecha | No (centrado) | Igual |
| Visualizador | Por el nivel de tu voz (`audioLevel` de `getStats()`, ~10 Hz) | Espectro por un tap nativo |
| Cascos 0–200 % | Multiplicando el volumen de cada consumer | — |
| Micro 0–200 % | Por encima del 100 % necesita procesar la captura en nativo; si no llega a la fase 1, se limita a 0–100 % y se dice | — |

El servidor no cambia por esto.

## Riesgos de las tiendas

| Riesgo | Mitigación |
|---|---|
| Apple 4.2 (app que solo envuelve una web) | La voz nativa, el QR y las pestañas nativas son funcionalidad propia |
| Inicio de sesión con passkey dentro del WebView (la web la exige al staff) | iOS: dominio asociado `webcredentials:`; Android: WebView con WebAuthn activado. Si no funciona, el panel de administración se abre en el navegador |
| Revisión de las compras | Cuenta de prueba (sandbox) y un jugador de prueba para el revisor |
| La web vende algo dentro de la app por otra pasarela | En modo app, el botón de las otras pasarelas no se muestra |

## Consecuencias

- `ios/` y `android/` son desechables.
- Sin cuentas de Apple y de Google no se pueden crear productos ni probar compras: la parte de compras se construye y se
  prueba contra los entornos sandbox cuando existan.
- Que el juego siga sonando con la voz activa solo se verifica en un teléfono real.
