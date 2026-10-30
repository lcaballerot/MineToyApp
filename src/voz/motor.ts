/**
 * Motor del chat de voz de la app. Port de `web/src/components/voz/motor.ts` (mismo protocolo, contrato
 * `CoreVoz/docs/PROTOCOLO-VOZ.md`, secciones 7 y 8) con estas diferencias:
 * - Vincula por `POST /api/app/vincular` y guarda un token opaco en Keychain/Keystore (no hay cookies).
 * - Señaliza por `/app/senal` con el token en el primer frame y `Origin: minetoyvoz://app` (React Native pondría el de
 *   la web si no se le da otro).
 * - Sin Web Audio: cada voz suena con un volumen según la distancia (`_setVolume`, 0–10) y sin izquierda/derecha; el
 *   visualizador usa el nivel del micrófono de `getStats()`. Ver ADR-0001, desviación 2.
 * - Volumen del micrófono: libwebrtc no deja tocar la ganancia antes de enviar, así que se manda al servidor
 *   (`volmic`) y lo aplica cada oyente (quinto valor de `p`). Por lo mismo, aquí se aplica el de los demás.
 * - Sigue viva en segundo plano: servicio en primer plano en Android, sesión de audio mezclable en iOS.
 */
import NetInfo from "@react-native-community/netinfo";
import * as Device from "expo-device";
import * as SecureStore from "expo-secure-store";
import { AppState, PermissionsAndroid, Platform } from "react-native";
import { mediaDevices, registerGlobals, type MediaStream, type MediaStreamTrack } from "react-native-webrtc";
import type { Consumer, Producer, Transport } from "mediasoup-client/types";

import * as nativo from "../../modules/voz-nativo";

registerGlobals();

export const ORIGEN = "https://voicechat.minetoy.fun";
const WS_URL = "wss://voicechat.minetoy.fun/app/senal";
const ORIGEN_APP = "minetoyvoz://app";

export type VistaVoz = "vincular" | "conectado" | "colgado" | "micro" | "otra";
export type FaseVoz = "conectando" | "listo" | "error";
export type ModoVoz = "susurro" | "normal" | "grito";
export type ErrorVincular = "codigo" | "limite" | "red" | null;

export interface InstantaneaVoz {
  vista: VistaVoz;
  fase: FaseVoz;
  caducada: boolean;
  jugando: boolean;
  mic: boolean;
  cascos: boolean;
  /** Oír las radios del mundo (contrato 9.5); se cambia solo en /vc. */
  radio: boolean;
  modo: ModoVoz;
  volMic: number;
  volCascos: number;
  errorVincular: ErrorVincular;
  vinculando: boolean;
}

/** Textos de la notificación de Android (en el idioma de la interfaz). */
export interface TextosServicio {
  titulo: string;
  texto: string;
  colgar: string;
}

type Pendiente = { ok: (m: Mensaje) => void; mal: (e: Error) => void; plazo: ReturnType<typeof setTimeout> };
type Mensaje = Record<string, unknown> & { t?: string };
interface Voz {
  consumer: Consumer;
  r: number;
  /** Ganancia por distancia (0–1), antes del volumen de los cascos. */
  g: number;
  /** Volumen del micro del hablante (0–2): 1 salvo si habla desde la app. */
  vm: number;
}

const CLAVE_TOKEN = "voz.token";
const CLAVE_CASCOS = "voz.volCascos";
const CLAVE_MIC = "voz.volMic";
const B64 = /^[A-Za-z0-9_-]{43}$/;
const CODIGO = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;

/**
 * Lee lo que trae un QR de `/vc`, un enlace o lo que el jugador escribe: el código corto (`K7Q2XM`, también en
 * `https://voicechat.minetoy.fun/K7Q2XM` o `/en/K7Q2XM`) o el token del enlace largo (`/#t=…`).
 */
export function leerVinculo(texto: string): { codigo: string } | { token: string } | null {
  const t = texto.trim();
  const largo = /^https:\/\/voicechat\.minetoy\.fun\/(?:(?:en|es)\/?)?#t=([A-Za-z0-9_-]{43})$/i.exec(t);
  if (largo) return { token: largo[1] };
  const corto = /^https:\/\/voicechat\.minetoy\.fun\/(?:(?:en|es)\/)?([A-Za-z0-9]{6})\/?$/i.exec(t);
  const crudo = (corto ? corto[1] : t).toUpperCase().replace(/[\s-]/g, "");
  return CODIGO.test(crudo) ? { codigo: crudo } : null;
}

