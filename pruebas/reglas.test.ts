// Una prueba por regla de src/seguridad/reglas.ts. `npm test` (node:test con tipos quitados; sin React Native).
/// <reference types="node" />
import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  crearLimiteAjustes,
  destinoUrl,
  frameAjuste,
  leerEnlaceLink,
  leerEstado,
  leerVinculo,
  modeloSeguro,
  sanearTexto,
  volumen,
  type EstadoVoz,
} from "../src/seguridad/reglas.ts";

describe("destinoUrl: lista blanca de la WebView", () => {
  test("store, vote, radio y www se abren dentro", () => {
    for (const h of ["store", "vote", "radio", "www"]) assert.equal(destinoUrl(`https://${h}.minetoy.fun/es`), "dentro");
  });
  test("el apex minetoy.fun no es web (registro A del juego): al navegador", () => {
    assert.equal(destinoUrl("https://minetoy.fun/"), "navegador");
  });
  test("voicechat va a la pestaña nativa de voz", () => {
    assert.equal(destinoUrl("https://voicechat.minetoy.fun/K7Q2XM"), "voz");
  });
  test("http sin cifrar se bloquea, también en nuestros hosts", () => {
    assert.equal(destinoUrl("http://store.minetoy.fun/"), "bloquear");
  });
  test("subdominios parecidos y otros sitios van al navegador", () => {
    for (const u of [
      "https://store.minetoy.fun.evil.com/",
      "https://evilstore.minetoy.fun/",
      "https://checkout.stripe.com/pay",
      "https://xstore.minetoy.fun/",
    ])
      assert.equal(destinoUrl(u), "navegador", u);
  });
  test("con usuario o puerto no se abre dentro", () => {
    assert.equal(destinoUrl("https://a@store.minetoy.fun/"), "navegador");
    assert.equal(destinoUrl("https://store.minetoy.fun:8443/"), "navegador");
  });
  test("javascript:, file:, intent: y esquemas propios se bloquean", () => {
    for (const u of ["javascript:alert(1)", "file:///etc/hosts", "intent://x#Intent;end", "minetoy://link/K7Q2XM", "content://x"])
      assert.equal(destinoUrl(u), "bloquear", u);
  });
  test("mailto: y tel: al sistema; about:/blob:/data: se quedan en la página", () => {
    assert.equal(destinoUrl("mailto:a@b.c"), "sistema");
    assert.equal(destinoUrl("tel:+34600000000"), "sistema");
    assert.equal(destinoUrl("about:blank"), "pagina");
  });
  test("lo que no es una URL se bloquea", () => {
    assert.equal(destinoUrl("no es una url"), "bloquear");
  });
});

describe("leerVinculo: QR, enlace o código de /vc", () => {
  test("código escrito, normalizado", () => {
    assert.deepEqual(leerVinculo(" k7q-2xm "), { codigo: "K7Q2XM" });
  });
  test("enlace corto con y sin idioma", () => {
    assert.deepEqual(leerVinculo("https://voicechat.minetoy.fun/K7Q2XM"), { codigo: "K7Q2XM" });
    assert.deepEqual(leerVinculo("https://voicechat.minetoy.fun/en/k7q2xm/"), { codigo: "K7Q2XM" });
  });
  test("enlace largo con token de 43 caracteres base64url", () => {
    const t = "A".repeat(42) + "_";
    assert.deepEqual(leerVinculo(`https://voicechat.minetoy.fun/#t=${t}`), { token: t });
    assert.equal(leerVinculo(`https://voicechat.minetoy.fun/#t=${t}A`), null);
  });
  test("letras fuera del alfabeto (0, 1, I, L, O) no valen", () => {
    for (const c of ["K7Q2X0", "K7Q2X1", "K7Q2XI", "K7Q2XL", "K7Q2XO"]) assert.equal(leerVinculo(c), null, c);
  });
  test("otro host u otro esquema no valen", () => {
    assert.equal(leerVinculo("https://voicechat.minetoy.fun.evil.com/K7Q2XM"), null);
    assert.equal(leerVinculo("http://voicechat.minetoy.fun/K7Q2XM"), null);
  });
  test("tope de largo", () => {
    assert.equal(leerVinculo("K".repeat(500)), null);
  });
});

