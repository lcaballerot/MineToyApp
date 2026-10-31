/**
 * Endurecimiento del manifiesto de Android (OWASP MASVS-NETWORK y MASVS-STORAGE):
 * - Sin tráfico en claro: todo es HTTPS/WSS; `usesCleartextTraffic="false"` lo hace cumplir también a las librerías.
 * - Sin copia de seguridad ni transferencia entre dispositivos: el token de voz no debe salir del teléfono
 *   (Keystore ya no se copia, pero así tampoco las preferencias ni la caché de la web).
 * - `network_security_config`: lo mismo por escrito (sin texto en claro) y solo las CA del sistema, nunca las que
 *   instale el usuario (un proxy de intercepción no ve el tráfico de la app).
 */
const fs = require("fs");
const path = require("path");
const { withAndroidManifest, withDangerousMod } = require("expo/config-plugins");

const RED = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>
</network-security-config>
`;

module.exports = function seguridadAndroid(config) {
  config = withDangerousMod(config, [
    "android",
    (c) => {
      const dir = path.join(c.modRequest.platformProjectRoot, "app/src/main/res/xml");
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, "network_security_config.xml"), RED);
      return c;
    },
  ]);
  return withAndroidManifest(config, (c) => {
    const app = c.modResults.manifest.application?.[0];
    if (app) {
      app.$["android:usesCleartextTraffic"] = "false";
      app.$["android:allowBackup"] = "false";
      app.$["android:fullBackupContent"] = "false";
      app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
      delete app.$["android:dataExtractionRules"];
    }
    return c;
  });
};
