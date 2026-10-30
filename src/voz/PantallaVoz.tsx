import { CameraView, useCameraPermissions } from "expo-camera";
import { LinearGradient } from "expo-linear-gradient";
import {
  Camera,
  Headphones,
  HeadphoneOff,
  KeyRound,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  RefreshCw,
  ScanLine,
  TriangleAlert,
  Volume2,
  type LucideIcon,
} from "lucide-react-native";
import { useRef, useState, useSyncExternalStore } from "react";
import { ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Defs, RadialGradient, Rect, Stop } from "react-native-svg";

import { blanco, colores, fuentes } from "../tema";
import { Antetitulo, Boton, ConVc, Deslizador, Mosaico, Pastilla, Superficie, type Categoria } from "../ui/piezas";
import { crearMotor, leerVinculo, type InstantaneaVoz, type MotorVoz } from "./motor";
import { textosVoz } from "./textos";
import Visualizador from "./Visualizador";

/**
 * Pestaña de voz con el diseño de voicechat.minetoy.fun (`web/src/components/voz/voz-cliente.tsx`): intro, tarjeta
 * principal con la pastilla de estado, fichas de micro/cascos/alcance y la tarjeta de volumen. Lo que decide el servidor
 * (micro, cascos, alcance) solo se muestra: se cambia en el juego con `/vc`.
 */

const L = textosVoz();
type Motor = MotorVoz;
type S = InstantaneaVoz;

/** Motor único de la app: vive mientras la app esté abierta (también en segundo plano). */
let motorGlobal: MotorVoz | null = null;
export function motorVoz(): MotorVoz {
  if (!motorGlobal) {
    motorGlobal = crearMotor(() => ({
      titulo: L.servicioTitulo,
      texto: L.servicioTexto,
      colgar: L.colgar,
    }));
    void motorGlobal.arrancar();
  }
  return motorGlobal;
}

/** Pastilla de estado, con las mismas reglas que la web. */
export function estadoVoz(s: S): { texto: string; categoria: Categoria } {
  if (s.vista === "vincular")
    return {
      texto: s.caducada ? L.estCaducada : L.estVincular,
      categoria: "aviso",
    };
  if (s.vista === "micro") return { texto: L.estMicro, categoria: "error" };
  if (s.vista === "otra") return { texto: L.estOtra, categoria: "aviso" };
  if (s.vista === "colgado") return { texto: L.estColgado, categoria: "neutro" };
  if (s.fase === "conectando") return { texto: L.estConectando, categoria: "conectando" };
  if (s.fase === "error") return { texto: L.estError, categoria: "error" };
  return s.jugando ? { texto: L.estActivo, categoria: "activo" } : { texto: L.estEsperando, categoria: "esperando" };
}

export default function PantallaVoz({ visible }: { visible: boolean }) {
  const motor = motorVoz();
  const s = useSyncExternalStore(motor.suscribir, motor.leer);
  const estado = estadoVoz(s);

  return (
    <ScrollView
      style={e.raiz}
      contentContainerStyle={e.contenido}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      showsVerticalScrollIndicator={false}
    >
      <Intro />

      <Superficie brillo style={e.tarjeta}>
        <View style={e.cabecera}>
          <Antetitulo>{L.pageTitle}</Antetitulo>
          <Pastilla texto={estado.texto} categoria={estado.categoria} />
        </View>
        {s.vista === "conectado" && <Principal s={s} motor={motor} visible={visible} />}
        {s.vista === "vincular" && <Vincular s={s} motor={motor} />}
        {s.vista === "micro" && (
          <Mensaje
            Icono={MicOff}
            rojo
            titulo={L.microT}
            texto={L.microP}
            boton={L.reintentar}
            BotonIcono={RefreshCw}
            accion={motor.reconectar}
          />
        )}
        {s.vista === "otra" && (
          <Mensaje Icono={TriangleAlert} titulo={L.otraT} texto={L.otraP} boton={L.usarAqui} accion={motor.reconectar} />
        )}
        {s.vista === "colgado" && (
          <Mensaje Icono={PhoneOff} titulo={L.colgadoT} texto={L.colgadoP} boton={L.conectar} real accion={motor.reconectar} />
        )}
      </Superficie>

      {s.vista === "conectado" && (
        <Superficie style={e.tarjeta}>
          <View style={e.ajustesCabeza}>
            <Mosaico Icono={Volume2} lado={44} radio={16} />
            <View style={{ flex: 1 }}>
              <Text style={e.h2}>{L.ajustesTitle}</Text>
              <Text style={e.ajustesDesc}>{L.ajustesDesc}</Text>
            </View>
          </View>
          <View style={{ marginTop: 20, gap: 20 }}>
            <Deslizador etiqueta={L.volMic} valor={s.volMic} alCambiar={motor.ponerVolMic} />
            <Deslizador etiqueta={L.volCascos} valor={s.volCascos} alCambiar={motor.ponerVolCascos} />
          </View>
          <Boton texto={L.colgar} Icono={PhoneOff} variante="ghost" onPress={motor.colgar} style={{ marginTop: 20 }} />
        </Superficie>
      )}
    </ScrollView>
  );
}

