#!/usr/bin/env node
/**
 * Servidor SMTP de pruebas con bandeja consultable por HTTP.
 *
 * POR QUE NO MAILPIT
 * ------------------
 * Mailpit seria la opcion evidente, pero se distribuye como imagen de
 * contenedor y este entorno no puede descargarlas: el registro responde, pero
 * el CDN de capas devuelve 403. Antes que dejar el punto sin cubrir, aqui va un
 * equivalente: habla SMTP de verdad —nodemailer se conecta a el sin saber que
 * es de pruebas— y expone la bandeja por HTTP como hace Mailpit.
 *
 * Ademas no hay imagen que descargar, ni en local ni en CI, asi que la suite no
 * depende de que un registro externo este disponible.
 *
 * POR QUE IMPORTA
 * ---------------
 * La prueba anterior sacaba el `magicToken` directamente de PostgreSQL. Eso
 * comprueba que el token existe, no que el usuario reciba un correo con un
 * enlace que funcione. Entre ambas cosas caben todos los fallos que de verdad
 * se dan: que el correo no salga, que salga sin enlace, que el enlace apunte
 * mal, o que lleve un token distinto del que vale.
 *
 * API HTTP
 * --------
 *   GET  /mensajes            → todos los mensajes recibidos
 *   GET  /mensajes?para=x@y   → filtrados por destinatario
 *   POST /vaciar              → limpia la bandeja
 *   POST /averiar             → los siguientes envios fallan (para probar caidas)
 *   POST /reparar             → vuelve a aceptar
 *   GET  /salud               → 200 cuando esta listo
 *
 * Uso: node e2e/smtp-de-pruebas.mjs [--smtp 1025] [--http 8025]
 */
import net from "node:net";
import http from "node:http";

const args = process.argv.slice(2);
function opcion(nombre, pordefecto) {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? Number(args[i + 1]) : pordefecto;
}

const PUERTO_SMTP = opcion("smtp", 1025);
const PUERTO_HTTP = opcion("http", 8025);

/** @type {{de:string, para:string[], asunto:string, cuerpo:string, recibidoEn:string}[]} */
const bandeja = [];
let averiado = false;

// ── Decodificacion de cabeceras ────────────────────────────────────────────

/**
 * Deshace el plegado de lineas largas (RFC 5322): una cabecera puede continuar
 * en la linea siguiente si empieza por espacio o tabulador. Sin esto, un enlace
 * largo partido en dos se lee a medias.
 */
function desplegar(texto) {
  return texto.replace(/\r?\n[ \t]+/g, " ");
}

/** Decodifica `=?UTF-8?Q?...?=` y `=?UTF-8?B?...?=` (RFC 2047). */
function decodificarPalabras(texto) {
  return texto.replace(/=\?([^?]+)\?([QqBb])\?([^?]*)\?=/g, (_, juego, tipo, dato) => {
    try {
      if (tipo.toUpperCase() === "B") {
        return Buffer.from(dato, "base64").toString(juego);
      }
      const bytes = dato
        .replace(/_/g, " ")
        .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
      return Buffer.from(bytes, "binary").toString(juego);
    } catch {
      return dato;
    }
  });
}

/** Decodifica el cuerpo segun su Content-Transfer-Encoding. */
function decodificarCuerpo(cuerpo, codificacion) {
  const c = (codificacion ?? "").toLowerCase();
  if (c.includes("base64")) {
    return Buffer.from(cuerpo.replace(/\s+/g, ""), "base64").toString("utf8");
  }
  if (c.includes("quoted-printable")) {
    return cuerpo
      // Los "=" al final de linea son cortes blandos, no caracteres.
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
  }
  return cuerpo;
}

function analizar(datos) {
  const corte = datos.indexOf("\r\n\r\n");
  const crudoCabeceras = corte >= 0 ? datos.slice(0, corte) : datos;
  const crudoCuerpo = corte >= 0 ? datos.slice(corte + 4) : "";

  const cabeceras = {};
  for (const linea of desplegar(crudoCabeceras).split(/\r?\n/)) {
    const p = linea.indexOf(":");
    if (p > 0) cabeceras[linea.slice(0, p).trim().toLowerCase()] = linea.slice(p + 1).trim();
  }

  return {
    asunto: decodificarPalabras(cabeceras["subject"] ?? ""),
    cuerpo: decodificarCuerpo(crudoCuerpo, cabeceras["content-transfer-encoding"]),
    cabeceras,
  };
}

