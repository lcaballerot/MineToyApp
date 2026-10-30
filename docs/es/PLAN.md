# Plan — app MineToy (iOS y Android)

> 🇬🇧 [English version](../en/PLAN.md) · [ADR-0001](ADR-0001-pila.md)

Fecha: 2026-10-30. Una app «MineToy» con la web de MineToy dentro y el chat de voz nativo, que sigue vivo con Minecraft
Bedrock abierto en el mismo teléfono.

## Lo que ya existe y no se rehace

| Pieza | Dónde |
|---|---|
| Contrato de voz | `CoreVoz/docs/PROTOCOLO-VOZ.md` (sección 7 manda) |
| voz-control (mediasoup 3.19.3) | `web/voz/` en `lcaballerot/MineToyWeb`, en producción en el split web 68f5842c |
| Cliente de voz a portar | `web/src/components/voz/motor.ts` |
| Tienda, votos, ranking | La web de Next (`store.minetoy.fun`, `vote.minetoy.fun`) |
| Pasarelas de pago | `web/src/lib/payments/` (`PaymentGateway`, `finalize.ts`) |
| Juego | Core-Voz (`/vc`), Core-Web (entregas) |

## Pasos

Cada paso termina con un informe: commits, ejecuciones de CI y qué se verificó en un dispositivo real y qué no.

### 1. ADR, plan y preguntas — hecho

### 2. Servidor de voz: camino aparte para la app (`web/voz`, commit local; subir y reiniciar = «sí» explícito)

| Ruta | Qué hace |
|---|---|
| `POST /api/app/vincular` | `{codigo}` o `{token}` + `dispositivo: {plataforma: "ios"\|"android", modelo?}` (≤ 64 caracteres). Canjea el mismo pedido pendiente que la web. Devuelve `{ok, token, idioma}`: 32 bytes en base64url, solo su SHA-256 en `${DATA_DIR}/voz/apps.json` (600, escritura atómica), 400 días que se deslizan en cada conexión. `Cache-Control: no-store`. |
| `WS /app/senal` | Primer frame `{"t":"auth","token":"…"}` en 5 s o cierre 4401. Después, idéntico a `/senal`. |
| `GET /.well-known/apple-app-site-association` · `/.well-known/assetlinks.json` | `application/json` exacto, sin CORS, sin redirecciones, no pasan a Next. |

Reglas:

- `Origin` en `/app/*` y `/api/app/*`: solo ausente o `minetoyvoz://app`.
- Mismos límites que el navegador y **compartidos con él** (mismos contadores de intentos por IP y por código).
- Una sesión de voz por UUID, web o app; la más nueva cierra la anterior con 4409. La app no se reconecta sola tras un
  4409: «En uso en otro dispositivo» + «Usar aquí».
- Vincular la app revoca los tokens de app anteriores de ese UUID. No toca las cookies del navegador ni al revés.
  `/vc desvincular` revoca los dos. Token revocado → 4401 «revocada» → la app vuelve a vincular.
- `vinculado` del frame `enlace` cuenta también los tokens de app.
- Micro, cascos, alcance, silencio y vanish: los mismos que ya aplica el servidor.
- Pruebas nuevas en `npm run voz:test`; `PROTOCOLO-VOZ.md` sección 8; filas nuevas en la tabla de amenazas de
  `web/voz/README.md`.
- Datos para los ficheros well-known: Team ID de Apple (cuando exista la cuenta) y la huella SHA-256 del certificado de
  firma de Android (la saco del keystore del paso 3).

### 3. Esqueleto de la app y CI en verde con una pantalla «hola»

- Repo `lcaballerot/MineToyApp` según `GUIA-ESTILOS-REPOSITORIOS.md`: READMEs es/en, `CHANGELOG.md`, `docs/es` + `docs/en`,
  insignia de compilación hecha por CI en `.github/badges/`, Release por etiqueta.
