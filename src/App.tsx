import { getLocales } from "expo-localization";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef, useState } from "react";
import { BackHandler, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";

import { colores } from "./tema";
import PantallaVoz, { motorVoz } from "./voz/PantallaVoz";
import { leerVinculo } from "./voz/motor";
import PestanaWeb, { type ControlWeb } from "./web/PestanaWeb";

type Id = "tienda" | "votar" | "ranking" | "voz";
const en = getLocales()[0]?.languageCode === "en";
const PESTANAS: { id: Id; nombre: string; icono: string; url?: string }[] = [
  { id: "tienda", nombre: en ? "Store" : "Tienda", icono: "🛒", url: en ? "https://store.minetoy.fun/en" : "https://store.minetoy.fun" },
  { id: "votar", nombre: en ? "Vote" : "Votar", icono: "🗳️", url: en ? "https://vote.minetoy.fun/en" : "https://vote.minetoy.fun" },
  { id: "ranking", nombre: "Ranking", icono: "🏆", url: en ? "https://store.minetoy.fun/en/ranking" : "https://store.minetoy.fun/ranking" },
  { id: "voz", nombre: en ? "Voice" : "Voz", icono: "🎙️" },
];

export default function App() {
  const [activa, setActiva] = useState<Id>("tienda");
  // Cada web se monta la primera vez que se abre y luego se queda viva (conserva la página y la sesión).
  const [montadas, setMontadas] = useState<Set<Id>>(() => new Set<Id>(["tienda"]));
  const webs = useRef<Partial<Record<Id, ControlWeb | null>>>({});

  function ir(id: Id) {
    if (id === activa && id !== "voz") webs.current[id]?.inicio();
    setActiva(id);
    setMontadas((m) => (m.has(id) ? m : new Set(m).add(id)));
  }

  // Un enlace de voz (desde la web, la cámara del sistema o otra app): a la pestaña de voz y, si trae código, vincular.
  function abrirVoz(url: string) {
    ir("voz");
    if (leerVinculo(url)) void motorVoz().vincular(url);
  }

  useEffect(() => {
    const abrir = (url: string | null | undefined) => {
      if (url && leerVinculo(url)) abrirVoz(url);
    };
    void Linking.getInitialURL().then(abrir);
    const sub = Linking.addEventListener("url", (e) => abrir(e.url));
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Botón atrás de Android: primero dentro de la web de la pestaña.
  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => webs.current[activa]?.atras() ?? false);
    return () => sub.remove();
  }, [activa]);

  return (
    <SafeAreaProvider>
      <SafeAreaView style={e.raiz} edges={["top", "bottom"]}>
        <View style={e.contenido}>
          {PESTANAS.map((p) =>
            montadas.has(p.id) ? (
              <View key={p.id} style={[e.capa, p.id !== activa && e.oculta]}>
                {p.url ? (
                  <PestanaWeb ref={(r) => void (webs.current[p.id] = r)} url={p.url} alAbrirVoz={abrirVoz} />
                ) : (
                  <PantallaVoz />
                )}
              </View>
            ) : null,
          )}
        </View>
        <View style={e.barra}>
          {PESTANAS.map((p) => (
            <Pressable key={p.id} onPress={() => ir(p.id)} style={e.boton} accessibilityRole="tab" accessibilityState={{ selected: p.id === activa }}>
              <Text style={e.icono}>{p.icono}</Text>
              <Text style={[e.nombre, p.id === activa && e.nombreActivo]}>{p.nombre}</Text>
            </Pressable>
          ))}
        </View>
      </SafeAreaView>
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

const e = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  contenido: { flex: 1 },
  capa: { ...StyleSheet.absoluteFill },
  oculta: { display: "none" },
  barra: { flexDirection: "row", borderTopWidth: 1, borderTopColor: colores.fondoAlto, backgroundColor: colores.fondo },
  boton: { flex: 1, alignItems: "center", paddingVertical: 8 },
  icono: { fontSize: 20 },
  nombre: { color: colores.apagado, fontSize: 12, marginTop: 2 },
  nombreActivo: { color: colores.oro, fontWeight: "700" },
});
