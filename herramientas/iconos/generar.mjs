/**
 * Genera los iconos de la app a partir del logo de la web (`favicon.svg`).
 * Uso: node herramientas/iconos/generar.mjs <ruta a web/public/favicon.svg> <carpeta con node_modules/sharp>
 * Salida en assets/. Los PNG se versionan; esto solo hace falta al cambiar el logo.
 */
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [svgRuta, dirSharp] = process.argv.slice(2);
if (!svgRuta || !dirSharp) {
  console.error("uso: node generar.mjs <favicon.svg> <carpeta con sharp>");
  process.exit(1);
}
const sharp = createRequire(path.join(dirSharp, "package.json"))("sharp");
const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../assets");
const svg = readFileSync(svgRuta);
const FONDO = "#0a0613"; // void-900 de la web

const logo = (lado) => sharp(svg, { density: 2400 }).resize(lado, lado).png().toBuffer();

/** Logo de `interior` px centrado en un lienzo de `lado` px (transparente o con fondo). */
async function centrado(lado, interior, fondo) {
  const base = sharp({
    create: { width: lado, height: lado, channels: 4, background: fondo ?? { r: 0, g: 0, b: 0, alpha: 0 } },
  });
  return base
    .composite([{ input: await logo(interior), gravity: "center" }])
    .png()
    .toBuffer();
}

const salidas = {
  // iOS no admite transparencia en el icono: fondo de la web.
  "icon.png": await centrado(1024, 860, FONDO),
  // Adaptativo de Android: el logo dentro de la zona segura (66 %).
  "android-icon-foreground.png": await centrado(1024, 640),
  "android-icon-background.png": await sharp({ create: { width: 1024, height: 1024, channels: 4, background: FONDO } }).png().toBuffer(),
  "splash-icon.png": await centrado(1024, 1024),
  "favicon.png": await logo(48),
};
// Monocromo (iconos temáticos de Android 13+): la silueta del logo en blanco.
const fg = salidas["android-icon-foreground.png"];
const alfa = await sharp(fg).extractChannel(3).toBuffer();
salidas["android-icon-monochrome.png"] = await sharp({
  create: { width: 1024, height: 1024, channels: 3, background: "#ffffff" },
})
  .joinChannel(alfa)
  .png()
  .toBuffer();

for (const [nombre, datos] of Object.entries(salidas)) {
  await sharp(datos).toFile(path.join(ASSETS, nombre));
  console.log(`assets/${nombre}`);
}
