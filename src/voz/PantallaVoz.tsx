import Slider from "@react-native-community/slider";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { colores } from "../tema";
import { crearMotor, leerVinculo, type InstantaneaVoz, type MotorVoz } from "./motor";
import { textosVoz } from "./textos";

const t = textosVoz();

/** Motor único de la app: vive mientras la app esté abierta (también en segundo plano). */
let motorGlobal: MotorVoz | null = null;
export function motorVoz(): MotorVoz {
  if (!motorGlobal) {
    motorGlobal = crearMotor(() => ({ titulo: t.servicioTitulo, texto: t.servicioTexto, colgar: t.colgar }));
    void motorGlobal.arrancar();
  }
  return motorGlobal;
}

export default function PantallaVoz() {
  const motor = motorVoz();
  const s = useSyncExternalStore(motor.suscribir, motor.leer);
  return (
    <View style={e.fondo}>
      <Text style={e.titulo}>{t.titulo}</Text>
      {s.vista === "vincular" && <Vincular s={s} motor={motor} />}
      {s.vista === "conectado" && <Conectado s={s} motor={motor} />}
      {s.vista === "colgado" && <Aviso texto={t.colgado} boton={t.conectar} accion={motor.reconectar} />}
      {s.vista === "otra" && <Aviso texto={t.otra} boton={t.usarAqui} accion={motor.reconectar} />}
      {s.vista === "micro" && <Aviso texto={t.microNegado} boton={t.reintentar} accion={motor.reconectar} />}
    </View>
  );
}

function Aviso({ texto, boton, accion }: { texto: string; boton: string; accion: () => void }) {
  return (
    <View style={e.bloque}>
      <Text style={e.parrafo}>{texto}</Text>
      <Boton texto={boton} onPress={accion} />
    </View>
  );
}

function Boton({ texto, onPress, secundario, desactivado }: { texto: string; onPress: () => void; secundario?: boolean; desactivado?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={desactivado}
      style={({ pressed }) => [e.boton, secundario && e.botonSecundario, (pressed || desactivado) && { opacity: 0.6 }]}
    >
      <Text style={[e.botonTexto, secundario && e.botonTextoSecundario]}>{texto}</Text>
    </Pressable>
  );
}

/* ---------------------------------------------------------------- vincular */
function Vincular({ s, motor }: { s: InstantaneaVoz; motor: MotorVoz }) {
  const [codigo, setCodigo] = useState("");
  const [camara, setCamara] = useState(false);
  const error =
    s.errorVincular === "limite" ? t.errorLimite : s.errorVincular === "red" ? t.errorRed : s.errorVincular === "codigo" ? t.errorCodigo : null;

  if (camara) return <Escaner alLeer={(x) => (setCamara(false), void motor.vincular(x))} alCancelar={() => setCamara(false)} />;
  return (
    <View style={e.bloque}>
      <Text style={e.subtitulo}>{t.vincularTitulo}</Text>
      {s.caducada && <Text style={e.alerta}>{t.caducada}</Text>}
      <Text style={e.parrafo}>{t.vincularAyuda}</Text>
      <Boton texto={t.escanear} onPress={() => setCamara(true)} />
      <Text style={e.etiqueta}>{t.escribir}</Text>
      <TextInput
        value={codigo}
        onChangeText={(x) => setCodigo(x.toUpperCase().slice(0, 6))}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        placeholder="K7Q2XM"
        placeholderTextColor={colores.apagado}
        style={e.entrada}
        onSubmitEditing={() => void motor.vincular(codigo)}
      />
      <Boton texto={t.vincularBoton} onPress={() => void motor.vincular(codigo)} desactivado={s.vinculando || codigo.length !== 6} secundario />
      {error && <Text style={e.alerta}>{error}</Text>}
    </View>
  );
}

function Escaner({ alLeer, alCancelar }: { alLeer: (texto: string) => void; alCancelar: () => void }) {
  const [permiso, pedir] = useCameraPermissions();
  const leido = useRef(false);
  if (!permiso) return null;
  if (!permiso.granted) {
    return (
      <View style={e.bloque}>
        <Text style={e.parrafo}>{t.camaraPermiso}</Text>
        <Boton texto={t.camaraPermitir} onPress={() => void pedir()} />
        <Boton texto={t.cancelar} onPress={alCancelar} secundario />
      </View>
    );
  }
  return (
    <View style={e.bloque}>
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
      </View>
      <Boton texto={t.cancelar} onPress={alCancelar} secundario />
    </View>
  );
}

