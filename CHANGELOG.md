# Historial de versiones · Version history

## 0.2.0 — sin publicar · unreleased

| | |
|---|---|
| Android | APK firmado (prerelease `android-pruebas`) · signed APK |
| iOS | IPA sin firma para Sideloadly (prerelease `ios-pruebas`) · unsigned IPA for Sideloadly |
| Verificado · Verified | pendiente · pending |

**🇪🇸**
- Chat de voz por proximidad: vincular con el QR de `/vc` o el código, llamada que sigue en segundo plano (servicio en
  primer plano en Android, audio que se mezcla con el juego en iOS), estado de micro/cascos/alcance de solo lectura,
  volumen de los cascos 0–200 % y «Colgar».
- Reconexión sola al cambiar de red o al volver a la app; «Usar aquí» si la voz está abierta en otro sitio.
- Sin izquierda/derecha ni volumen del micro todavía (ADR-0001, desviación 2).

**🇬🇧**
- Proximity voice chat: link with the `/vc` QR or code, call that keeps running in the background (foreground service on
  Android, audio mixed with the game on iOS), read-only mic/headset/range status, headset volume 0–200 % and "Hang up".
- Reconnects on its own after network changes or when returning to the app; "Use here" if voice is open elsewhere.
- No left/right or mic volume yet (ADR-0001, deviation 2).

## 0.1.0 — sin publicar · unreleased

| | |
|---|---|
| Android | APK firmado (compilado en CI) · signed APK (CI build) |
| iOS | solo simulador · simulator only |
| Verificado · Verified | iPhone con Sideloadly (pantalla provisional) · iPhone via Sideloadly (placeholder screen) |

**🇪🇸**
- Esqueleto de la app con Expo y una pantalla provisional.
- Compilación continua de Android (APK firmado) y de iOS (simulador).

**🇬🇧**
- App skeleton with Expo and a placeholder screen.
- Continuous builds for Android (signed APK) and iOS (simulator).
