/**
 * Solo las arquitecturas de los teléfonos reales (arm64-v8a y armeabi-v7a) en el APK de Android.
 *
 * Sin filtro, el APK lleva las librerías nativas (WebRTC, Hermes, React Native) también para x86 y x86_64, que solo usan
 * los emuladores: 142 MB en 0.2.0. `abiFilters` se aplica también a las librerías que vienen precompiladas en AAR.
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const MARCA = "// minetoy:abis";

module.exports = function abisAndroid(config) {
  return withAppBuildGradle(config, (c) => {
    let gradle = c.modResults.contents;
    if (gradle.includes(MARCA)) return c;
    const defecto = /defaultConfig\s*\{/;
    if (!defecto.test(gradle)) throw new Error("abis-android: no encuentro defaultConfig en app/build.gradle");
    gradle = gradle.replace(defecto, (m) => `${m}\n        ndk { abiFilters "arm64-v8a", "armeabi-v7a" } ${MARCA}`);
    c.modResults.contents = gradle;
    return c;
  });
};
