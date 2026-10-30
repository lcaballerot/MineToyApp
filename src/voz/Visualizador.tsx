import { Mic, MicOff } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from "react-native-svg";

import { colores } from "../tema";
import type { MotorVoz } from "./motor";

/**
 * Visualizador de tu voz, el mismo anillo de 72 barras radiales que la web (`web/src/components/voz/visualizador.tsx`).
 * Sin Web Audio no hay espectro (ADR-0001, desviación 2): la altura sale del nivel del micrófono de `getStats()` repartido
 * con dos ondas lentas, simétrico como el de la web. Con «reducir movimiento» queda el anillo fijo que cambia de color.
 */

const LADO = 260;
const BARRAS = 72;
const C = LADO / 2;
const R0 = LADO * 0.3;
const LARGO = LADO * 0.17;
const PARADAS: [number, [number, number, number]][] = [
  [0, [168, 85, 247]],
  [0.5, [232, 121, 249]],
  [1, [252, 211, 77]],
];

function color(a: number, alfa = 1): string {
  const x = Math.min(1, Math.max(0, a));
  const i = x < 0.5 ? 0 : 1;
  const [a0, c0] = PARADAS[i];
  const [a1, c1] = PARADAS[i + 1];
  const f = (x - a0) / (a1 - a0);
  const m = (k: number) => Math.round(c0[k] + (c1[k] - c0[k]) * f);
  return `rgba(${m(0)},${m(1)},${m(2)},${alfa})`;
}

interface Cuadro {
  ahora: number;
  nivel: number;
  alturas: number[];
  hablando: boolean;
}
const QUIETO: Cuadro = {
  ahora: 0,
  nivel: 0,
  alturas: new Array<number>(BARRAS).fill(0),
  hablando: false,
};

export default function Visualizador({ motor, mic, activo }: { motor: MotorVoz; mic: boolean; activo: boolean }) {
  const [cuadro, setCuadro] = useState<Cuadro>(QUIETO);
  const [reducido, setReducido] = useState(false);
  const escala = useRef(new Animated.Value(1)).current;
  const hablandoAntes = useRef(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReducido);
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", setReducido);
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (!activo) return;
    const alturas = new Array<number>(BARRAS).fill(0);
    let nivel = 0;
    let hastaVoz = 0;
    let ultimo = 0;
    let raf = 0;
    const dibujar = (ahora: number) => {
      raf = requestAnimationFrame(dibujar);
      // ~30 cuadros/s (5/s con «reducir movimiento»): sobra para la voz y no carga el hilo de JS.
      if (ahora - ultimo < (reducido ? 200 : 33)) return;
      ultimo = ahora;
      const n = mic ? Math.min(1, (motor.nivel() ?? 0) * 3) : 0;
      nivel = Math.max(n, nivel * 0.9);
      if (n > 0.05) hastaVoz = ahora + 350;
      const mitad = BARRAS / 2;
      for (let i = 0; i < BARRAS; i++) {
        const k = i < mitad ? i : BARRAS - 1 - i;
        // Dos ondas que se mueven despacio: graves más altos que agudos, como el espectro de una voz.
        const forma =
          (0.55 + 0.45 * Math.sin(ahora / 260 + k * 0.55)) * (0.6 + 0.4 * Math.sin(ahora / 410 - k * 0.31)) * (1 - (k / mitad) * 0.45);
        alturas[i] = Math.max(Math.min(1, n * forma * 1.6), alturas[i] * 0.84);
      }
      setCuadro({
        ahora,
        nivel,
        alturas: alturas.slice(),
        hablando: mic && ahora < hastaVoz,
      });
    };
    raf = requestAnimationFrame(dibujar);
    return () => cancelAnimationFrame(raf);
  }, [activo, mic, motor, reducido]);

  const { ahora, nivel, alturas, hablando } = cuadro;
  useEffect(() => {
    if (hablando === hablandoAntes.current) return;
    hablandoAntes.current = hablando;
    Animated.timing(escala, {
      toValue: hablando && !reducido ? 1.06 : 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [escala, hablando, reducido]);

  const brillo = !mic ? 0.04 : 0.1 + nivel * 0.5 + 0.04 * Math.sin(ahora / 900);

  return (
    <View style={e.caja} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={LADO} height={LADO}>
        <Defs>
          <RadialGradient id="brillo" cx={C} cy={C} r={C} gradientUnits="userSpaceOnUse">
            <Stop offset="0.3" stopColor={colores.morado} stopOpacity={brillo} />
            <Stop offset="1" stopColor={colores.morado} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        {reducido ? (
          <Circle
            cx={C}
            cy={C}
            r={R0 + LADO * 0.04}
            fill="none"
            strokeWidth={LADO * 0.035}
            stroke={!mic ? "rgba(154,144,179,0.5)" : color(hablando ? 1 : 0.1, hablando ? 0.95 : 0.6)}
          />
        ) : (
          <>
            <Circle cx={C} cy={C} r={C} fill="url(#brillo)" />
            <Circle
              cx={C}
              cy={C}
              r={R0 - LADO * 0.02}
              fill="none"
              strokeWidth={Math.max(2, LADO * 0.008)}
              stroke={!mic ? "rgba(154,144,179,0.35)" : `rgba(192,132,252,${0.3 + nivel * 0.4})`}
            />
            {alturas.map((h, i) => {
              const respira = !mic ? 0 : 0.5 + 0.5 * Math.sin(ahora / 700 + i * 0.42);
              const largo = LADO * 0.012 + LADO * 0.01 * respira + h * LARGO;
              const ang = (i / BARRAS) * Math.PI * 2 - Math.PI / 2;
              const c = Math.cos(ang);
              const s = Math.sin(ang);
              return (
                <Line
                  key={i}
                  x1={C + c * R0}
                  y1={C + s * R0}
                  x2={C + c * (R0 + largo)}
                  y2={C + s * (R0 + largo)}
                  strokeWidth={Math.max(3, LADO * 0.019)}
                  strokeLinecap="round"
                  stroke={!mic ? "rgba(154,144,179,0.4)" : color(h * 1.1, 0.55 + h * 0.45)}
                />
              );
            })}
          </>
        )}
      </Svg>
      <Animated.View style={[e.centro, !mic && e.centroApagado, { transform: [{ scale: escala }] }]}>
        {mic && (
          <Svg style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="nucleo" cx="50%" cy="40%" r="60%">
                <Stop offset="0" stopColor={colores.morado} stopOpacity={0.45} />
                <Stop offset="1" stopColor={colores.fondoAlto} stopOpacity={0.9} />
              </RadialGradient>
            </Defs>
            <Circle cx="50%" cy="50%" r="50%" fill="url(#nucleo)" />
          </Svg>
        )}
        {mic ? (
          <Mic size={34} strokeWidth={1.8} color={hablando ? colores.oroClaro : colores.portal200} />
        ) : (
          <MicOff size={34} strokeWidth={1.8} color={colores.apagado} />
        )}
      </Animated.View>
    </View>
  );
}

const e = StyleSheet.create({
  caja: {
    width: LADO,
    height: LADO,
    alignItems: "center",
    justifyContent: "center",
  },
  centro: {
    position: "absolute",
    width: LADO * 0.24,
    height: LADO * 0.24,
    borderRadius: LADO * 0.12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.4)",
    boxShadow: "0 10px 30px -10px rgba(168,85,247,0.7)",
  },
  centroApagado: {
    backgroundColor: "rgba(23,14,43,0.9)",
    borderColor: "rgba(255,255,255,0.12)",
    boxShadow: "0 0 0 0 transparent",
  },
});
