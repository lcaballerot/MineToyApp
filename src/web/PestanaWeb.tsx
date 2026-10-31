import { LinearGradient } from "expo-linear-gradient";
import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type ComponentType, type Ref } from "react";
import { getLocales } from "expo-localization";
import { RefreshCw, WifiOff } from "lucide-react-native";
import { ActivityIndicator, Animated, Linking, StyleSheet, Text, View } from "react-native";
import { WebView as WebViewClase, type WebViewNavigation, type WebViewProps } from "react-native-webview";

// Con los tipos de React 19.3 las props de la clase WebView se resuelven a `never` (fallo de tipos de la librería, no de
// uso): se tipa a mano con sus propias WebViewProps.
type WebView = WebViewClase;
const WebView = WebViewClase as unknown as ComponentType<WebViewProps & { ref?: Ref<WebView> }>;

import { version } from "../../package.json";
import { blanco, colores, fuentes } from "../tema";
import { destinoUrl } from "../seguridad/reglas";
import { Boton, Mosaico } from "../ui/piezas";

// Qué se abre dentro y qué no: src/seguridad/reglas.ts (`destinoUrl`). Las cookies (sesión `__Host-cuenta` de cada host y
// el inicio de sesión único store → vote/radio) viven en el almacén del sistema, persistente y compartido por todas las pestañas.

/** La web puede reconocer la app por el user agent (modo app del paso 5; ver docs/es/PLAN.md). */
const AGENTE = `MineToyApp/${version}`;

/**
 * Modo app de la web: `data-app` en <html> antes de pintar, en cada carga de página. La web lo usa en su CSS
 * (`web/src/app/globals.css`, `html[data-app]`) para quitar el pie, que aquí sobra con la barra de pestañas.
 */
const MODO_APP = `(function () {
  var v = ${JSON.stringify(version)};
  function poner() { if (document.documentElement) { document.documentElement.setAttribute("data-app", v); return true; } return false; }
  if (!poner()) { var o = new MutationObserver(function () { if (poner()) o.disconnect(); }); o.observe(document, { childList: true }); }
})(); true;`;
/** Toque en la pestaña activa: arriba del todo; si ya está arriba, a la portada de la pestaña (sin rehacer el WebView). */
const arribaOPortada = (url: string) => `(function () {
  if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: "smooth" });
  else if (location.href !== ${JSON.stringify(url)}) location.href = ${JSON.stringify(url)};
})(); true;`;

const en = getLocales()[0]?.languageCode === "en";
const T = en
  ? { errorT: "Can't load this page", errorP: "Check your internet connection and try again.", reintentar: "Try again" }
  : { errorT: "No se pudo cargar la página", errorP: "Revisa tu conexión a internet y vuelve a intentarlo.", reintentar: "Reintentar" };

export interface ControlWeb {
  /** Atrás dentro de la web; false si ya está en la primera página. */
  atras(): boolean;
  inicio(): void;
  /** Abre una página ya validada de esta web (enlace de /link). */
  abrir(url: string): void;
}

interface Props {
  url: string;
  /** Un enlace a voicechat.minetoy.fun: lo atiende la pestaña nativa de voz. */
  alAbrirVoz: (url: string) => void;
}