/** Cabecera de la página (`t-intro-glow` + antetítulo + titular). */
function Intro() {
  return (
    <View style={e.intro}>
      <Svg style={e.introBrillo} pointerEvents="none">
        <Defs>
          <RadialGradient id="i1" cx="50%" cy="-10%" rx="60%" ry="70%" fx="50%" fy="-10%">
            <Stop offset="0" stopColor="#7e22ce" stopOpacity={0.36} />
            <Stop offset="0.7" stopColor="#7e22ce" stopOpacity={0} />
          </RadialGradient>
          <RadialGradient id="i2" cx="85%" cy="0%" rx="35%" ry="45%" fx="85%" fy="0%">
            <Stop offset="0" stopColor="#d946ef" stopOpacity={0.14} />
            <Stop offset="0.7" stopColor="#d946ef" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#i1)" />
        <Rect width="100%" height="100%" fill="url(#i2)" />
      </Svg>
      <Antetitulo>{L.eyebrow}</Antetitulo>
      <Text style={e.titular}>{L.title}</Text>
      <Text style={e.subtitulo}>{L.subtitle}</Text>
    </View>
  );
}

/* ---------------------------------------------------------------- conectado */
function Principal({ s, motor, visible }: { s: S; motor: Motor; visible: boolean }) {
  let titular: string;
  let mensaje: string;
  if (s.fase === "conectando") [titular, mensaje] = [L.tConectando, L.pConectando];
  else if (s.fase === "error") [titular, mensaje] = [L.tError, L.pError];
  else if (!s.jugando) [titular, mensaje] = [L.tEsperando, L.pEsperando];
  else if (!s.mic) [titular, mensaje] = [L.tMicoff, L.pMicoff];
  else if (!s.cascos) [titular, mensaje] = [L.tCascosoff, L.pCascosoff];
  else [titular, mensaje] = [L.tActivo, L.pActivo];
  const alcance = { susurro: L.aSusurro, normal: L.aNormal, grito: L.aGrito }[s.modo];

  return (
    <View style={e.centrado}>
      <Visualizador motor={motor} mic={s.mic} activo={visible && s.fase === "listo"} />
      <Text style={[e.h1, { marginTop: 4 }]}>{titular}</Text>
      <Text style={e.parrafo}>
        <ConVc texto={mensaje} />
      </Text>
      <View style={e.fichas}>
        <Ficha etiqueta={L.fMic} valor={s.mic ? L.on : L.off} activa={s.mic} Icono={s.mic ? Mic : MicOff} />
        <Ficha etiqueta={L.fCascos} valor={s.cascos ? L.on : L.off} activa={s.cascos} Icono={s.cascos ? Headphones : HeadphoneOff} />
        <Ficha etiqueta={L.fAlcance} valor={alcance} activa Icono={Radio} />
      </View>
      <Text style={e.pista}>
        <ConVc texto={`${L.hint} /vc`} />
      </Text>
    </View>
  );
}

function Ficha({ etiqueta, valor, activa, Icono }: { etiqueta: string; valor: string; activa: boolean; Icono: LucideIcon }) {
  return (
    <View style={e.ficha}>
      <View style={[e.fichaIcono, { backgroundColor: activa ? "rgba(168,85,247,0.2)" : blanco(0.06) }]}>
        <Icono size={20} strokeWidth={2} color={activa ? colores.portal200 : blanco(0.4)} />
      </View>
      <Text style={e.fichaEtiqueta} numberOfLines={1} adjustsFontSizeToFit>
        {etiqueta.toUpperCase()}
      </Text>
      <Text style={[e.fichaValor, { color: activa ? "#ffffff" : blanco(0.45) }]} numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Text>
    </View>
  );
}

/* ---------------------------------------------------------------- avisos */
function Mensaje({
  Icono,
  titulo,
  texto,
  boton,
  BotonIcono,
  accion,
  rojo,
  real,
}: {
  Icono: LucideIcon;
  titulo: string;
  texto: string;
  boton: string;
  BotonIcono?: LucideIcon;
  accion: () => void;
  rojo?: boolean;
  real?: boolean;
}) {
  return (
    <View style={[e.centrado, { marginTop: 24 }]}>
      <Mosaico Icono={Icono} acento={rojo ? colores.error : colores.morado} />
      <Text style={[e.h1, { marginTop: 16 }]}>{titulo}</Text>
      <Text style={e.parrafo}>
        <ConVc texto={texto} />
      </Text>
      <Boton texto={boton} Icono={BotonIcono} variante={real ? "royal" : "primary"} onPress={accion} style={e.botonAncho} />
    </View>
  );
}

