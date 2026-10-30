import { Inter_400Regular } from "@expo-google-fonts/inter/400Regular";
import { Inter_600SemiBold } from "@expo-google-fonts/inter/600SemiBold";
import { Outfit_600SemiBold } from "@expo-google-fonts/outfit/600SemiBold";
import { Outfit_700Bold } from "@expo-google-fonts/outfit/700Bold";
import { Outfit_800ExtraBold } from "@expo-google-fonts/outfit/800ExtraBold";
import { useFonts } from "expo-font";
import * as Haptics from "expo-haptics";
import { getLocales } from "expo-localization";
import { LinearGradient } from "expo-linear-gradient";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { AudioLines, ShoppingBag, Trophy, Vote, type LucideIcon } from "lucide-react-native";
import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { Animated, AppState, BackHandler, Keyboard, Linking, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from "react-native-safe-area-context";

import { blanco, colores, fuentes } from "./tema";
import { alfa } from "./ui/piezas";
import PantallaVoz, { estadoVoz, motorVoz } from "./voz/PantallaVoz";
import { leerVinculo } from "./voz/motor";
import PestanaWeb, { type ControlWeb } from "./web/PestanaWeb";

void SplashScreen.preventAutoHideAsync().catch(() => {});

type Id = "tienda" | "votar" | "ranking" | "voz";
const en = getLocales()[0]?.languageCode === "en";
const PESTANAS: { id: Id; nombre: string; Icono: LucideIcon; url?: string }[] = [
  {
    id: "tienda",
    nombre: en ? "Store" : "Tienda",
    Icono: ShoppingBag,
    url: en ? "https://store.minetoy.fun/en" : "https://store.minetoy.fun",
  },
  {
    id: "votar",
    nombre: en ? "Vote" : "Votar",
    Icono: Vote,
    url: en ? "https://vote.minetoy.fun/en" : "https://vote.minetoy.fun",
  },
  {
    id: "ranking",
    nombre: "Ranking",
    Icono: Trophy,
    url: en ? "https://store.minetoy.fun/en/ranking" : "https://store.minetoy.fun/ranking",
  },
  { id: "voz", nombre: en ? "Voice" : "Voz", Icono: AudioLines },
];

export default function App() {
  const [fuentesListas, fallo] = useFonts({
    Outfit_600SemiBold,
    Outfit_700Bold,
    Outfit_800ExtraBold,
    Inter_400Regular,
    Inter_600SemiBold,
  });
  const listo = fuentesListas || !!fallo;
  useEffect(() => {
    if (listo) void SplashScreen.hideAsync().catch(() => {});
  }, [listo]);
  if (!listo) return null;
  return (
    <SafeAreaProvider initialMetrics={initialWindowMetrics}>
      <Raiz />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

function Raiz() {
  const [activa, setActiva] = useState<Id>("tienda");
  // Las pestañas se quedan vivas (conservan la página y la sesión). La tienda se monta al abrir y las otras dos webs
  // poco después, en segundo plano, para que al cambiar ya estén cargadas. La voz, al abrirla (pide el micrófono).
  const [montadas, setMontadas] = useState<Set<Id>>(() => new Set<Id>(["tienda"]));
  const webs = useRef<Partial<Record<Id, ControlWeb | null>>>({});
  const { top } = useSafeAreaInsets();

  const [primerPlano, setPrimerPlano] = useState(AppState.currentState === "active");
  const [teclado, setTeclado] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setMontadas((m) => new Set([...m, "votar", "ranking"])), 1500);
    const app = AppState.addEventListener("change", (s) => setPrimerPlano(s === "active"));
    // En Android la ventana se encoge con el teclado (adjustResize) y la barra subiría encima de él: se esconde.
    const ver = Keyboard.addListener("keyboardDidShow", () => Platform.OS === "android" && setTeclado(true));
    const quitar = Keyboard.addListener("keyboardDidHide", () => setTeclado(false));
    return () => {
      clearTimeout(t);
      app.remove();
      ver.remove();
      quitar.remove();
    };
  }, []);

  function ir(id: Id) {
    Keyboard.dismiss();
    if (id !== activa) void Haptics.selectionAsync().catch(() => {});
    else if (id !== "voz") webs.current[id]?.inicio();
    setActiva(id);
    setMontadas((m) => (m.has(id) ? m : new Set(m).add(id)));
  }

  // Un enlace de voz (desde la web, la cámara del sistema u otra app): a la pestaña de voz y, si trae código, vincular.
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
    <View style={e.raiz}>
      {/* Un margen, no padding: las capas son absolutas y en Yoga ignoran el padding del padre (quedaban bajo la isla). */}
      <View style={[e.contenido, { marginTop: top }]}>
        {PESTANAS.map((p) =>
          montadas.has(p.id) ? (
            <Capa key={p.id} activa={p.id === activa}>
              {p.url ? (
                <PestanaWeb ref={(r) => void (webs.current[p.id] = r)} url={p.url} alAbrirVoz={abrirVoz} />
              ) : (
                <PantallaVoz visible={activa === "voz" && primerPlano} />
              )}
            </Capa>
          ) : null,
        )}
      </View>
      {!teclado && <Barra activa={activa} ir={ir} vozMontada={montadas.has("voz")} />}
    </View>
  );
}

