/**
 * Endurecimiento del manifiesto de Android (OWASP MASVS-NETWORK y MASVS-STORAGE):
 * - Sin tráfico en claro: todo es HTTPS/WSS; `usesCleartextTraffic="false"` lo hace cumplir también a las librerías.
 * - Sin copia de seguridad ni transferencia entre dispositivos: el token de voz no debe salir del teléfono
 *   (Keystore ya no se copia, pero así tampoco las preferencias ni la caché de la web).
 */
const { withAndroidManifest } = require("expo/config-plugins");

module.exports = function seguridadAndroid(config) {
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application?.[0];
    if (app) {
      app.$["android:usesCleartextTraffic"] = "false";
      app.$["android:allowBackup"] = "false";
      app.$["android:fullBackupContent"] = "false";
      delete app.$["android:dataExtractionRules"];
    }
    return c;
  });
};
