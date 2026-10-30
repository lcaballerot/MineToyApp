import type { ExpoConfig } from "expo/config";
import { version } from "./package.json";

/** 0.1.0 → 100, 1.2.3 → 10203: número de compilación creciente para las tiendas, sacado de la versión. */
function numeroCompilacion(v: string): number {
  const [mayor, menor, parche] = v.split(".").map((n) => Number.parseInt(n, 10));
  return mayor * 10000 + menor * 100 + parche;
}

const FONDO = "#0a0613"; // void-900 de la web
const ID = "fun.minetoy.app";

const config: ExpoConfig = {
  name: "MineToy",
  slug: "minetoy",
  scheme: "minetoy",
  version,
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "dark",
  backgroundColor: FONDO,
  ios: {
    bundleIdentifier: ID,
    buildNumber: String(numeroCompilacion(version)),
    supportsTablet: true,
  },
  android: {
    package: ID,
    versionCode: numeroCompilacion(version),
    adaptiveIcon: {
      backgroundColor: FONDO,
      foregroundImage: "./assets/android-icon-foreground.png",
      backgroundImage: "./assets/android-icon-background.png",
      monochromeImage: "./assets/android-icon-monochrome.png",
    },
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-localization",
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: FONDO }],
    "./plugins/firma-android.js",
  ],
};

export default config;
