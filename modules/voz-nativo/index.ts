/**
 * Lo nativo de la voz que React Native no trae:
 * - iOS: sesión de audio `playAndRecord` + `mixWithOthers` para que el juego siga sonando, y reactivarla tras una
 *   interrupción (una llamada, Siri, otra app que se queda el audio).
 * - Android: servicio en primer plano de tipo micrófono con la notificación «Chat de voz activo» y el botón «Colgar».
 */
import { Platform } from "react-native";
import { requireNativeModule } from "expo";

type Suscripcion = { remove(): void };

interface VozNativoNativo {
  configurarAudio(): void;
  iniciarServicio(titulo: string, texto: string, colgar: string): void;
  pararServicio(): void;
  addListener(evento: "onColgar" | "onInterrupcion", f: (e: { fin?: boolean }) => void): Suscripcion;
}

const nativo = requireNativeModule<VozNativoNativo>("VozNativo");

/** iOS: aplica la sesión de audio que mezcla con otras apps. Llamar antes de abrir el micrófono. En Android no hace nada. */
export function configurarAudio(): void {
  if (Platform.OS === "ios") nativo.configurarAudio();
}

/** Android: notificación fija mientras dura la llamada. En iOS no hace nada (el audio en segundo plano basta). */
export function iniciarServicio(titulo: string, texto: string, colgar: string): void {
  if (Platform.OS === "android") nativo.iniciarServicio(titulo, texto, colgar);
}

export function pararServicio(): void {
  if (Platform.OS === "android") nativo.pararServicio();
}

/** El jugador pulsó «Colgar» en la notificación (Android). */
export function alColgar(f: () => void): Suscripcion {
  return nativo.addListener("onColgar", () => f());
}

/** iOS: terminó una interrupción del audio y la sesión se volvió a activar. */
export function alVolverAudio(f: () => void): Suscripcion {
  return nativo.addListener("onInterrupcion", (e) => {
    if (e.fin) f();
  });
}
