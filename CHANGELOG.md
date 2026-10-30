# Historial de versiones · Version history

## 0.6.0 — sin publicar · unreleased

| | |
|---|---|
| Android | APK firmado (prerelease `android-pruebas`) · signed APK |
| iOS | IPA sin firma para Sideloadly (prerelease `ios-pruebas`) · unsigned IPA for Sideloadly |
| Verificado · Verified | pendiente · pending |

**🇪🇸**
- Las fichas de micrófono y cascos son botones: silenciar y ensordecer desde la app (se ven en rojo apagados). Lo aplica el
  servidor y `/vc` en el juego lo muestra al momento. El alcance sigue eligiéndose en `/vc`.
- Seguridad (OWASP MASVS, ver [docs/es/SEGURIDAD.md](docs/es/SEGURIDAD.md)): un enlace externo pide confirmación antes de
  vincular, Android sin copias de seguridad ni tráfico en claro, permisos que no se usan quitados, WebView más cerrado y
  manifiesto de privacidad de iOS.
- Ficha «Radios» (solo se muestra; se cambia en `/vc`) y `radio.minetoy.fun` dentro de la app, para el panel de radios y el
  inicio de sesión único de la web.

**🇬🇧**
- The microphone and headphone chips are buttons: mute and deafen from the app (red when off). The server applies it and
  `/vc` in game shows it straight away. Range is still chosen in `/vc`.
- Security (OWASP MASVS, see [docs/en/SECURITY.md](docs/en/SECURITY.md)): an external link asks for confirmation before
  linking, Android with no backups or cleartext traffic, unused permissions removed, tighter WebView and an iOS privacy
  manifest.
- "Radios" chip (display only; changed in `/vc`) and `radio.minetoy.fun` inside the app, for the radio panel and the
  website single sign-on.

## 0.5.0 — sin publicar · unreleased

| | |
|---|---|
| Android | APK firmado (prerelease `android-pruebas`) · signed APK |
| iOS | IPA sin firma para Sideloadly (prerelease `ios-pruebas`) · unsigned IPA for Sideloadly |
| Verificado · Verified | pendiente · pending |

**🇪🇸**
- Volumen del micrófono (0–200 %) como en la web. Lo aplican los que te oyen: necesita la versión nueva de voz-control.
- Nada bajo la barra de estado ni la isla dinámica (las pestañas ignoraban el área segura de arriba).
- Cambio de pestaña sin fogonazo oscuro (fundido por encima) y Votar/Ranking precargadas.
- Tocar la pestaña activa sube arriba (y luego a la portada) en vez de recargar.
- Pantalla de error propia con «Reintentar»; si el sistema mata la web, se rehace.
- Arreglado: en una instalación nueva los volúmenes empezaban en 0 %.
- Menos batería: el nivel del micro solo se mide con la pestaña de voz a la vista; guardado de volúmenes agrupado.
- iPad: columna central y pantalla completa. El teclado ya no deja la barra encima en Android.

**🇬🇧**
- Microphone volume (0–200 %) like on the website. Applied by whoever hears you: needs the new voz-control.
- Nothing under the status bar or Dynamic Island (tabs ignored the top safe area).
- Tab switching without a dark flash (cross-fade on top) and Vote/Ranking preloaded.
- Tapping the active tab scrolls to the top (then to its home page) instead of reloading.
- Own error screen with "Try again"; if the system kills the web view, it is rebuilt.
- Fixed: on a fresh install the volumes started at 0 %.
- Less battery: mic level is only measured while the voice tab is visible; volume saves are batched.
- iPad: centred column and full screen. On Android the keyboard no longer pushes the tab bar up.

## 0.4.0 — sin publicar · unreleased

| | |
|---|---|
| Android | APK firmado (prerelease `android-pruebas`) · signed APK |
| iOS | IPA sin firma para Sideloadly (prerelease `ios-pruebas`) · unsigned IPA for Sideloadly |
| Verificado · Verified | pendiente · pending (0.2.0: voz verificada en teléfono · voice verified on a phone) |

**🇪🇸**
- La pestaña de voz con el diseño de voicechat.minetoy.fun: intro, tarjeta con la pastilla de estado, el anillo de
  72 barras que se mueve con tu voz, fichas con iconos, tarjeta de volumen y vinculación por pasos con visor de QR.
- Barra de pestañas nueva: iconos de la web (lucide), píldora en la pestaña activa, punto de estado en Voz y vibración
  al cambiar. Fuentes de la web (Outfit e Inter) y barra de carga en las pestañas web.

**🇬🇧**
- The voice tab with the voicechat.minetoy.fun design: intro, card with the status pill, the 72-bar ring that moves
  with your voice, chips with icons, volume card and step-by-step linking with a QR viewfinder.
- New tab bar: the website's icons (lucide), a pill on the active tab, a status dot on Voice and a haptic tap on switch.
  The website's fonts (Outfit and Inter) and a loading bar on the web tabs.

## 0.3.0 — sin publicar · unreleased

| | |
|---|---|
| Android | APK firmado, solo arm64-v8a y armeabi-v7a (prerelease `android-pruebas`) · signed APK, arm64-v8a and armeabi-v7a only |
| iOS | IPA sin firma para Sideloadly (prerelease `ios-pruebas`) · unsigned IPA for Sideloadly |
| Verificado · Verified | pendiente · pending |

**🇪🇸**
- Pestañas Tienda · Votar · Ranking · Voz: la web de MineToy dentro de la app (solo sus dominios; el resto, pagos
  incluidos, se abre en el navegador) y la voz nativa. Los enlaces de voicechat llevan a la pestaña de voz.
- El APK solo lleva las arquitecturas de los teléfonos reales (antes 142 MB).

**🇬🇧**
- Store · Vote · Ranking · Voice tabs: the MineToy website inside the app (its domains only; everything else, payments
  included, opens in the browser) and native voice. voicechat links go to the voice tab.
- The APK only carries real phones' architectures (was 142 MB).

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