/* ---------------------------------------------------------------- vincular */
function Vincular({ s, motor }: { s: S; motor: Motor }) {
  const [codigo, setCodigo] = useState("");
  const [camara, setCamara] = useState(false);
  const error =
    s.errorVincular === "limite" ? L.errLimite : s.errorVincular === "red" ? L.errRed : s.errorVincular === "codigo" ? L.errCodigo : null;
  const enviar = () => {
    if (codigo.length === 6 && !s.vinculando) void motor.vincular(codigo);
  };

  if (camara) return <Escaner alLeer={(x) => (setCamara(false), void motor.vincular(x))} alCancelar={() => setCamara(false)} />;
  return (
    <View style={{ marginTop: 24 }}>
      <View style={e.centrado}>
        <Mosaico Icono={KeyRound} />
        <Text style={[e.h1, { marginTop: 16 }]}>{s.caducada ? L.vincT2 : L.vincT1}</Text>
        <Text style={e.parrafo}>
          <ConVc texto={s.caducada ? L.vincP2 : L.vincP1} />
        </Text>
      </View>

      <View style={e.pasos}>
        {[L.paso1, L.paso2].map((texto, i) => (
          <View key={i} style={e.paso}>
            <View style={e.pasoNumero}>
              <Text style={e.pasoNumeroTexto}>{i + 1}</Text>
            </View>
            <Text style={e.pasoTexto}>
              <ConVc texto={texto} />
            </Text>
          </View>
        ))}
      </View>

      <Boton texto={L.escanear} Icono={ScanLine} variante="primary" onPress={() => setCamara(true)} style={{ marginTop: 20 }} />

      <Text style={[e.etiqueta, { marginTop: 24 }]}>{L.codigoL.toUpperCase()}</Text>
      <TextInput
        value={codigo}
        onChangeText={(x) =>
          setCodigo(
            x
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "")
              .slice(0, 6),
          )
        }
        autoCapitalize="characters"
        autoCorrect={false}
        autoComplete="off"
        spellCheck={false}
        maxLength={6}
        placeholder="K7Q2XM"
        placeholderTextColor={blanco(0.3)}
        selectionColor={colores.portal400}
        style={[e.entrada, error && { borderColor: "rgba(248,113,113,0.6)" }]}
        returnKeyType="go"
        onSubmitEditing={enviar}
        accessibilityLabel={L.codigoL}
      />
      {error && (
        <Text style={e.error} accessibilityRole="alert">
          <ConVc texto={error} />
        </Text>
      )}
      <Boton
        texto={L.vincularB}
        variante="royal"
        onPress={enviar}
        desactivado={s.vinculando || codigo.length !== 6}
        style={{ marginTop: 20 }}
      />
    </View>
  );
}

function Escaner({ alLeer, alCancelar }: { alLeer: (texto: string) => void; alCancelar: () => void }) {
  const [permiso, pedir] = useCameraPermissions();
  const leido = useRef(false);
  if (!permiso) return null;
  if (!permiso.granted) {
    return (
      <View style={[e.centrado, { marginTop: 24 }]}>
        <Mosaico Icono={Camera} />
        <Text style={[e.h1, { marginTop: 16 }]}>{L.camaraT}</Text>
        <Text style={e.parrafo}>{L.camaraP}</Text>
        <Boton texto={L.camaraB} variante="royal" onPress={() => void pedir()} style={e.botonAncho} />
        <Boton texto={L.cancelar} variante="ghost" onPress={alCancelar} style={[e.botonAncho, { marginTop: 12 }]} />
      </View>
    );
  }
  return (
    <View style={{ marginTop: 20 }}>
      <View style={e.visor}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={({ data }) => {
            // Solo QR de MineToy (o un código suelto); el resto se ignora y se sigue mirando.
            if (leido.current || !leerVinculo(data)) return;
            leido.current = true;
            alLeer(data);
          }}
        />
        <LinearGradient colors={["transparent", "rgba(10,6,19,0.85)"]} style={e.visorPie} pointerEvents="none">
          <Text style={e.visorTexto}>{L.camaraAyuda}</Text>
        </LinearGradient>
        <View style={e.mira} pointerEvents="none">
          {(["tl", "tr", "bl", "br"] as const).map((k) => (
            <View key={k} style={[e.esquina, e[k]]} />
          ))}
        </View>
      </View>
      <Boton texto={L.cancelar} variante="ghost" onPress={alCancelar} style={{ marginTop: 16 }} />
    </View>
  );
}

