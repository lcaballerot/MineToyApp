import { LinearGradient } from "expo-linear-gradient";
import type { LucideIcon } from "lucide-react-native";
import { useEffect, useMemo, useRef, useState, type ComponentRef, type ReactNode } from "react";
import { Animated, Pressable, StyleSheet, Text, View, type GestureResponderEvent, type StyleProp, type ViewStyle } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { blanco, colores, fuentes } from "../tema";

/**
 * Piezas de la interfaz copiadas de la web (`web/src/app/globals.css` y `components/ui.tsx`): superficies `t-surface`,
 * mosaicos `t-tile`, botones `royal`/`primary`, la pastilla de estado y el deslizador de la voz (`voz.css`).
 */

/* ---------------------------------------------------------------- colores */
function rgb(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** `color-mix(in srgb, a p, b)`. */
function mezclar(a: string, b: string, p: number): string {
  const [x, y] = [rgb(a), rgb(b)];
  return `rgb(${x.map((v, i) => Math.round(v * p + y[i] * (1 - p))).join(",")})`;
}
export function alfa(hex: string, a: number): string {
  return `rgba(${rgb(hex).join(",")},${a})`;
}

/* ---------------------------------------------------------------- superficie */
/** Tarjeta `t-surface`; `brillo` añade el resplandor de `vt-hero` (morado arriba a la izquierda, oro a la derecha). */
export function Superficie({ children, brillo, style }: { children: ReactNode; brillo?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[e.superficie, style]}>
      <LinearGradient colors={[blanco(0.055), blanco(0.02)]} style={StyleSheet.absoluteFill} />
      {brillo && (
        <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
          <Defs>
            <RadialGradient id="a" cx="0%" cy="0%" rx="60%" ry="120%" fx="0%" fy="0%">
              <Stop offset="0" stopColor={colores.morado} stopOpacity={0.22} />
              <Stop offset="0.7" stopColor={colores.morado} stopOpacity={0} />
            </RadialGradient>
            <RadialGradient id="b" cx="100%" cy="0%" rx="40%" ry="90%" fx="100%" fy="0%">
              <Stop offset="0" stopColor={colores.oro} stopOpacity={0.1} />
              <Stop offset="0.7" stopColor={colores.oro} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect width="100%" height="100%" fill="url(#a)" />
          <Rect width="100%" height="100%" fill="url(#b)" />
        </Svg>
      )}
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- mosaico */
/** Icono en su baldosa `t-tile`, teñida con `acento`. */
export function Mosaico({
  Icono,
  acento = colores.morado,
  lado = 64,
  radio = 24,
}: {
  Icono: LucideIcon;
  acento?: string;
  lado?: number;
  radio?: number;
}) {
  const id = useMemo(() => `m${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <View
      style={{
        width: lado,
        height: lado,
        borderRadius: radio,
        overflow: "hidden",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: mezclar(acento, colores.fondo, 0.1),
        borderWidth: 1,
        borderColor: alfa(acento, 0.38),
        boxShadow: `0 12px 30px -14px ${alfa(acento, 0.7)}`,
      }}
    >
      <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
        <Defs>
          <RadialGradient id={id} cx="30%" cy="0%" rx="120%" ry="120%" fx="30%" fy="0%">
            <Stop offset="0" stopColor={acento} stopOpacity={0.4} />
            <Stop offset="0.75" stopColor={acento} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
      <View style={[StyleSheet.absoluteFill, { borderRadius: radio, borderTopWidth: 1, borderColor: blanco(0.12) }]} pointerEvents="none" />
      <Icono size={lado * 0.47} strokeWidth={1.8} color={mezclar(acento, "#ffffff", 0.55)} />
    </View>
  );
}

/* ---------------------------------------------------------------- botón */
type Variante = "royal" | "primary" | "ghost";
const DEGRADADOS: Record<
  Exclude<Variante, "ghost">,
  {
    colores: [string, string, ...string[]];
    puntos: [number, number, ...number[]];
  }
> = {
  royal: {
    colores: [colores.oroClaro, colores.oro, colores.oro500],
    puntos: [0, 0.55, 1],
  },
  primary: { colores: [colores.morado, colores.portal700], puntos: [0, 1] },
};
const SOMBRAS: Record<Variante, string> = {
  royal: "0 10px 30px -10px rgba(251,191,36,0.65)",
  primary: "0 10px 30px -12px rgba(168,85,247,0.8)",
  ghost: "0 0 0 0 transparent",
};

/** Botón pastilla de la tienda: `royal` (oro) para la acción principal, `primary` (portal) y `ghost` para lo demás. */
export function Boton({
  texto,
  onPress,
  variante = "primary",
  Icono,
  desactivado,
  style,
}: {
  texto: string;
  onPress: () => void;
  variante?: Variante;
  Icono?: LucideIcon;
  desactivado?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const color = variante === "royal" ? colores.vacio950 : variante === "ghost" ? blanco(0.9) : "#ffffff";
  const d = variante === "ghost" ? null : DEGRADADOS[variante];
  return (
    <Pressable
      onPress={onPress}
      disabled={desactivado}
      accessibilityRole="button"
      accessibilityState={{ disabled: desactivado }}
      style={({ pressed }) => [
        e.boton,
        { boxShadow: SOMBRAS[variante] },
        variante === "ghost" && e.botonGhost,
        desactivado && { opacity: 0.4 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
        style,
      ]}
    >
      {d && <LinearGradient colors={d.colores} locations={d.puntos} style={[StyleSheet.absoluteFill, { borderRadius: 999 }]} />}
      {/* El brillo de arriba (`inset 0 1px 0 rgba(255,255,255,.5)`). */}
      {d && (
        <View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, e.botonFilo, { borderTopColor: blanco(variante === "royal" ? 0.55 : 0.22) }]}
        />
      )}
      {Icono && <Icono size={19} strokeWidth={2} color={color} />}
      <Text style={[e.botonTexto, { color }]}>{texto}</Text>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- pastilla */
export type Categoria = "conectando" | "activo" | "esperando" | "aviso" | "error" | "neutro";
const PASTILLA: Record<Categoria, { texto: string; fondo: string; borde: string; punto: string }> = {
  activo: {
    texto: colores.exito,
    fondo: "rgba(34,197,94,0.14)",
    borde: "rgba(74,222,128,0.3)",
    punto: colores.exito,
  },
  esperando: {
    texto: colores.oro300,
    fondo: "rgba(251,191,36,0.12)",
    borde: "rgba(251,191,36,0.32)",
    punto: colores.oro,
  },
  aviso: {
    texto: colores.oro300,
    fondo: "rgba(251,191,36,0.12)",
    borde: "rgba(251,191,36,0.32)",
    punto: colores.oro,
  },
  error: {
    texto: colores.error,
    fondo: "rgba(239,68,68,0.12)",
    borde: "rgba(248,113,113,0.32)",
    punto: colores.error,
  },
  conectando: {
    texto: blanco(0.8),
    fondo: blanco(0.06),
    borde: blanco(0.1),
    punto: colores.portal400,
  },
  neutro: {
    texto: blanco(0.8),
    fondo: blanco(0.06),
    borde: blanco(0.1),
    punto: colores.apagado,
  },
};

/** Pastilla de estado (`.vz-pastilla`): el punto parpadea al conectar y brilla al estar activo. */
export function Pastilla({ texto, categoria }: { texto: string; categoria: Categoria }) {
  const c = PASTILLA[categoria];
  const parpadeo = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (categoria !== "conectando") {
      parpadeo.setValue(1);
      return;
    }
    const bucle = Animated.loop(
      Animated.sequence([
        Animated.timing(parpadeo, {
          toValue: 0.3,
          duration: 550,
          useNativeDriver: true,
        }),
        Animated.timing(parpadeo, {
          toValue: 1,
          duration: 550,
          useNativeDriver: true,
        }),
      ]),
    );
    bucle.start();
    return () => bucle.stop();
  }, [categoria, parpadeo]);
  return (
    <View
      style={[e.pastilla, { backgroundColor: c.fondo, borderColor: c.borde }]}
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
    >
      <Animated.View
        style={[
          e.punto,
          { backgroundColor: c.punto, opacity: parpadeo },
          categoria === "activo" && { boxShadow: `0 0 10px ${colores.exito}` },
        ]}
      />
      <Text style={[e.pastillaTexto, { color: c.texto }]}>{texto}</Text>
    </View>
  );
}

/* ---------------------------------------------------------------- textos */
/** Antetítulo `t-eyebrow`. */
export function Antetitulo({ children }: { children: string }) {
  return <Text style={e.antetitulo}>{children.toUpperCase()}</Text>;
}

/** Pinta `/vc` como código dentro de un texto. */
export function ConVc({ texto }: { texto: string }) {
  return (
    <>
      {texto.split(/(\/vc)/).map((t, i) =>
        t === "/vc" ? (
          <Text key={i} style={e.codigo}>
            {" /vc "}
          </Text>
        ) : (
          t
        ),
      )}
    </>
  );
}

/* ---------------------------------------------------------------- deslizador */
/** Deslizador 0–200 % de `.vz-rango`: pista con degradado morado-rosa y pomo de oro. */
export function Deslizador({
  etiqueta,
  valor,
  alCambiar,
  max = 200,
  paso = 5,
}: {
  etiqueta: string;
  valor: number;
  alCambiar: (v: number) => void;
  max?: number;
  paso?: number;
}) {
  const pista = useRef<ComponentRef<typeof View>>(null);
  const caja = useRef({ x: 0, ancho: 1 });
  const [arrastrando, setArrastrando] = useState(false);
  const f = Math.max(0, Math.min(1, valor / max));

  const medir = () => pista.current?.measureInWindow((x, _y, ancho) => (caja.current = { x, ancho: Math.max(1, ancho) }));
  const mover = (ev: GestureResponderEvent) => {
    const p = (ev.nativeEvent.pageX - caja.current.x) / caja.current.ancho;
    const v = Math.round((Math.max(0, Math.min(1, p)) * max) / paso) * paso;
    if (v !== valor) alCambiar(v);
  };
  const cambiarPaso = (d: number) => alCambiar(Math.max(0, Math.min(max, valor + d * paso)));

  return (
    <View>
      <View style={e.deslizadorCabeza}>
        <Text style={e.etiqueta}>{etiqueta.toUpperCase()}</Text>
        <Text style={e.deslizadorValor}>{valor}%</Text>
      </View>
      <View
        ref={pista}
        onLayout={medir}
        style={e.deslizadorZona}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderTerminationRequest={() => false}
        onResponderGrant={(ev) => {
          medir();
          setArrastrando(true);
          mover(ev);
        }}
        onResponderMove={mover}
        onResponderRelease={() => setArrastrando(false)}
        onResponderTerminate={() => setArrastrando(false)}
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={etiqueta}
        accessibilityValue={{ min: 0, max, now: valor, text: `${valor}%` }}
        accessibilityActions={[{ name: "increment" }, { name: "decrement" }]}
        onAccessibilityAction={(a) => cambiarPaso(a.nativeEvent.actionName === "increment" ? 1 : -1)}
      >
        <View style={e.pista}>
          <LinearGradient
            colors={[colores.morado, colores.lila]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ width: `${f * 100}%`, height: "100%", borderRadius: 999 }}
          />
        </View>
        <View style={[e.pomoSitio, { left: `${f * 100}%` }]} pointerEvents="none">
          <LinearGradient colors={[colores.oroClaro, colores.oro500]} style={[e.pomo, arrastrando && { transform: [{ scale: 1.12 }] }]} />
        </View>
      </View>
    </View>
  );
}

const e = StyleSheet.create({
  superficie: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: blanco(0.075),
    boxShadow: "0 30px 60px -40px rgba(0,0,0,0.8)",
  },
  boton: {
    height: 52,
    borderRadius: 999,
    paddingHorizontal: 28,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  botonGhost: {
    backgroundColor: blanco(0.06),
    borderWidth: 1,
    borderColor: blanco(0.1),
  },
  botonFilo: { borderRadius: 999, borderTopWidth: 1 },
  botonTexto: { fontFamily: fuentes.boton, fontSize: 16, letterSpacing: -0.16 },
  pastilla: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  pastillaTexto: { fontFamily: fuentes.textoFuerte, fontSize: 12.5 },
  antetitulo: {
    fontFamily: fuentes.textoFuerte,
    fontSize: 12,
    letterSpacing: 2.6,
    color: colores.portal300,
  },
  codigo: {
    fontFamily: fuentes.mono,
    fontSize: 13.5,
    color: colores.portal200,
    backgroundColor: blanco(0.1),
  },
  etiqueta: {
    fontFamily: fuentes.textoFuerte,
    fontSize: 12.5,
    letterSpacing: 1.75,
    color: blanco(0.5),
  },
  deslizadorCabeza: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
  },
  deslizadorValor: {
    fontFamily: fuentes.titularFuerte,
    fontSize: 16,
    color: "#ffffff",
    fontVariant: ["tabular-nums"],
  },
  deslizadorZona: { height: 40, justifyContent: "center", marginTop: 4 },
  pista: {
    height: 8,
    borderRadius: 999,
    backgroundColor: blanco(0.12),
    overflow: "hidden",
  },
  pomoSitio: {
    position: "absolute",
    top: 9,
    width: 22,
    height: 22,
    marginLeft: -11,
  },
  pomo: {
    width: 22,
    height: 22,
    borderRadius: 11,
    boxShadow: "0 0 0 3px rgba(10,6,19,0.8), 0 4px 14px -2px rgba(251,191,36,0.6)",
  },
});
