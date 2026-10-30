import { Platform } from "react-native";

/** Colores de la web (`web/src/app/globals.css`): fondo «void», morado «portal», rosa «shard» y oro «royal». */
export const colores = {
  vacio950: "#050309",
  fondo: "#0a0613", // void-900
  fondoAlto: "#170e2b", // void-800
  portal200: "#e9d5ff",
  portal300: "#d8b4fe",
  portal400: "#c084fc",
  morado: "#a855f7", // portal-500
  portal700: "#7e22ce",
  lila: "#e879f9", // shard-400
  oroClaro: "#fde68a", // royal-200
  oro300: "#fcd34d",
  oro: "#fbbf24", // royal-400
  oro500: "#f59e0b",
  texto: "#e9d5ff",
  apagado: "#9a90b3",
  exito: "#4ade80",
  error: "#f87171",
} as const;

/** Blanco con transparencia, como `text-white/60` o `bg-white/[0.04]` en la web. */
export const blanco = (a: number) => `rgba(255,255,255,${a})`;

/** Outfit en titulares y botones (`--font-display`), Inter en el texto (`--font-sans`). Se cargan en App. */
export const fuentes = {
  titular: "Outfit_800ExtraBold",
  titularFuerte: "Outfit_700Bold",
  boton: "Outfit_600SemiBold",
  texto: "Inter_400Regular",
  textoFuerte: "Inter_600SemiBold",
  mono: Platform.select({ ios: "Menlo", default: "monospace" }),
} as const;