/** Ganancia lineal por distancia hasta R, como el `PannerNode` lineal de la web (refDistance 1). */
export function gananciaDistancia(x: number, y: number, z: number, r: number): number {
  const d = Math.hypot(x, y, z);
  const max = Math.max(2, r);
  if (d <= 1) return 1;
  if (d >= max) return 0;
  return 1 - (d - 1) / (max - 1);
}

const limitar = (v: unknown, a: number, b: number, def: number) =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : def;

function modeloSeguro(): string | undefined {
  const m = (Device.modelName ?? "")
    .replace(/[^\w .,()+-]/g, "")
    .slice(0, 64)
    .trim();
  return m || undefined;
}

export interface MotorVoz {
  arrancar(): Promise<void>;
  destruir(): void;
  leer(): InstantaneaVoz;
  suscribir(f: () => void): () => void;
  /** Código escrito, QR escaneado o enlace abierto. */
  vincular(texto: string): Promise<void>;
  colgar(): void;
  reconectar(): void;
  /** Botones de micro y cascos: el servidor lo aplica, lo guarda y avisa a `/vc` en el juego. */
  ponerAjuste(que: "mic" | "cascos", v: boolean): void;
  ponerVolMic(v: number): void;
  ponerVolCascos(v: number): void;
  /** Nivel de tu voz (0–1) para el visualizador; null si no hay micrófono. */
  nivel(): number | null;
  /** Mide el nivel (getStats a ~6 Hz) solo mientras alguien lo mira: no gasta batería con la pestaña oculta o jugando. */
  observarNivel(): () => void;
}