// ── Servidor SMTP ──────────────────────────────────────────────────────────

const servidorSmtp = net.createServer((socket) => {
  let de = "";
  let para = [];
  let enDatos = false;
  let datos = "";
  let resto = "";

  socket.setEncoding("utf8");
  socket.write("220 smtp-de-pruebas listo\r\n");

  socket.on("data", (trozo) => {
    resto += trozo;

    while (true) {
      const fin = resto.indexOf("\r\n");
      if (fin < 0) break;
      const linea = resto.slice(0, fin);
      resto = resto.slice(fin + 2);

      if (enDatos) {
        // Un punto solo cierra el mensaje.
        if (linea === ".") {
          enDatos = false;
          const { asunto, cuerpo } = analizar(datos);
          bandeja.push({
            de,
            para: [...para],
            asunto,
            cuerpo,
            recibidoEn: new Date().toISOString(),
          });
          datos = "";
          de = "";
          para = [];
          socket.write("250 2.0.0 Ok: aceptado\r\n");
        } else {
          // "Transparencia de punto": un punto inicial se duplica al enviar.
          datos += (linea.startsWith("..") ? linea.slice(1) : linea) + "\r\n";
        }
        continue;
      }

      const orden = linea.split(" ")[0].toUpperCase();

      if (orden === "EHLO" || orden === "HELO") {
        socket.write("250-smtp-de-pruebas\r\n250 8BITMIME\r\n");
      } else if (orden === "MAIL") {
        if (averiado) {
          // Fallo permanente: nodemailer lo propaga como excepcion, que es lo
          // que la aplicacion tiene que saber gestionar.
          socket.write("550 5.3.0 Averiado a proposito\r\n");
        } else {
          de = (linea.match(/<([^>]*)>/) ?? [, ""])[1];
          socket.write("250 2.1.0 Ok\r\n");
        }
      } else if (orden === "RCPT") {
        if (averiado) {
          socket.write("550 5.3.0 Averiado a proposito\r\n");
        } else {
          para.push((linea.match(/<([^>]*)>/) ?? [, ""])[1]);
          socket.write("250 2.1.5 Ok\r\n");
        }
      } else if (orden === "DATA") {
        if (averiado) {
          socket.write("554 5.3.0 Averiado a proposito\r\n");
        } else {
          enDatos = true;
          socket.write("354 Adelante\r\n");
        }
      } else if (orden === "RSET") {
        de = "";
        para = [];
        socket.write("250 2.0.0 Ok\r\n");
      } else if (orden === "QUIT") {
        socket.write("221 2.0.0 Adios\r\n");
        socket.end();
      } else if (orden === "AUTH") {
        // Se acepta cualquier credencial: esto es un banco de pruebas.
        socket.write("235 2.7.0 Autenticado\r\n");
      } else {
        socket.write("250 2.0.0 Ok\r\n");
      }
    }
  });

  socket.on("error", () => socket.destroy());
});

// ── API HTTP ───────────────────────────────────────────────────────────────

const servidorHttp = http.createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const responder = (codigo, cuerpo) => {
    res.writeHead(codigo, { "content-type": "application/json" });
    res.end(JSON.stringify(cuerpo));
  };

  if (url.pathname === "/salud") return responder(200, { ok: true });

  if (url.pathname === "/mensajes" && req.method === "GET") {
    const para = url.searchParams.get("para");
    const lista = para ? bandeja.filter((m) => m.para.includes(para)) : bandeja;
    return responder(200, lista);
  }

  if (url.pathname === "/vaciar" && req.method === "POST") {
    bandeja.length = 0;
    return responder(200, { vaciada: true });
  }

  if (url.pathname === "/averiar" && req.method === "POST") {
    averiado = true;
    return responder(200, { averiado });
  }

  if (url.pathname === "/reparar" && req.method === "POST") {
    averiado = false;
    return responder(200, { averiado });
  }

  responder(404, { error: "no encontrado" });
});

servidorSmtp.listen(PUERTO_SMTP, "127.0.0.1", () => {
  servidorHttp.listen(PUERTO_HTTP, "127.0.0.1", () => {
    console.log(`[smtp-de-pruebas] SMTP en ${PUERTO_SMTP}, bandeja en ${PUERTO_HTTP}`);
  });
});

for (const senal of ["SIGINT", "SIGTERM"]) {
  process.on(senal, () => {
    servidorSmtp.close();
    servidorHttp.close();
    process.exit(0);
  });
}
