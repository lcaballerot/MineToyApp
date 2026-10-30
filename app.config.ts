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
    // Solo vertical: en iPad, a pantalla completa (sin Split View, que exige todas las orientaciones).
    requireFullScreen: true,
    infoPlist: {
      // Audio en segundo plano: la voz sigue con Minecraft delante. Sin `voip` (no se usa CallKit; ADR-0001).
      UIBackgroundModes: ["audio"],
    },
    // Universal Links del enlace de /vc. Necesita la cuenta de Apple Developer (con un Apple ID gratuito no se firman).
    ...(process.env.MINETOY_APPLE_TEAM ? { associatedDomains: ["applinks:voicechat.minetoy.fun"] } : {}),
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
    // App Links verificados del enlace de /vc (assetlinks.json de voz-control con la huella del keystore).
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [{ scheme: "https", host: "voicechat.minetoy.fun" }],
        category: ["BROWSABLE", "DEFAULT"],
      },
    ],
  },
  plugins: [
    "expo-localization",
    [
      "@config-plugins/react-native-webrtc",
      {
        microphonePermission: "MineToy usa el micrófono para el chat de voz por proximidad del servidor.",
        cameraPermission: "MineToy usa la cámara para escanear el código QR de /vc.",
      },
    ],
    [
      "expo-camera",
      {
        cameraPermission: "MineToy usa la cámara para escanear el código QR de /vc.",
        microphonePermission: "MineToy usa el micrófono para el chat de voz por proximidad del servidor.",
        recordAudioAndroid: true,
      },
    ],
    ["expo-splash-screen", { image: "./assets/splash-icon.png", imageWidth: 200, resizeMode: "contain", backgroundColor: FONDO }],
    "./plugins/firma-android.js",
    "./plugins/proguard-webrtc.js",
    "./plugins/abis-android.js",
  ],
};

export default config;