const FUNDIDO = 160;

/**
 * Una pestaña: todas siguen pintadas una encima de otra. Con `display: none` el sistema rehace el WebView al volver a
 * mostrarlo y se veía un fogonazo oscuro. La que entra se funde por encima; la que sale sigue opaca debajo hasta que
 * termina el fundido (si bajaran las dos a la vez, a mitad se vería el fondo oscuro).
 */
function Capa({ activa, children }: { activa: boolean; children: ReactNode }) {
  const opacidad = useRef(new Animated.Value(activa ? 1 : 0)).current;
  useEffect(() => {
    if (activa) {
      Animated.timing(opacidad, { toValue: 1, duration: FUNDIDO, useNativeDriver: true }).start();
      return;
    }
    const t = setTimeout(() => opacidad.setValue(0), FUNDIDO + 20);
    return () => clearTimeout(t);
  }, [activa, opacidad]);
  return (
    <Animated.View
      style={[e.capa, { opacity: opacidad, zIndex: activa ? 1 : 0 }]}
      pointerEvents={activa ? "auto" : "none"}
      accessibilityElementsHidden={!activa}
      importantForAccessibility={activa ? "auto" : "no-hide-descendants"}
    >
      {children}
    </Animated.View>
  );
}

/* ---------------------------------------------------------------- barra de pestañas */
function Barra({ activa, ir, vozMontada }: { activa: Id; ir: (id: Id) => void; vozMontada: boolean }) {
  const { bottom } = useSafeAreaInsets();
  return (
    <View style={[e.barra, { paddingBottom: Math.max(bottom, 10) }]}>
      <LinearGradient colors={[colores.fondoAlto, colores.vacio950]} style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={["transparent", alfa(colores.portal400, 0.45), "transparent"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={e.barraFilo}
      />
      {PESTANAS.map((p) => (
        <BotonPestana key={p.id} p={p} activa={p.id === activa} onPress={() => ir(p.id)}>
          {p.id === "voz" && vozMontada ? <PuntoVoz /> : null}
        </BotonPestana>
      ))}
    </View>
  );
}

function BotonPestana({
  p,
  activa,
  onPress,
  children,
}: {
  p: (typeof PESTANAS)[number];
  activa: boolean;
  onPress: () => void;
  children?: ReactNode;
}) {
  const v = useRef(new Animated.Value(activa ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, {
      toValue: activa ? 1 : 0,
      useNativeDriver: true,
      speed: 18,
      bounciness: 6,
    }).start();
  }, [activa, v]);
  const { Icono } = p;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [e.boton, pressed && { opacity: 0.75 }]}
      accessibilityRole="tab"
      accessibilityLabel={p.nombre}
      accessibilityState={{ selected: activa }}
      hitSlop={4}
    >
      <View style={e.icono}>
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            e.pildora,
            {
              opacity: v,
              transform: [
                {
                  scaleX: v.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.6, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <LinearGradient
            colors={["rgba(168,85,247,0.32)", "rgba(168,85,247,0.12)"]}
            style={[StyleSheet.absoluteFill, { borderRadius: 999 }]}
          />
        </Animated.View>
        <Icono size={22} strokeWidth={activa ? 2.1 : 1.8} color={activa ? colores.portal200 : blanco(0.45)} />
        {children}
      </View>
      <Text style={[e.nombre, activa && e.nombreActivo]} numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.3}>
        {p.nombre}
      </Text>
    </Pressable>
  );
}

/** Punto en la pestaña de voz: verde si hablas con el juego, ámbar si falta algo. Solo cuando la voz ya se abrió. */
function PuntoVoz() {
  const motor = motorVoz();
  const s = useSyncExternalStore(motor.suscribir, motor.leer);
  const { categoria } = estadoVoz(s);
  const color =
    categoria === "activo"
      ? colores.exito
      : categoria === "esperando" || categoria === "conectando"
        ? colores.oro
        : categoria === "error"
          ? colores.error
          : null;
  if (!color) return null;
  return <View style={[e.punto, { backgroundColor: color, boxShadow: `0 0 8px ${color}` }]} />;
}

const e = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  contenido: { flex: 1, overflow: "hidden" },
  capa: { ...StyleSheet.absoluteFill },
  barra: {
    flexDirection: "row",
    paddingTop: 8,
    paddingHorizontal: 8,
    overflow: "hidden",
  },
  barraFilo: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth * 2,
  },
  boton: { flex: 1, alignItems: "center", gap: 4 },
  icono: {
    width: 60,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  pildora: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.35)",
    boxShadow: "0 6px 20px -8px rgba(168,85,247,0.75)",
  },
  nombre: {
    fontFamily: fuentes.boton,
    fontSize: 11.5,
    color: blanco(0.45),
    letterSpacing: 0.1,
  },
  nombreActivo: { color: "#ffffff" },
  punto: {
    position: "absolute",
    top: 4,
    right: 14,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: colores.fondo,
  },
});
