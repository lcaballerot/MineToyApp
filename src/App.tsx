import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { Linking } from "react-native";

import PantallaVoz, { motorVoz } from "./voz/PantallaVoz";
import { leerVinculo } from "./voz/motor";

// Paso 4: la app solo tiene la voz. La web (tienda, votos…) entra en el paso 5 con pestañas.
export default function App() {
  useEffect(() => {
    // Enlaces de /vc (voicechat.minetoy.fun/CODIGO) que abren la app: se vincula con ese código.
    const abrir = (url: string | null | undefined) => {
      if (url && leerVinculo(url)) void motorVoz().vincular(url);
    };
    void Linking.getInitialURL().then(abrir);
    const sub = Linking.addEventListener("url", (e) => abrir(e.url));
    return () => sub.remove();
  }, []);
  return (
    <>
      <PantallaVoz />
      <StatusBar style="light" />
    </>
  );
}