export function crearMotor(textos: () => TextosServicio): MotorVoz {
  const oyentes = new Set<() => void>();
  let vista: VistaVoz = "conectado";
  let fase: FaseVoz = "conectando";
  let caducada = false;
  let jugando = false;
  let estado = { mic: true, cascos: true, radio: true, modo: "normal" as ModoVoz };
  let volMic = 100;
  let volCascos = 100;
  let enviarVolMic: ReturnType<typeof setTimeout> | null = null;
  let guardarVols: ReturnType<typeof setTimeout> | null = null;
  let observadoresNivel = 0;
  let midiendo = false;
  let errorVincular: ErrorVincular = null;
  let vinculando = false;

  let token: string | null = null;
  let ws: WebSocket | null = null;
  let envioT: Transport | null = null;
  let recepcionT: Transport | null = null;
  let productor: Producer | null = null;
  let stream: MediaStream | null = null;
  let track: MediaStreamTrack | null = null;
  let nivelMic = 0;
  let detenido = false;
  let conectando = false;
  let reintentos = 0;
  let corr = 0;
  let muerto = false;
  let temporizador: ReturnType<typeof setTimeout> | null = null;
  let sondeo: ReturnType<typeof setInterval> | null = null;
  const pend = new Map<number, Pendiente>();
  const voces = new Map<string, Voz>();
  const bajas: Array<() => void> = [];

  let cache: InstantaneaVoz | null = null;
  const instantanea = (): InstantaneaVoz => {
    const n: InstantaneaVoz = {
      vista,
      fase,
      caducada,
      jugando,
      mic: estado.mic,
      cascos: estado.cascos,
      radio: estado.radio,
      modo: estado.modo,
      volMic,
      volCascos,
      errorVincular,
      vinculando,
    };
    if (cache && (Object.keys(n) as (keyof InstantaneaVoz)[]).every((k) => cache![k] === n[k])) return cache;
    cache = n;
    return n;
  };
  const avisar = () => oyentes.forEach((f) => f());
  const ponerVista = (v: VistaVoz) => {
    vista = v;
    avisar();
  };

  /* ------------------------------------------------------------ vincular */
  async function vincular(texto: string) {
    const v = leerVinculo(texto);
    errorVincular = null;
    if (!v) {
      errorVincular = "codigo";
      avisar();
      return;
    }
    vinculando = true;
    avisar();
    try {
      const r = await fetch(`${ORIGEN}/api/app/vincular`, {
        method: "POST",
        // Sin Origin: el fetch de React Native no lo pone, y el servidor lo acepta ausente en /api/app/*.
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...v, dispositivo: { plataforma: Platform.OS === "ios" ? "ios" : "android", modelo: modeloSeguro() } }),
      });
      if (r.status === 429) errorVincular = "limite";
      else if (!r.ok) errorVincular = "codigo";
      else {
        const cuerpo = (await r.json()) as { ok?: boolean; token?: unknown };
        if (cuerpo.ok && typeof cuerpo.token === "string" && B64.test(cuerpo.token)) {
          token = cuerpo.token;
          await SecureStore.setItemAsync(CLAVE_TOKEN, token, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
          caducada = false;
          detenido = false;
          reintentos = 0;
          void conectar();
        } else errorVincular = "codigo";
      }
    } catch {
      errorVincular = "red";
    } finally {
      vinculando = false;
      avisar();
    }
  }

  async function olvidarToken() {
    token = null;
    await SecureStore.deleteItemAsync(CLAVE_TOKEN).catch(() => {});
  }

  /* ------------------------------------------------------------ señalización */
  function pedir(msg: Mensaje): Promise<Mensaje> {
    return new Promise((ok, mal) => {
      if (!ws || ws.readyState !== 1) return mal(new Error("ws"));
      const c = ++corr;
      const plazo = setTimeout(() => {
        pend.delete(c);
        mal(new Error("plazo"));
      }, 10000);
      pend.set(c, { ok, mal, plazo });
      ws.send(JSON.stringify({ ...msg, c }));
    });
  }
  const enviar = (m: Mensaje) => {
    if (ws && ws.readyState === 1) ws.send(JSON.stringify(m));
  };

  function abrirWs(): Promise<{ ws: WebSocket; ini?: Mensaje }> {
    return new Promise((resolver) => {
      // Tercer argumento de React Native: cabeceras del handshake (Origin fijo de la app, contrato sección 8).
      const Ctor = WebSocket as unknown as new (u: string, p: string[], o: { headers: Record<string, string> }) => WebSocket;
      const s = new Ctor(WS_URL, [], { headers: { Origin: ORIGEN_APP } });
      ws = s;
      let ini = false;
      s.onopen = () => s.send(JSON.stringify({ t: "auth", token }));
      s.onmessage = (ev) => {
        let m: Mensaje;
        try {
          m = JSON.parse(String(ev.data)) as Mensaje;
        } catch {
          return;
        }
        if (m.t === "ini" && !ini) {
          ini = true;
          resolver({ ws: s, ini: m });
          return;
        }
        alMensaje(m);
      };
      s.onclose = (ev) => {
        for (const p of pend.values()) {
          clearTimeout(p.plazo);
          p.mal(new Error("cerrado"));
        }
        pend.clear();
        if (!ini) resolver({ ws: s });
        if (ws === s) alCerrarWs(ev.code);
      };
    });
  }

  function alMensaje(m: Mensaje) {
    switch (m.t) {
      case "r": {
        const p = pend.get(m.c as number);
        if (!p) return;
        pend.delete(m.c as number);
        clearTimeout(p.plazo);
        if (m.ok) p.ok(m);
        else p.mal(new Error("rechazado"));
        return;
      }
      case "consumer":
        void nuevoConsumer(m);
        return;
      case "cierra":
        quitarVoz(String(m.id));
        return;
      case "p":
        aplicarPoses(m as { o?: Record<string, number[]> });
        return;
      case "estado":
        aplicarEstado(m);
        return;
      case "juego":
        jugando = Boolean(m.s);
        avisar();
        return;
      default:
    }
  }

  function aplicarEstado(m: Mensaje) {
    const modo: ModoVoz = m.modo === "susurro" || m.modo === "grito" ? m.modo : "normal";
    // `radio` falta en un voz-control anterior a Core-Radio: por defecto, encendida.
    estado = { mic: m.mic !== false, cascos: m.cascos !== false, radio: m.radio !== false, modo };
    avisar();
  }

  function alCerrarWs(codigo: number) {
    desmontarMedios();
    ws = null;
    conectando = false;
    if (muerto) return;
    // 4401: token revocado o caducado (otro teléfono vinculado, /vc desvincular). Se olvida y se vuelve a vincular.
    if (codigo === 4401 || codigo === 4403) {
      nativo.pararServicio();
      soltarMic();
      caducada = token !== null;
      void olvidarToken();
      ponerVista("vincular");
      return;
    }
    // 4409: otra sesión (la web u otra app) tomó el relevo. No se reconecta sola.
    if (codigo === 4409) {
      nativo.pararServicio();
      soltarMic();
      ponerVista("otra");
      return;
    }
    if (detenido) return;
    fase = "error";
    ponerVista("conectado");
    programarReintento();
  }

  function programarReintento() {
    if (temporizador) clearTimeout(temporizador);
    const espera = Math.min(1000 * 2 ** reintentos++, 15000);
    temporizador = setTimeout(() => {
      temporizador = null;
      if (!ws && !detenido && !muerto && vista === "conectado") void conectar();
    }, espera);
  }

  /* ------------------------------------------------------------ audio */
  async function pedirPermisos(): Promise<boolean> {
    if (Platform.OS !== "android") return true;
    if (Platform.Version >= 33) {
      // La notificación del servicio; si la niega, el servicio funciona igual (sin notificación visible).
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS).catch(() => null);
    }
    const r = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO);
    return r === PermissionsAndroid.RESULTS.GRANTED;
  }

  async function abrirMic(): Promise<MediaStreamTrack> {
    nativo.configurarAudio();
    // react-native-webrtc aplica por defecto cancelación de eco, supresión de ruido y control de ganancia.
    const s = await mediaDevices.getUserMedia({ audio: true, video: false });
    stream?.getTracks().forEach((x) => x.stop());
    stream = s;
    track = s.getAudioTracks()[0];
    return track;
  }

  function soltarMic() {
    stream?.getTracks().forEach((x) => x.stop());
    stream = null;
    track = null;
    nivelMic = 0;
  }

  function aplicarVolumen(v: Voz) {
    try {
      // 0–10 en react-native-webrtc: distancia (0–1) × micro del hablante (0–2) × cascos (0–2).
      (v.consumer.track as unknown as MediaStreamTrack)._setVolume(v.g * v.vm * (volCascos / 100));
    } catch {
      /* pista ya cerrada */
    }
  }

  async function nuevoConsumer(m: Mensaje) {
    if (!recepcionT) return;
    try {
      const consumer = await recepcionT.consume({
        id: String(m.id),
        producerId: String(m.pid),
        kind: "audio",
        rtpParameters: m.rtp as never,
      });
      // Hasta la primera pose, en silencio: evita un golpe de volumen al montar.
      const v: Voz = { consumer, r: Number(m.r) || 12, g: 0, vm: 1 };
      voces.set(String(m.id), v);
      aplicarVolumen(v);
      enviar({ t: "listo", id: m.id });
    } catch {
      /* el servidor lo cerrará si ya no procede */
    }
  }

  function quitarVoz(id: string) {
    const v = voces.get(id);
    if (!v) return;
    voces.delete(id);
    try {
      v.consumer.close();
    } catch {
      /* ya cerrado */
    }
  }

  /** Posiciones relativas a 10 Hz (el servidor ya las manda giradas a la vista del oyente). */
  function aplicarPoses(m: { o?: Record<string, number[]> }) {
    if (!m.o) return;
    for (const [id, [x, y, z, r, vm]] of Object.entries(m.o)) {
      const v = voces.get(id);
      if (!v) continue;
      v.r = r;
      const g = gananciaDistancia(x, y, z, r);
      const micHablante = Number.isFinite(vm) ? limitar(vm, 0, 200, 100) / 100 : 1;
      if (Math.abs(g - v.g) < 0.01 && micHablante === v.vm) continue;
      v.g = g;
      v.vm = micHablante;
      aplicarVolumen(v);
    }
  }

  function desmontarMedios() {
    for (const id of [...voces.keys()]) quitarVoz(id);
    try {
      productor?.close();
      envioT?.close();
      recepcionT?.close();
    } catch {
      /* ya cerrados */
    }
    productor = envioT = recepcionT = null;
  }

  /** Nivel del micrófono para el visualizador (WebRTC lo mide; aquí no hay AnalyserNode). */
  async function medirNivel() {
    if (midiendo) return; // getStats lento: no se encolan
    midiendo = true;
    try {
      await medirNivelUnaVez();
    } finally {
      midiendo = false;
    }
  }
  async function medirNivelUnaVez() {
    if (!productor || productor.closed) {
      nivelMic = 0;
      return;
    }
    try {
      const informe = await productor.getStats();
      let n = 0;
      informe.forEach((s: { type?: string; kind?: string; audioLevel?: number }) => {
        if (s.type === "media-source" && typeof s.audioLevel === "number") n = Math.max(n, s.audioLevel);
      });
      nivelMic = n;
    } catch {
      nivelMic = 0;
    }
  }

  /* ------------------------------------------------------------ conexión completa */
  async function conectar() {
    if (conectando || ws || muerto) return;
    if (!token) {
      ponerVista("vincular");
      return;
    }
    conectando = true;
    fase = "conectando";
    ponerVista("conectado");

    if (!(await pedirPermisos())) {
      conectando = false;
      detenido = true;
      ponerVista("micro");
      return;
    }

    const r = await abrirWs();
    if (!r.ini) {
      // Cerró antes del saludo: `alCerrarWs` ya decidió qué mostrar.
      conectando = false;
      return;
    }
    const sock = r.ws;
    const ini = r.ini;
    if (ini.estado && typeof ini.estado === "object") aplicarEstado({ ...(ini.estado as object), t: "estado" });
    if (volMic !== 100) enviar({ t: "volmic", v: volMic });
    let falloMic = false;
    try {
      if (!ini.rtp) throw new Error("sin SFU");
      const { Device: Dispositivo } = await import("mediasoup-client");
      const d = new Dispositivo({ handlerName: "ReactNative106" });
      await d.load({ routerRtpCapabilities: ini.rtp as never });
      let pista = track && track.readyState === "live" ? track : null;
      if (!pista) {
        try {
          pista = await abrirMic();
        } catch {
          falloMic = true;
          throw new Error("mic");
        }
      }

      const te = await pedir({ t: "transporte", dir: "envio" });
      const envio = d.createSendTransport({
        id: te.id as string,
        iceParameters: te.ice as never,
        iceCandidates: te.cand as never,
        dtlsParameters: te.dtls as never,
      });
      envio.on("connect", ({ dtlsParameters }, ok, mal) => {
        pedir({ t: "conectar", id: envio.id, dtls: dtlsParameters }).then(() => ok(), mal);
      });
      envio.on("produce", ({ rtpParameters }, ok, mal) => {
        pedir({ t: "producir", id: envio.id, rtp: rtpParameters }).then((x) => ok({ id: x.pid as string }), mal);
      });
      envio.on("connectionstatechange", (e) => {
        // Cambio de red (Wi-Fi ↔ datos): el transporte muere; se rehace todo.
        if (e === "failed" || e === "disconnected") {
          fase = "error";
          avisar();
          if (e === "failed") sock.close();
        }
      });
      envioT = envio;

      const tr = await pedir({ t: "transporte", dir: "recepcion" });
      const rec = d.createRecvTransport({
        id: tr.id as string,
        iceParameters: tr.ice as never,
        iceCandidates: tr.cand as never,
        dtlsParameters: tr.dtls as never,
      });
      rec.on("connect", ({ dtlsParameters }, ok, mal) => {
        pedir({ t: "conectar", id: rec.id, dtls: dtlsParameters }).then(() => ok(), mal);
      });
      recepcionT = rec;

      productor = await envio.produce({
        track: pista as never,
        codecOptions: { opusDtx: true, opusFec: true, opusStereo: false },
      });
      reintentos = 0;
      fase = "listo";
      conectando = false;
      ponerVista("conectado");
      const t = textos();
      nativo.iniciarServicio(t.titulo, t.texto, t.colgar);
    } catch {
      conectando = false;
      if (falloMic) {
        detenido = true;
        fase = "listo";
        ponerVista("micro");
      } else {
        fase = "error";
        avisar();
      }
      try {
        sock.close();
      } catch {
        /* nada */
      }
    }
  }

  function colgar() {
    detenido = true;
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    const s = ws;
    ws = null;
    try {
      s?.close();
    } catch {
      /* nada */
    }
    desmontarMedios();
    soltarMic();
    nativo.pararServicio();
    conectando = false;
    ponerVista("colgado");
  }

  function reconectar() {
    detenido = false;
    reintentos = 0;
    if (temporizador) clearTimeout(temporizador);
    temporizador = null;
    void conectar();
  }

  /** Tras un cambio de red o al volver a la app: si la conexión cayó, se reintenta ya, sin esperar el retroceso. */
  function despertar() {
    if (muerto || detenido || !token) return;
    if (vista !== "conectado") return;
    if (!ws && !conectando) reconectar();
  }

  /** Volumen guardado (0–200); 100 si no hay (`Number(null)` sería 0 y empezaría en silencio). */
  async function leerVolumen(clave: string): Promise<number> {
    const crudo = await SecureStore.getItemAsync(clave).catch(() => null);
    return crudo == null || crudo === "" ? 100 : limitar(Number(crudo), 0, 200, 100);
  }
  /** Al Keychain/Keystore como mucho cada 400 ms mientras se arrastra un deslizador. */
  function guardarVolumenes() {
    if (guardarVols) clearTimeout(guardarVols);
    guardarVols = setTimeout(() => {
      guardarVols = null;
      void SecureStore.setItemAsync(CLAVE_MIC, String(volMic)).catch(() => {});
      void SecureStore.setItemAsync(CLAVE_CASCOS, String(volCascos)).catch(() => {});
    }, 400);
  }

  /* ------------------------------------------------------------ API */
  return {
    async arrancar() {
      muerto = false;
      volCascos = await leerVolumen(CLAVE_CASCOS);
      volMic = await leerVolumen(CLAVE_MIC);
      token = await SecureStore.getItemAsync(CLAVE_TOKEN).catch(() => null);
      if (token && !B64.test(token)) await olvidarToken();
      bajas.push(nativo.alColgar(() => colgar()).remove);
      bajas.push(nativo.alVolverAudio(() => despertar()).remove);
      bajas.push(NetInfo.addEventListener((e) => e.isConnected && despertar()));
      const sub = AppState.addEventListener("change", (s) => s === "active" && despertar());
      bajas.push(() => sub.remove());
      if (token) void conectar();
      else ponerVista("vincular");
    },
    destruir() {
      muerto = true;
      if (temporizador) clearTimeout(temporizador);
      if (sondeo) clearInterval(sondeo);
      if (enviarVolMic) clearTimeout(enviarVolMic);
      if (guardarVols) clearTimeout(guardarVols);
      bajas.splice(0).forEach((f) => f());
      const s = ws;
      ws = null;
      try {
        s?.close();
      } catch {
        /* nada */
      }
      desmontarMedios();
      soltarMic();
      nativo.pararServicio();
      oyentes.clear();
    },
    leer: instantanea,
    suscribir(f) {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    vincular,
    colgar,
    reconectar,
    ponerAjuste(que, v) {
      if (!ws || ws.readyState !== 1 || estado[que] === v) return;
      // Al momento en pantalla; el `estado` que devuelve el servidor manda (si lo rechaza, vuelve solo).
      estado = { ...estado, [que]: v };
      enviar({ t: "ajuste", que, v });
      avisar();
    },
    ponerVolMic(v) {
      volMic = limitar(v, 0, 200, 100);
      guardarVolumenes();
      // Mientras se arrastra, como mucho un mensaje cada 150 ms (el servidor corta a 50 frames/s).
      if (!enviarVolMic) {
        enviarVolMic = setTimeout(() => {
          enviarVolMic = null;
          enviar({ t: "volmic", v: volMic });
        }, 150);
      }
      avisar();
    },
    ponerVolCascos(v) {
      volCascos = limitar(v, 0, 200, 100);
      guardarVolumenes();
      for (const voz of voces.values()) aplicarVolumen(voz);
      avisar();
    },
    nivel() {
      return productor && !productor.closed ? nivelMic : null;
    },
    observarNivel() {
      if (++observadoresNivel === 1 && !sondeo) sondeo = setInterval(() => void medirNivel(), 160);
      return () => {
        if (--observadoresNivel === 0 && sondeo) {
          clearInterval(sondeo);
          sondeo = null;
          nivelMic = 0;
        }
      };
    },
  };
}