const PestanaWeb = forwardRef<ControlWeb, Props>(function PestanaWeb({ url, alAbrirVoz }, ref) {
  const web = useRef<WebView>(null);
  const puedeAtras = useRef(false);
  const [clave, setClave] = useState(0);
  const [progreso, setProgreso] = useState(0);
  // Página que carga el WebView: la portada, o un enlace validado que llegó de fuera (abrir).
  const [fuente, setFuente] = useState(url);

  useImperativeHandle(ref, () => ({
    atras() {
      if (!puedeAtras.current) return false;
      web.current?.goBack();
      return true;
    },
    inicio() {
      web.current?.injectJavaScript(arribaOPortada(url));
    },
    abrir(destino) {
      if (destinoUrl(destino) !== "dentro") return;
      // Cambiar `source` navega sin rehacer el WebView (vale también antes de la primera carga); si es la misma, se fuerza.
      if (destino !== fuente) setFuente(destino);
      else web.current?.injectJavaScript(`location.href = ${JSON.stringify(destino)}; true;`);
    },
  }));

  function decidir(peticion: WebViewNavigation): boolean {
    switch (destinoUrl(peticion.url)) {
      case "dentro":
      case "pagina": // about:blank, blob: y data: los usa la propia página
        return true;
      case "voz":
        alAbrirVoz(peticion.url);
        return false;
      case "navegador": // pasarelas de pago y cualquier otro sitio: navegador del sistema, sin nada de la app
      case "sistema": // mailto:, tel:
        void Linking.openURL(peticion.url).catch(() => {});
        return false;
      default:
        return false;
    }
  }

  return (
    <View style={e.web}>
      <WebView
        key={clave}
        ref={web}
        source={{ uri: fuente }}
        style={e.web}
        containerStyle={e.web}
        applicationNameForUserAgent={AGENTE}
        // Ya está dentro del área segura (App): sin márgenes automáticos de iOS que la empujen otra vez.
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
        injectedJavaScriptBeforeContentLoaded={MODO_APP}
        onShouldStartLoadWithRequest={decidir}
        onNavigationStateChange={(n) => {
          puedeAtras.current = n.canGoBack;
        }}
        onLoadStart={() => setProgreso(0.05)}
        onLoadProgress={(ev) => setProgreso(ev.nativeEvent.progress)}
        onLoadEnd={() => setProgreso(1)}
        // El sistema puede matar el proceso de la web con poca memoria (Bedrock abierto): se rehace en vez de quedar en blanco.
        onContentProcessDidTerminate={() => setClave((k) => k + 1)}
        onRenderProcessGone={() => setClave((k) => k + 1)}
        renderError={() => (
          <View style={e.error}>
            <Mosaico Icono={WifiOff} />
            <Text style={e.errorT}>{T.errorT}</Text>
            <Text style={e.errorP}>{T.errorP}</Text>
            <Boton texto={T.reintentar} Icono={RefreshCw} variante="primary" onPress={() => setClave((k) => k + 1)} style={e.errorBoton} />
          </View>
        )}
        // Enlaces target=_blank: en la misma vista, pasando por `decidir`.
        setSupportMultipleWindows={false}
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled
        sharedCookiesEnabled
        startInLoadingState
        renderLoading={() => (
          <View style={e.cargando}>
            <ActivityIndicator color={colores.portal400} size="large" />
          </View>
        )}
        // La web nunca debe abrir ficheros locales ni ejecutar nada fuera de su origen.
        allowFileAccess={false}
        allowUniversalAccessFromFileURLs={false}
        allowFileAccessFromFileURLs={false}
        // Nada de contenido mixto ni cookies de terceros (rastreo) ni ventanas abiertas por script. Sin puente JS:
        // la web no tiene `onMessage`, así que no puede llamar a nada nativo.
        mixedContentMode="never"
        thirdPartyCookiesEnabled={false}
        javaScriptCanOpenWindowsAutomatically={false}
        webviewDebuggingEnabled={__DEV__}
        originWhitelist={["https://*"]}
        mediaPlaybackRequiresUserAction
      />
      {progreso < 1 && <BarraCarga progreso={progreso} />}
    </View>
  );
});

export default PestanaWeb;

/** Barra fina de carga arriba (morado → rosa → oro, los colores del visualizador). */
function BarraCarga({ progreso }: { progreso: number }) {
  const ancho = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(ancho, {
      toValue: Math.max(0.05, progreso),
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [ancho, progreso]);
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        e.barra,
        {
          width: ancho.interpolate({
            inputRange: [0, 1],
            outputRange: ["0%", "100%"],
          }),
        },
      ]}
    >
      <LinearGradient
        colors={[colores.morado, colores.lila, colores.oro300]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

const e = StyleSheet.create({
  web: { flex: 1, backgroundColor: colores.fondo },
  error: { ...StyleSheet.absoluteFill, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: colores.fondo },
  errorT: {
    fontFamily: fuentes.titular,
    fontSize: 26,
    lineHeight: 28,
    letterSpacing: -0.9,
    color: "#ffffff",
    textAlign: "center",
    marginTop: 16,
  },
  errorP: { fontFamily: fuentes.texto, fontSize: 15, lineHeight: 23, color: blanco(0.6), textAlign: "center", marginTop: 8, maxWidth: 360 },
  errorBoton: { width: "100%", maxWidth: 360, marginTop: 24 },
  cargando: {
    ...StyleSheet.absoluteFill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colores.fondo,
  },
  barra: {
    position: "absolute",
    top: 0,
    left: 0,
    height: 2.5,
    boxShadow: "0 0 10px rgba(232,121,249,0.8)",
  },
});
