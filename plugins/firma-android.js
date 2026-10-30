/**
 * Firma de la compilación release de Android con el keystore de MineToy.
 *
 * `expo prebuild` genera `android/app/build.gradle` firmando el release con la clave de depuración. Este plugin añade
 * `signingConfigs.release` leída de propiedades de Gradle (en CI: `-PMINETOY_KEYSTORE=…` y compañía, desde los
 * secretos del repo). Sin esas propiedades el release sigue firmado con la de depuración, para compilar en local.
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const MARCA = "// minetoy:firma";

const CONFIG_FIRMA = `
        release { ${MARCA}
            if (project.hasProperty('MINETOY_KEYSTORE')) {
                storeFile file(MINETOY_KEYSTORE)
                storePassword MINETOY_KEYSTORE_CLAVE
                keyAlias MINETOY_ALIAS
                keyPassword MINETOY_ALIAS_CLAVE
            }
        }`;

module.exports = function firmaAndroid(config) {
  return withAppBuildGradle(config, (c) => {
    let gradle = c.modResults.contents;
    if (gradle.includes(MARCA)) return c;

    // 1) Añadir la configuración dentro de signingConfigs { … } (la plantilla trae solo `debug`).
    const firmas = /signingConfigs\s*\{/;
    if (!firmas.test(gradle)) throw new Error("firma-android: no encuentro signingConfigs en app/build.gradle");
    gradle = gradle.replace(firmas, (m) => `${m}${CONFIG_FIRMA}`);

    // 2) En buildTypes.release, usarla cuando exista el keystore.
    const release = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/;
    if (!release.test(gradle)) throw new Error("firma-android: no encuentro el signingConfig del release");
    gradle = gradle.replace(
      release,
      "$1signingConfig project.hasProperty('MINETOY_KEYSTORE') ? signingConfigs.release : signingConfigs.debug",
    );

    c.modResults.contents = gradle;
    return c;
  });
};
