/**
 * Reglas de R8 para WebRTC en la compilación release de Android.
 *
 * La librería `org.jitsi:webrtc` referencia clases nativas que no trae (p. ej. `org.webrtc.Dav1dDecoder$Natives`) y R8
 * falla con «Missing class». Además WebRTC llama a Java desde C++ por JNI: si R8 renombra o quita esas clases, la app
 * se cae en tiempo de ejecución. Se conservan enteras.
 */
const fs = require("node:fs");
const path = require("node:path");
const { withDangerousMod } = require("expo/config-plugins");

const MARCA = "# minetoy:webrtc";
const REGLAS = `
${MARCA}
-keep class org.webrtc.** { *; }
-dontwarn org.webrtc.**
`;

module.exports = function proguardWebrtc(config) {
  return withDangerousMod(config, [
    "android",
    (c) => {
      const fichero = path.join(c.modRequest.platformProjectRoot, "app", "proguard-rules.pro");
      const actual = fs.existsSync(fichero) ? fs.readFileSync(fichero, "utf8") : "";
      if (!actual.includes(MARCA)) fs.writeFileSync(fichero, actual + REGLAS);
      return c;
    },
  ]);
};