/* ---------------------------------------------------------------- conectado */
function Conectado({ s, motor }: { s: InstantaneaVoz; motor: MotorVoz }) {
  const estadoTexto = s.fase === "listo" ? t.conectado : s.fase === "error" ? t.reconectando : t.conectando;
  const color = s.fase === "listo" ? colores.exito : s.fase === "error" ? colores.error : colores.oro;
  const modo = s.modo === "susurro" ? t.susurro : s.modo === "grito" ? t.grito : t.normal;
  return (
    <View style={e.bloque}>
      <Text style={[e.estado, { color }]}>● {estadoTexto}</Text>
      <Visualizador motor={motor} activo={s.fase === "listo" && s.mic} />
      <Text style={e.parrafo}>{s.jugando ? t.enJuego : t.fueraDelJuego}</Text>
      <View style={e.fichas}>
        <Ficha nombre={t.micro} valor={s.mic ? t.encendido : t.apagado} bien={s.mic} />
        <Ficha nombre={t.cascos} valor={s.cascos ? t.encendido : t.apagado} bien={s.cascos} />
        <Ficha nombre={t.alcance} valor={modo} bien />
      </View>
      <Text style={e.nota}>{t.cambiaEnJuego}</Text>
      <Text style={e.etiqueta}>
        {t.volCascos} · {Math.round(s.volCascos)} %
      </Text>
      <Slider
        style={{ width: "100%", height: 40 }}
        minimumValue={0}
        maximumValue={200}
        step={5}
        value={s.volCascos}
        onValueChange={motor.ponerVolCascos}
        minimumTrackTintColor={colores.morado}
        maximumTrackTintColor={colores.fondoAlto}
        thumbTintColor={colores.oro}
      />
      <Boton texto={t.colgar} onPress={motor.colgar} secundario />
    </View>
  );
}

function Ficha({ nombre, valor, bien }: { nombre: string; valor: string; bien: boolean }) {
  return (
    <View style={e.ficha}>
      <Text style={e.fichaNombre}>{nombre}</Text>
      <Text style={[e.fichaValor, { color: bien ? colores.texto : colores.error }]}>{valor}</Text>
    </View>
  );
}

/** Anillo que late con tu voz (nivel de WebRTC a ~10 Hz, suavizado). */
function Visualizador({ motor, activo }: { motor: MotorVoz; activo: boolean }) {
  const escala = useMemo(() => new Animated.Value(1), []);
  useEffect(() => {
    if (!activo) {
      escala.setValue(1);
      return;
    }
    const id = setInterval(() => {
      const n = motor.nivel() ?? 0;
      Animated.timing(escala, { toValue: 1 + Math.min(1, n * 3) * 0.35, duration: 100, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    }, 100);
    return () => clearInterval(id);
  }, [activo, escala, motor]);
  return (
    <View style={e.visualizador}>
      <Animated.View style={[e.anillo, { transform: [{ scale: escala }], opacity: activo ? 1 : 0.35 }]} />
      <View style={e.nucleo} />
    </View>
  );
}

const e = StyleSheet.create({
  fondo: { flex: 1, backgroundColor: colores.fondo, paddingHorizontal: 20, paddingTop: 64 },
  titulo: { color: colores.oro, fontSize: 30, fontWeight: "800", marginBottom: 16 },
  bloque: { gap: 12 },
  subtitulo: { color: colores.lila, fontSize: 20, fontWeight: "700" },
  parrafo: { color: colores.texto, fontSize: 15, lineHeight: 21 },
  nota: { color: colores.apagado, fontSize: 13 },
  etiqueta: { color: colores.apagado, fontSize: 13, marginTop: 8 },
  alerta: { color: colores.error, fontSize: 14 },
  estado: { fontSize: 15, fontWeight: "600" },
  entrada: {
    backgroundColor: colores.fondoAlto,
    color: colores.oroClaro,
    fontSize: 28,
    letterSpacing: 8,
    textAlign: "center",
    borderRadius: 12,
    paddingVertical: 12,
  },
  boton: { backgroundColor: colores.oro, borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  botonSecundario: { backgroundColor: "transparent", borderWidth: 1, borderColor: colores.morado },
  botonTexto: { color: colores.fondo, fontSize: 16, fontWeight: "700" },
  botonTextoSecundario: { color: colores.texto },
  visor: { height: 320, borderRadius: 16, overflow: "hidden", backgroundColor: colores.fondoAlto },
  fichas: { flexDirection: "row", gap: 8 },
  ficha: { flex: 1, backgroundColor: colores.fondoAlto, borderRadius: 12, padding: 10 },
  fichaNombre: { color: colores.apagado, fontSize: 12 },
  fichaValor: { fontSize: 14, fontWeight: "600", marginTop: 2 },
  visualizador: { height: 200, alignItems: "center", justifyContent: "center" },
  anillo: { position: "absolute", width: 150, height: 150, borderRadius: 75, borderWidth: 6, borderColor: colores.lila },
  nucleo: { width: 90, height: 90, borderRadius: 45, backgroundColor: colores.morado },
});
