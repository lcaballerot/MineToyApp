import { getLocales } from "expo-localization";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";

import { colores } from "./tema";

// Pantalla provisional del paso 3: solo demuestra que la app compila y arranca en las dos plataformas.
const TEXTOS = {
  es: { hola: "Hola", detalle: "La app de MineToy está en construcción." },
  en: { hola: "Hello", detalle: "The MineToy app is under construction." },
};

export default function App() {
  const t = getLocales()[0]?.languageCode === "en" ? TEXTOS.en : TEXTOS.es;
  return (
    <View style={estilos.fondo}>
      <Text style={estilos.marca}>MineToy</Text>
      <Text style={estilos.hola}>{t.hola}</Text>
      <Text style={estilos.detalle}>{t.detalle}</Text>
      <StatusBar style="light" />
    </View>
  );
}

const estilos = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colores.fondo, alignItems: "center", justifyContent: "center", padding: 24 },
  marca: { color: colores.oro, fontSize: 40, fontWeight: "800", letterSpacing: 1 },
  hola: { color: colores.lila, fontSize: 24, fontWeight: "600", marginTop: 12 },
  detalle: { color: colores.texto, fontSize: 15, marginTop: 8, textAlign: "center" },
});