const ESQUINA = 26;
const e = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: colores.fondo },
  // En iPad no se estira a todo el ancho: columna central como en la web (max-w-3xl).
  contenido: { paddingHorizontal: 16, paddingBottom: 32, width: "100%", maxWidth: 600, alignSelf: "center" },
  intro: {
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 4,
    alignItems: "center",
  },
  introBrillo: {
    position: "absolute",
    top: 0,
    left: -16,
    right: -16,
    height: 320,
  },
  titular: {
    fontFamily: fuentes.titular,
    fontSize: 34,
    lineHeight: 36,
    letterSpacing: -1.3,
    color: "#ffffff",
    textAlign: "center",
    marginTop: 12,
  },
  subtitulo: {
    fontFamily: fuentes.texto,
    fontSize: 15,
    lineHeight: 23,
    color: blanco(0.6),
    textAlign: "center",
    marginTop: 12,
    maxWidth: 420,
  },
  tarjeta: { padding: 20, marginBottom: 16 },
  cabecera: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  centrado: { alignItems: "center" },
  h1: {
    fontFamily: fuentes.titular,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -1.05,
    color: "#ffffff",
    textAlign: "center",
  },
  h2: { fontFamily: fuentes.titularFuerte, fontSize: 18, color: "#ffffff" },
  parrafo: {
    fontFamily: fuentes.texto,
    fontSize: 15,
    lineHeight: 23,
    color: blanco(0.6),
    textAlign: "center",
    marginTop: 8,
    maxWidth: 420,
  },
  pista: {
    fontFamily: fuentes.texto,
    fontSize: 13.5,
    color: blanco(0.5),
    textAlign: "center",
    marginTop: 16,
  },
  fichas: {
    flexDirection: "row",
    gap: 10,
    marginTop: 24,
    alignSelf: "stretch",
  },
  ficha: {
    flex: 1,
    alignItems: "center",
    borderRadius: 16,
    padding: 12,
    backgroundColor: blanco(0.04),
    borderWidth: 1,
    borderColor: blanco(0.07),
  },
  fichaIcono: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  fichaEtiqueta: {
    fontFamily: fuentes.textoFuerte,
    fontSize: 10.5,
    letterSpacing: 1.5,
    color: blanco(0.45),
    marginTop: 8,
  },
  fichaValor: { fontFamily: fuentes.titularFuerte, fontSize: 15, marginTop: 2 },
  ajustesCabeza: { flexDirection: "row", alignItems: "flex-start", gap: 14 },
  ajustesDesc: {
    fontFamily: fuentes.texto,
    fontSize: 14,
    color: blanco(0.6),
    marginTop: 2,
  },
  botonAncho: { alignSelf: "stretch", marginTop: 24 },
  pasos: { gap: 8, marginTop: 24 },
  paso: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 16,
    padding: 16,
    backgroundColor: blanco(0.04),
    borderWidth: 1,
    borderColor: blanco(0.07),
  },
  pasoNumero: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(168,85,247,0.15)",
    borderWidth: 1,
    borderColor: "rgba(192,132,252,0.35)",
  },
  pasoNumeroTexto: {
    fontFamily: fuentes.textoFuerte,
    fontSize: 12,
    color: colores.portal200,
  },
  pasoTexto: {
    flex: 1,
    fontFamily: fuentes.texto,
    fontSize: 14.5,
    lineHeight: 21,
    color: blanco(0.7),
    paddingTop: 2,
  },
  etiqueta: {
    fontFamily: fuentes.textoFuerte,
    fontSize: 12.5,
    letterSpacing: 1.75,
    color: blanco(0.5),
  },
  entrada: {
    marginTop: 8,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: blanco(0.15),
    backgroundColor: blanco(0.05),
    color: "#ffffff",
    fontFamily: fuentes.mono,
    fontSize: 22,
    letterSpacing: 8,
    textAlign: "center",
  },
  error: {
    fontFamily: fuentes.texto,
    fontSize: 14,
    color: colores.error,
    marginTop: 10,
  },
  visor: {
    height: 340,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: colores.fondoAlto,
    borderWidth: 1,
    borderColor: blanco(0.1),
  },
  visorPie: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingTop: 40,
    paddingBottom: 16,
    alignItems: "center",
  },
  visorTexto: {
    fontFamily: fuentes.textoFuerte,
    fontSize: 14,
    color: blanco(0.85),
  },
  mira: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 200,
    height: 200,
    marginLeft: -100,
    marginTop: -110,
  },
  esquina: {
    position: "absolute",
    width: ESQUINA,
    height: ESQUINA,
    borderColor: colores.oro,
  },
  tl: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 14,
  },
  tr: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 14,
  },
  bl: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 14,
  },
  br: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 14,
  },
});
