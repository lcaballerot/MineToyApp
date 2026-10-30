# ADR-0001 — Pila de MineToy Voz (apps de iOS y Android)

> 🇬🇧 [English version](../en/ADR-0001-stack.md) · [Plan](PLAN.md)

Estado: **propuesto** (2026-10-30). Contrato de referencia: `CoreVoz/docs/PROTOCOLO-VOZ.md` (la sección 7 manda; la 8,
nueva, cubrirá la app).

## Contexto

La voz por proximidad funciona hoy en una pestaña del navegador (`voicechat.minetoy.fun`). En el móvil no sirve si el
jugador tiene Minecraft Bedrock abierto en el mismo teléfono: Safari en iOS corta el micrófono al pasar a segundo plano
y Chrome en Android corta WebRTC en segundo plano. Hace falta una app nativa que se comporte como una llamada.

Límites de esta máquina: Windows sin Mac, sin SDK de Android ni CocoaPods en local, disco C: casi lleno, RAM para un solo
proceso pesado a la vez. Todo lo nativo se compila en GitHub Actions y se maneja con `gh`. Sin EAS.

## Decisión

| Pieza | Elección | Por qué |
|---|---|---|
| Marco | React Native + Expo **prebuild** (CNG), TypeScript | El protocolo de `motor.ts` es TypeScript y se reutiliza. Prebuild genera `ios/` y `android/` desde `app.config.ts` y los plugins. |
| Carpetas nativas | **No se versionan**: `expo prebuild --clean` corre en CI | Sin Mac ni SDK local no se pueden mantener a mano. El código nativo propio vive en un módulo local de Expo (`modules/voz-nativo`) y en plugins de configuración, que sí se versionan. |
| WebRTC | `react-native-webrtc` (con `@config-plugins/react-native-webrtc`) + `mediasoup-client` (manejador `ReactNative106`) | El cliente de mediasoup es el mismo que usa la web: transportes, productor y consumers se portan casi sin cambios. |
| iOS en segundo plano | `UIBackgroundModes: audio` y `AVAudioSession` `.playAndRecord` + `.mixWithOthers` + `.allowBluetooth` (+ `.defaultToSpeaker`), desde `modules/voz-nativo` | Es lo único que garantiza no silenciar el juego. Ver «CallKit» abajo. |
| CallKit | **Opcional** (ajuste «Mostrar como llamada»), con `react-native-callkeep` | Una llamada de CallKit activa una sesión de audio que no se mezcla y suele interrumpir el audio de otras apps (el del juego incluido). Se prueba en un dispositivo real; si confirma que interrumpe o atenúa a Minecraft, el modo por defecto es «solo audio en segundo plano» y CallKit queda como opción documentada. `voip` en `UIBackgroundModes` solo se declara si CallKit se usa (Apple rechaza `voip` sin uso real). |
| Android | Servicio en primer plano tipo `microphone` (`FOREGROUND_SERVICE_MICROPHONE`, Android 14+) con la notificación fija «Chat de voz activo» y botón «Colgar», en `modules/voz-nativo` (Kotlin) | Sin dependencia extra para una sola notificación. El foco de audio no se pide de forma exclusiva (sin `AUDIOFOCUS_GAIN`) para no silenciar el juego. |
| Token | `expo-secure-store` (Keychain / Keystore), `WHEN_UNLOCKED_THIS_DEVICE_ONLY` | No se copia en copias de seguridad ni a otro dispositivo. |
| QR | `expo-camera` (escáner de códigos de barras) | Ya incluido en Expo; nada de librerías de terceros para el QR. |
| Enlaces | Universal Links (iOS) y App Links verificados (Android) para `voicechat.minetoy.fun` | `https://voicechat.minetoy.fun/CODIGO` abre la app si está instalada; si no, sigue abriendo la web. |
| Compilación | GitHub Actions: `android.yml` (ubuntu-24.04, Gradle) y `ios.yml` (macos, Xcode) | Sin EAS, según el encargo. |

## Desviaciones del encargo que hay que aprobar

### 1. «Rechazar cualquier `Origin` en `/app/*`» deja fuera a la propia app

Comprobado en el código de React Native (`ReactAndroid/.../websocket/WebSocketModule.kt`): si la app no pone una cabecera
`Origin`, Android añade `origin: https://<host>` del URL. Para nuestra URL eso da `https://voicechat.minetoy.fun`, el
mismo origen que la web. En iOS lo añade SocketRocket. No se puede quitar la cabecera desde JS, solo cambiar su valor.

**Propuesta:** en `/app/*` el servidor acepta **solo** dos casos: sin `Origin`, o `Origin` exactamente
`minetoyvoz://app` (lo pone la app en `new WebSocket(url, [], { headers: { Origin: "minetoyvoz://app" } })`). Cualquier
otro valor, incluido `https://voicechat.minetoy.fun` y `null`, se rechaza. Un navegador nunca manda un `Origin` con un
esquema que no sea de web (las páginas opacas mandan `null`), así que el objetivo se mantiene: ninguna página web puede usar
`/app/*`. Además la autenticación de `/app/senal` es un token en el primer frame, no una cookie que el navegador mande por
su cuenta, así que el CSWSH no aplica de entrada. Si en iOS SocketRocket pisa el `Origin` que pone la app, se verá en la
prueba del paso 4 y se volverá a plantear antes de seguir.

### 2. Espacialización HRTF, visualizador por espectro y micro por encima del 100 %

En la web dependen de Web Audio (`PannerNode`, `AnalyserNode`, `GainNode`), que React Native no tiene. El audio remoto de
`react-native-webrtc` se reproduce dentro del motor nativo de WebRTC.

| Función | Fase 1 (esta entrega) | Más adelante, si se quiere |
|---|---|---|
| Distancia | Volumen por consumer con `track._setVolume()` siguiendo la misma curva lineal hasta R a partir del frame `p` (sin cambios en el servidor) | HRTF real: procesar el audio remoto en nativo |
| Izquierda/derecha | **No** en la fase 1 (sonido centrado) | Igual que la anterior |
| Visualizador | Animado por el nivel de tu voz (`audioLevel` de `getStats()` a ~10 Hz) | Espectro por un tap nativo del micro |
| Volumen de los cascos | 0–200 %, multiplicando el volumen de cada consumer | — |
| Volumen del micro | 0–200 % en la interfaz; por encima del 100 % requiere procesado nativo de la captura. Se intentará en `modules/voz-nativo`; si no llega a la fase 1, el deslizador se limita al 0–100 % y se avisa | — |

El protocolo no cambia en ningún caso: el servidor sigue mandando las posiciones relativas y decide quién oye a quién.

## Consecuencias

- Las carpetas `ios/` y `android/` son desechables; cualquier cambio nativo pasa por `app.config.ts`, un plugin o
  `modules/voz-nativo`.
- Sin cuenta de Apple Developer, iOS se queda en compilación para el simulador (demuestra que compila, no se instala en
  un iPhone).
- Que el juego siga sonando con la voz activa **solo se puede verificar en un teléfono real**; el CI no lo prueba.