describe("leerEnlaceLink: /link de cuentas", () => {
  test("rutas de la tienda a la página canónica", () => {
    assert.equal(leerEnlaceLink("https://store.minetoy.fun/link/K7Q2XM"), "https://store.minetoy.fun/es/cuenta/link/K7Q2XM");
    assert.equal(leerEnlaceLink("https://store.minetoy.fun/en/cuenta/link/k7q2xm"), "https://store.minetoy.fun/en/cuenta/link/K7Q2XM");
    assert.equal(leerEnlaceLink("minetoy://link/K7Q2XM"), "https://store.minetoy.fun/es/cuenta/link/K7Q2XM");
  });
  test("código inválido: no se carga nada", () => {
    for (const u of [
      "https://store.minetoy.fun/link/K7Q2X0",
      "https://store.minetoy.fun/link/K7Q2XMM",
      "https://store.minetoy.fun/link/%3Cscript%3E",
      "https://store.minetoy.fun/link/K7Q2XM?next=//evil.com",
    ])
      assert.equal(leerEnlaceLink(u), null, u);
  });
  test("solo hacia store.minetoy.fun", () => {
    assert.equal(leerEnlaceLink("https://vote.minetoy.fun/link/K7Q2XM"), null);
    assert.equal(leerEnlaceLink("https://store.minetoy.fun.evil.com/link/K7Q2XM"), null);
  });
});

describe("límites hacia voz-control", () => {
  test("volumen: entero 0–200; lo que no es número, 100", () => {
    assert.equal(volumen(152.4), 152);
    assert.equal(volumen(-5), 0);
    assert.equal(volumen(999), 200);
    assert.equal(volumen(Number.NaN), 100);
    assert.equal(volumen("50"), 100);
    assert.ok(Number.isInteger(volumen(99.5)));
  });
  test("ajuste: como mucho 8 cada 5 s", () => {
    const permitir = crearLimiteAjustes();
    for (let i = 0; i < 8; i++) assert.equal(permitir(1000 + i), true);
    assert.equal(permitir(1010), false);
    assert.equal(permitir(6001), true);
  });
  test("frame ajuste exacto y sin campos de más", () => {
    assert.deepEqual(frameAjuste("mic", false), { t: "ajuste", que: "mic", v: false });
    assert.deepEqual(Object.keys(frameAjuste("cascos", true) ?? {}), ["t", "que", "v"]);
    assert.equal(frameAjuste("radio", true), null);
    assert.equal(frameAjuste("mic", "false"), null);
  });
});

describe("leerEstado: estado de voz-control", () => {
  const previo: EstadoVoz = { mic: true, cascos: true, radio: true, modo: "normal" };
  test("radio sigue al servidor", () => {
    assert.equal(leerEstado({ radio: false }, previo).radio, false);
    assert.equal(leerEstado({ radio: true }, { ...previo, radio: false }).radio, true);
  });
  test("tipos inesperados no cambian nada", () => {
    assert.deepEqual(leerEstado({ mic: "no", cascos: 0, radio: null, modo: "chillido" }, previo), previo);
    assert.deepEqual(leerEstado(null, previo), previo);
  });
  test("modo válido se aplica", () => {
    assert.equal(leerEstado({ modo: "grito" }, previo).modo, "grito");
  });
});

describe("saneado de texto", () => {
  test("quita controles, bidi y ancho cero; NFC y tope", () => {
    assert.equal(sanearTexto("a‮b​c\u0007d", 50), "abcd");
    assert.equal(sanearTexto("é", 5), "é");
    assert.equal(sanearTexto("x".repeat(100), 10).length, 10);
    assert.equal(sanearTexto(42, 10), "");
  });
  test("modelo del teléfono con el patrón de voz-control", () => {
    assert.equal(modeloSeguro("iPhone 15 Pro Max"), "iPhone 15 Pro Max");
    assert.equal(modeloSeguro("<img src=x>‮"), "img srcx");
    assert.equal(modeloSeguro("😀"), undefined);
    assert.ok((modeloSeguro("a".repeat(300)) ?? "").length <= 64);
    assert.match(modeloSeguro("Pixel 9 (Pro) +5G, ed.") ?? "", /^[\w .,()+-]{0,64}$/);
  });
});
