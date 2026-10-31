/**
 * Reglas de seguridad de la app, sin React Native: se prueban con `npm test` (pruebas/reglas.test.ts, una prueba por
 * regla). Lo que llega de fuera (enlaces, QR, lo que escribe el jugador, frames del servidor) pasa por aquí antes de
 * usarse. Ver docs/es/SEGURIDAD.md.
 */

/** Hosts que se abren dentro de la WebView (solo https, puerto por defecto). www hace 301 a store en Cloudflare. */
export const HOSTS_WEB: ReadonlySet<string> = new Set(["store.minetoy.fun", "vote.minetoy.fun", "radio.minetoy.fun", "www.minetoy.fun"]);
/** La voz es la pestaña nativa, no una WebView. */
export const HOST_VOZ = "voicechat.minetoy.fun";
/** Esquemas que se pasan al sistema (correo, teléfono). Cualquier otro (javascript:, file:, intent:, …) se bloquea. */
const ESQUEMAS_SISTEMA: ReadonlySet<string> = new Set(["mailto:", "tel:"]);
/** Esquemas internos que usa la propia web dentro de la página. */
const ESQUEMAS_PAGINA: ReadonlySet<string> = new Set(["about:", "blob:", "data:"]);

export type DestinoUrl = "dentro" | "voz" | "navegador" | "sistema" | "pagina" | "bloquear";

/** Qué hacer con una navegación de la WebView. */
export function destinoUrl(url: string): DestinoUrl {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "bloquear";
  }
  if (ESQUEMAS_PAGINA.has(u.protocol)) return "pagina";
  if (ESQUEMAS_SISTEMA.has(u.protocol)) return "sistema";
  if (u.protocol !== "https:") return "bloquear";
  // Con usuario o puerto no es una dirección nuestra normal: fuera, al navegador del sistema.
  if (u.username || u.password || u.port) return "navegador";
  if (HOSTS_WEB.has(u.hostname)) return "dentro";
  if (u.hostname === HOST_VOZ) return "voz";
  return "navegador";
}

/** Código corto de `/vc` (voz) y de `/link` (cuentas): mismo alfabeto, sin 0/1/I/L/O. */
export const RE_CODIGO = /^[2-9A-HJKMNP-Z]{6}$/;
const RE_TOKEN = /^[A-Za-z0-9_-]{43}$/;

/** Mayúsculas y sin espacios ni guiones, como lo escribe la gente («k7q-2xm»). */
const normalizarCodigo = (t: string) => t.toUpperCase().replace(/[\s-]/g, "");

/**
 * Lee lo que trae un QR de `/vc`, un enlace o lo que el jugador escribe: el código corto (`K7Q2XM`, también en
 * `https://voicechat.minetoy.fun/K7Q2XM` o `/en/K7Q2XM`) o el token del enlace largo (`/#t=…`).
 */
export function leerVinculo(texto: string): { codigo: string } | { token: string } | null {
  if (typeof texto !== "string" || texto.length > 200) return null;
  const t = texto.trim();
  const largo = /^https:\/\/voicechat\.minetoy\.fun\/(?:(?:en|es)\/?)?#t=([A-Za-z0-9_-]{43})$/i.exec(t);
  if (largo) return RE_TOKEN.test(largo[1]) ? { token: largo[1] } : null;
  const corto = /^https:\/\/voicechat\.minetoy\.fun\/(?:(?:en|es)\/)?([A-Za-z0-9]{6})\/?$/i.exec(t);
  const crudo = corto ? corto[1].toUpperCase() : normalizarCodigo(t);
  return RE_CODIGO.test(crudo) ? { codigo: crudo } : null;
}

/**
 * Enlace de vincular cuenta (`/link`, contrato web/docs/es/contratos-api.md): `https://store.minetoy.fun/[es|en/]
 * [cuenta/]link/<CÓDIGO>` o `minetoy://link/<CÓDIGO>`. Devuelve la página canónica de la tienda o null; con un código
 * inválido no se carga nada.
 */