- Expo con la última versión estable del SDK en ese momento; versiones exactas.
- `android.yml`: `npm ci`, `expo prebuild --platform android --clean`, `./gradlew assembleRelease` firmado (keystore en
  `gh secret set`, nunca en el repo), APK como artefacto y en la Release de cada etiqueta; AAB para Play cuando exista la cuenta.
- `ios.yml`: `expo prebuild --platform ios --clean`, `pod install`, `xcodebuild` para el simulador; con la cuenta, IPA
  firmado (clave de la API de App Store Connect en secretos). TestFlight solo con aprobación.
- Copia de trabajo en `E:\MineToyApp`. En local solo `npm install`, `tsc` y `eslint`.

### 4. Voz de punta a punta desde el APK de Android

- `src/voz/` = port de `motor.ts` sin DOM, `mediasoup-client` con `ReactNative106`, reconexión ante cambios de red
  (`@react-native-community/netinfo`), Wi-Fi↔datos y segundo plano.
- Audio de la fase 1 (ADR, desviación 2) y servicio en primer plano de Android.
- Prueba en un teléfono real con Bedrock abierto.

### 5. La web dentro de la app

- Pestañas nativas: Tienda · Votar · Voz · Perfil. WebView solo para los dominios de MineToy; lo demás, al navegador.
- En la web (`MineToyWeb`): «modo app» (detección por parámetro o cabecera propia), sin cabecera ni pie duplicados,
  `voicechat.minetoy.fun` lleva a la pestaña nativa de voz, y el puente `postMessage` con esquema estricto.
- Inicio de sesión con passkey dentro del WebView (riesgo del ADR).

### 6. iOS: audio en segundo plano, CallKit opcional, simulador en verde y firma con la cuenta

### 7. Compras con Apple y Google (cuando existan las cuentas)

- Pasarelas `apple` y `google` en `web/src/lib/payments/`, verificación en el servidor, notificaciones de las dos
  tiendas como webhooks, confirmación de Google en menos de 3 días, re-chequeo por producto y transacción.
- Tabla de equivalencias producto web ↔ producto de tienda, editable en el admin.
- Pruebas en los sandbox de las dos tiendas antes de cualquier envío.
- Necesita del usuario: alta en los dos programas, programa de pequeña empresa (15 %), datos fiscales y bancarios de cada
  tienda, y los productos creados (o permiso para crearlos por API).

### 8. Cómo probar en un teléfono real

Lista para el usuario: voz en segundo plano con Bedrock delante, pantalla bloqueada, Wi-Fi↔datos, Bluetooth, si el juego
sigue sonando sin atenuarse, inicio de sesión en la web dentro de la app y una compra de sandbox.

## Interfaz

Lila y dorado de la web, Outfit/Inter, ES/EN como la tienda.

| Pantalla | Contenido |
|---|---|
| Voz, sin vincular | «Escanea el QR de /vc» (cámara) o «Escribe el código» |
| Voz, conectado | Visualizador, fichas de micro/cascos/alcance de solo lectura («Cámbialo en el juego con /vc»), deslizadores de micro y cascos, «Colgar» |
| Voz, en uso en otro sitio | «Usar aquí» |
| Tienda, Votar, Perfil | La web en modo app |

Nunca se muestran nombres ni posiciones de jugadores en la voz.

## Riesgos que solo resuelve un teléfono real

| Riesgo | Plan B |
|---|---|
| Bedrock interrumpe nuestra sesión de audio en iOS | Reactivarla al acabar la interrupción; si no basta, documentarlo |
| CallKit interrumpe o atenúa el juego | Modo por defecto sin CallKit |
| En Android, WebRTC pone `MODE_IN_COMMUNICATION` y el juego baja de volumen o cambia de altavoz | `MODE_NORMAL` con la fuente `VOICE_COMMUNICATION` desde `modules/voz-nativo` |
| El ahorro de batería de algunas marcas mata el servicio | Pedir quitar la optimización de batería para la app |

## Lo que necesita un «sí» explícito

Subir a `MineToyWeb` y reiniciar el split web, publicar los ficheros well-known en producción, cualquier envío a App Store,
TestFlight o Google Play, el alta en cuentas de pago y crear productos en las tiendas.
