/**
 * Solo las arquitecturas de los teléfonos reales (arm64-v8a y armeabi-v7a) en el APK de Android.
 *
 * Sin esto, el APK lleva las librerías nativas (WebRTC, Hermes, React Native, el lector de QR) también para x86 y x86_64,
 * que solo usan los emuladores: 137 MB en 0.3.0, 74 MB de ellos para x86. Un `ndk.abiFilters` propio no sirve: el plugin
 * de Gradle de React Native añade los suyos (las cuatro) y se suman. Se fija la propiedad que lee ese plugin.
 */
const { withGradleProperties } = require("expo/config-plugins");

const CLAVE = "reactNativeArchitectures";
const VALOR = "arm64-v8a,armeabi-v7a";

module.exports = function abisAndroid(config) {
  return withGradleProperties(config, (c) => {
    c.modResults = c.modResults.filter((p) => !(p.type === "property" && p.key === CLAVE));
    c.modResults.push({ type: "property", key: CLAVE, value: VALOR });
    return c;
  });
};
