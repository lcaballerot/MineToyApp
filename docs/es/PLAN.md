# Plan — MineToy Voz (iOS y Android)

> 🇬🇧 [English version](../en/PLAN.md) · [ADR-0001](ADR-0001-pila.md)

Fecha: 2026-10-30. App nativa que mantiene la voz por proximidad viva con Minecraft Bedrock abierto en el mismo teléfono.

## Lo que ya existe y no se rehace

| Pieza | Dónde |
|---|---|
| Contrato | `CoreVoz/docs/PROTOCOLO-VOZ.md` (sección 7 manda) |
| Servidor (voz-control, mediasoup 3.19.3) | `web/voz/` en `lcaballerot/MineToyWeb`, en producción en el split web 68f5842c |
| Cliente web a portar | `web/src/components/voz/motor.ts` |
| Juego | Core-Voz, `/vc` con código, enlace corto y QR `https://voicechat.minetoy.fun/CODIGO` |

## Pasos

### 1. ADR y plan (este documento) y preguntas al usuario

### 2. Servidor: camino aparte para la app (`web/voz`, commit local; subir y reiniciar = «sí» explícito)

El camino del navegador no se toca. Lo nuevo:

| Ruta | Qué hace |
|---|---|
| `POST /api/app/vincular` | Cuerpo `{codigo}` o `{token}` (el `#t=` del enlace largo) más `dispositivo: {plataforma: "ios"\|"android", modelo?}` (modelo ≤ 64 caracteres). Canjea el mismo pedido pendiente que la web (un solo uso, 5 min). Devuelve `{ok, token, idioma}`: 32 bytes aleatorios en base64url, guardado solo como SHA-256 en `${DATA_DIR}/voz/apps.json` (600, escritura atómica), caducidad de 400 días que se desliza en cada conexión. `Cache-Control: no-store`. |
| `WS /app/senal` | Primer frame `{"t":"auth","token":"…"}` en 5 s o cierre 4401. Después, idéntico a `/senal`: mismo `ini`, mismos frames, mismos esquemas. |
| `GET /.well-known/apple-app-site-association` y `/.well-known/assetlinks.json` | `Content-Type: application/json` exacto, sin CORS, sin redirecciones, no pasan a Next. |

Reglas:

- **`Origin` en `/app/*` y `/api/app/*`**: se rechaza todo salvo ausente o `minetoyvoz://app` (ver ADR, desviación 1).
  No se exige `Sec-Fetch-Site` ni `Content-Type` de navegador, pero sí `application/json` y el tope de 1 KiB.
- **Mismos límites que el navegador** y **compartidos con él**: el mismo contador de intentos por IP y por código
  (no se duplican los intentos usando las dos rutas), 4 KiB por frame, 50 frames/s, 8 conexiones por IP.
- **Una sesión de voz por UUID**, web o app: la más nueva cierra la anterior con 4409. La app no se reconecta sola
  tras un 4409: muestra «En uso en otro dispositivo» y un botón «Usar aquí» (ya existe en la web).
- **Tokens:** vincular la app revoca los tokens de app anteriores de ese UUID (un teléfono por jugador). No toca
  las cookies del navegador, y vincular el navegador no toca los tokens de la app. `/vc desvincular` revoca los dos.
  Token revocado o caducado → cierre 4401 «revocada» y la app vuelve a la pantalla de vincular.
- `vinculado` del frame `enlace` también cuenta los tokens de app.
- Micro, cascos, alcance, silencio y vanish: los mismos que ya aplica el servidor (las sesiones de app y web son el
  mismo objeto `S` dentro de voz-control; solo cambia cómo se autentican).
- Pruebas nuevas en `voz/pruebas/seguridad.test.mjs` (`npm run voz:test`): vincular por código y por token, reutilización,
  límite compartido con la web, `Origin` web o `null` rechazado en `/app/*`, auth tardía o mala, token revocado por
  `desvincular`, la nueva sesión cierra a la vieja (web↔app), ficheros well-known exactos y sin CORS, el token no aparece en
  disco ni en el log.