export function leerEnlaceLink(texto: string): string | null {
  if (typeof texto !== "string" || texto.length > 200) return null;
  const t = texto.trim();
  const web = /^https:\/\/store\.minetoy\.fun\/(?:(es|en)\/)?(?:cuenta\/)?link\/([^/?#]{1,12})\/?$/i.exec(t);
  const app = /^minetoy:\/\/link\/([^/?#]{1,12})\/?$/i.exec(t);
  const idioma = web?.[1]?.toLowerCase() === "en" ? "en" : "es";
  const crudo = web ? web[2] : app ? app[1] : null;
  if (crudo == null) return null;
  const codigo = normalizarCodigo(crudo);
  return RE_CODIGO.test(codigo) ? `https://store.minetoy.fun/${idioma}/cuenta/link/${codigo}` : null;
}

/** Número del servidor o de la interfaz dentro de [a, b]; si no es un número finito, el valor por defecto. */
export const limitar = (v: unknown, a: number, b: number, def: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(b, Math.max(a, v)) : def;

/** Volumen (micro o cascos): entero 0–200, como exige voz-control (`ent(0, 200)`; un decimal cerraría con 4400). */
export const volumen = (v: unknown): number => Math.round(limitar(v, 0, 200, 100));

/** Botones de micro y cascos: como mucho 8 cambios cada 5 s, el mismo tope que aplica voz-control. */
export function crearLimiteAjustes(max = 8, ventanaMs = 5000) {
  let marcas: number[] = [];
  return (ahora: number): boolean => {
    marcas = marcas.filter((t) => ahora - t < ventanaMs);
    if (marcas.length >= max) return false;
    marcas.push(ahora);
    return true;
  };
}

/** Frame `ajuste` exacto del contrato §8: solo `que` mic/cascos y `v` booleano, sin campos de más. */
export function frameAjuste(que: unknown, v: unknown): { t: "ajuste"; que: "mic" | "cascos"; v: boolean } | null {
  if ((que !== "mic" && que !== "cascos") || typeof v !== "boolean") return null;
  return { t: "ajuste", que, v };
}

// Controles C0/C1, marcas de dirección (bidi), ancho cero y BOM: no se pintan ni se mandan.
const INVISIBLES = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠-⁩﻿]/g;

/** Texto libre (de fuera o hacia fuera): NFC, sin invisibles, espacios juntos y con tope de largo. */
export function sanearTexto(v: unknown, max: number): string {
  if (typeof v !== "string") return "";
  return Array.from(v.normalize("NFC").replace(INVISIBLES, "").replace(/\s+/g, " ").trim()).slice(0, max).join("");
}

/** Modelo del teléfono para `POST /api/app/vincular`: el patrón exacto que acepta voz-control (`[\w .,()+-]{0,64}`). */
export function modeloSeguro(nombre: unknown): string | undefined {
  const m = sanearTexto(nombre, 200)
    .replace(/[^\w .,()+-]/g, "")
    .slice(0, 64)
    .trim();
  return m || undefined;
}

export type ModoVoz = "susurro" | "normal" | "grito";
export interface EstadoVoz {
  mic: boolean;
  cascos: boolean;
  radio: boolean;
  modo: ModoVoz;
}

/**
 * `estado` del servidor (en `ini.estado` y en cada frame `estado`, contrato §8 y §9.5): cada campo solo si tiene el tipo
 * exacto; si falta o viene mal, se queda el valor que había. Así la ficha de radio pinta lo que dice voz-control.
 */
export function leerEstado(m: unknown, previo: EstadoVoz): EstadoVoz {
  if (typeof m !== "object" || m === null) return previo;
  const o = m as Record<string, unknown>;
  const bool = (v: unknown, def: boolean) => (typeof v === "boolean" ? v : def);
  const modo = o.modo === "susurro" || o.modo === "grito" || o.modo === "normal" ? o.modo : previo.modo;
  return { mic: bool(o.mic, previo.mic), cascos: bool(o.cascos, previo.cascos), radio: bool(o.radio, previo.radio), modo };
}