- `PROTOCOLO-VOZ.md` gana la **sección 8 (app)** y `web/voz/README.md` las filas nuevas de la tabla de amenazas.
- **Datos que pone el usuario** para los ficheros well-known: Team ID de Apple (si hay cuenta) y la huella SHA-256 del
  certificado de firma de Android (la genero yo con el keystore del paso 3).

### 3. Esqueleto de la app y CI en verde con una pantalla «hola» (antes de WebRTC)

- Repo privado `lcaballerot/MineToyVoz` según `GUIA-ESTILOS-REPOSITORIOS.md`: `README.md` / `README.en.md`, `CHANGELOG.md`,
  `docs/es` + `docs/en`, insignia de compilación hecha por CI en `.github/badges/`, Release por etiqueta.
- Expo con la última versión estable del SDK en ese momento, versiones exactas en `package.json`.
- `android.yml` (ubuntu-24.04): `npm ci`, `expo prebuild --platform android --clean`, `./gradlew assembleRelease`
  firmado con un keystore creado una vez (`gh secret set` en base64, nunca en el repo), APK como artefacto y adjunto a la
  Release en las etiquetas.
- `ios.yml` (macos): `expo prebuild --platform ios --clean`, `pod install`, `xcodebuild` para el simulador siempre; con
  cuenta de Apple, archivo + IPA firmado con una clave de la API de App Store Connect en secretos. TestFlight solo con
  aprobación.
- Copia de trabajo en `E:\MineToyVoz` (C: tiene 2,3 GB libres). En local solo `npm install`, `tsc` y `eslint`.

### 4. Protocolo y audio; llamada de punta a punta desde el APK de Android

- `src/motor/` = port de `motor.ts` sin DOM: mismo protocolo, `mediasoup-client` con `ReactNative106`, reconexión con
  espera creciente ante cambios de red (`@react-native-community/netinfo`), Wi-Fi↔datos y paso a segundo plano.
- Audio de la fase 1 según la tabla del ADR (distancia por volumen, sin izquierda/derecha).
- Servicio en primer plano de Android y prueba en un teléfono real con Bedrock abierto.

### 5. iOS: audio en segundo plano, CallKit opcional, simulador en verde y firma con la cuenta

### 6. Cómo probar en un teléfono real

Lista para el usuario: app en segundo plano con Bedrock delante, pantalla bloqueada, Wi-Fi↔datos, auriculares Bluetooth,
y si el sonido del juego se mantiene sin atenuarse.

## Interfaz

Lila y dorado de la web, Outfit/Inter, ES/EN como la tienda.

| Pantalla | Contenido |
|---|---|
| Inicio | «Escanea el QR de /vc» (cámara) o «Escribe el código» |
| Conectado | Visualizador, fichas de micro/cascos/alcance de solo lectura («Cámbialo en el juego con /vc»), deslizadores de micro y cascos, «Colgar» |
| En uso en otro sitio | «Usar aquí» |

Nunca se muestran nombres ni posiciones de jugadores.

## Riesgos que solo resuelve un teléfono real

| Riesgo | Plan B |
|---|---|
| Bedrock activa una sesión de audio que interrumpe la nuestra en iOS | Reactivar la sesión al recibir el fin de la interrupción; si no basta, documentarlo |
| CallKit interrumpe o atenúa el juego | Modo por defecto sin CallKit (ADR) |
| En Android, WebRTC pone `MODE_IN_COMMUNICATION` y el juego baja de volumen o cambia de altavoz | Probar `MODE_NORMAL` con la fuente `VOICE_COMMUNICATION` desde `modules/voz-nativo` |
| El sistema mata el servicio en segundo plano (ahorro de batería de algunas marcas) | Pedir quitar la optimización de batería para la app y explicarlo en la app |

## Lo que necesita un «sí» explícito

Subir a `MineToyWeb` y reiniciar el split web, publicar los ficheros well-known en producción, cualquier envío a tiendas o
a TestFlight y cualquier cuenta de pago.
