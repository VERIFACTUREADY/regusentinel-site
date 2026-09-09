/**
 * Validación de destinos outbound (Slack, Teams y webhook propio del cliente).
 *
 * ESTADO ANTERIOR
 * ---------------
 * `fetch(url, ...)` directo sobre una URL que escribe el cliente, sin ninguna
 * comprobación. Desde el servidor de la aplicación eso alcanza:
 *   - `http://169.254.169.254/...` — metadatos de la nube (credenciales IAM);
 *   - `http://localhost:5432` y demás servicios internos;
 *   - cualquier IP privada de la red del proveedor.
 * Además `fetch` sigue redirecciones por defecto, así que un destino público
 * podía responder `302` hacia una dirección interna.
 *
 * SEGUNDO ESTADO: VALIDAR Y LUEGO `fetch(url)` — INSUFICIENTE
 * -----------------------------------------------------------
 * La primera corrección resolvía el DNS, comprobaba todas las direcciones y
 * después llamaba a `fetch(url)`. Pero `fetch` **vuelve a resolver el nombre**:
 * entre la comprobación y la conexión hay una ventana en la que el atacante
 * controla qué IP se usa. Es DNS rebinding clásico: se publica el nombre con
 * TTL 0 apuntando primero a una IP pública (que pasa la validación) y, en la
 * segunda resolución —milisegundos después—, a `169.254.169.254`. La validación
 * decía "público" y la conexión iba a los metadatos de la nube.
 *
 * AHORA: LA CONEXIÓN VA A LA IP QUE SE VALIDÓ
 * --------------------------------------------
 * `safeFetch` no usa `fetch`. Usa `https.request`/`http.request` con un
 * `lookup` propio que **no resuelve nada**: devuelve la dirección concreta que
 * ya pasó la comprobación. No hay segunda resolución, así que no hay ventana.
 *
 * Se conservan las tres cosas que un proxy mal hecho rompe:
 *   - la cabecera `Host` es el nombre original;
 *   - el `servername` (SNI) es el nombre original;
 *   - la validación del certificado se hace contra ese nombre, no contra la IP.
 *
 * La clasificación de direcciones ya no la hace aritmética escrita a mano, sino
 * `ipaddr.js`, que entiende todas las representaciones de IPv6 (`fe80::1` y
 * `febf::1` son ambas link-local; `::ffff:10.0.0.1`, `::ffff:a00:1` y
 * `0:0:0:0:0:ffff:10.0.0.1` son la misma IPv4 mapeada).
 */

import { lookup as dnsLookup } from "node:dns/promises";
import { request as httpsRequest } from "node:https";
import { request as httpRequest, type IncomingMessage } from "node:http";
import type { LookupAddress } from "node:dns";
import ipaddr from "ipaddr.js";

export type SsrfRejection =
  | "invalid_url"
  | "scheme_not_allowed"
  | "credentials_in_url"
  | "port_not_allowed"
  | "hostname_not_allowed"
  | "dns_failure"
  | "private_address"
  | "too_many_redirects";

export interface SsrfVerdict {
  ok: boolean;
  reason?: SsrfRejection;
  message?: string;
  /** IPs resueltas que superaron la comprobación. */
  addresses?: string[];
}

/** Puertos admitidos. Evita usar el servidor como escáner de puertos. */
const ALLOWED_PORTS = new Set([80, 443, 8443]);

/**
 * Nombres que nunca son destinos legítimos. La comprobación por IP de abajo ya
 * los cubre casi todos, pero cortar aquí da un mensaje claro y ahorra el DNS.
 */
const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "ip6-localhost",
  "ip6-loopback",
  // Metadatos de proveedores cloud.
  "metadata",
  "metadata.google.internal",
  "metadata.goog",
  "instance-data",
]);

/**
 * Endpoints de metadatos conocidos. Se normalizan antes de comparar para que
 * `fd00:ec2:0:0:0:0:0:254` y `fd00:ec2::254` sean la misma entrada.
 */
const METADATA_ADDRESSES = [
  "169.254.169.254", // AWS, GCP, Azure, DigitalOcean, OpenStack
  "169.254.170.2", // AWS ECS task metadata
  "100.100.100.200", // Alibaba Cloud
  "fd00:ec2::254", // AWS IMDSv2 sobre IPv6
].map((a) => ipaddr.parse(a).toNormalizedString());

/**
 * ÚNICO rango admitido: unicast público. Todo lo demás se rechaza.
 *
 * Es una lista blanca a propósito: una lista negra deja fuera cualquier rango
 * que `ipaddr.js` clasifique con un nombre que no hayamos previsto, y el fallo
 * sería permitir la conexión.
 *
 * Etiquetas de `ipaddr.js` que quedan fuera y por qué:
 *   IPv4  unspecified, broadcast, multicast, linkLocal, loopback, private,
 *         carrierGradeNat, reserved
 *   IPv6  unspecified, multicast, linkLocal (todo fe80::/10), uniqueLocal
 *         (fc00::/7), loopback, reserved, ipv4Mapped, rfc6145, rfc6052,
 *         6to4, teredo
 */
const RANGOS_PERMITIDOS = new Set(["unicast"]);

/** Etiquetas legibles para el mensaje de rechazo. */
const ETIQUETAS: Record<string, string> = {
  unspecified: "no especificada",
  broadcast: "de difusión",
  multicast: "multicast",
  linkLocal: "link-local",
  loopback: "loopback",
  private: "privada",
  uniqueLocal: "privada (ULA)",
  carrierGradeNat: "CGNAT",
  reserved: "reservada",
  ipv4Mapped: "IPv4 mapeada",
  rfc6145: "de traducción IPv4/IPv6",
  rfc6052: "de traducción IPv4/IPv6",
  "6to4": "6to4",
  teredo: "Teredo",
};

/**
 * Site-local (`fec0::/10`), obsoleto por RFC 3879 pero todavía enrutable en
 * redes internas. `ipaddr.js` lo clasifica como `unicast`, así que se corta
 * aquí de forma explícita.
 */
function esSiteLocalIpv6(dir: ipaddr.IPv6): boolean {
  return (dir.parts[0] & 0xffc0) === 0xfec0;
}

/**
 * Devuelve el motivo del bloqueo, o `null` si la dirección es pública.
 *
 * Una IPv4 mapeada en IPv6 se rechaza siempre: nunca es un destino legítimo de
 * un webhook, y aceptarla obligaría a razonar sobre la equivalencia entre dos
 * espacios de direcciones en cada comprobación posterior. Antes se
 * desenvolvía y se validaba como IPv4, pero sólo si venía escrita con el
 * cuarteto decimal (`::ffff:10.0.0.1`); en su forma hexadecimal
 * (`::ffff:a00:1`) la expresión regular no la reconocía y la dejaba pasar.
 */
export function classifyAddress(ip: string): string | null {
  const limpio = ip.trim().replace(/^\[|\]$/g, "").split("%")[0];

  let dir: ipaddr.IPv4 | ipaddr.IPv6;
  try {
    dir = ipaddr.parse(limpio);
  } catch {
    // No es una IP: no hay nada que clasificar aquí (un nombre se valida por
    // DNS más adelante).
    return null;
  }

  if (METADATA_ADDRESSES.includes(dir.toNormalizedString())) return "metadatos cloud";

  if (dir.kind() === "ipv6") {
    const v6 = dir as ipaddr.IPv6;
    if (esSiteLocalIpv6(v6)) return "site-local";
    // Una mapeada puede envolver una IPv4 privada; se comprueba también el
    // interior para que el mensaje sea informativo.
    if (v6.isIPv4MappedAddress()) {
      const interior = v6.toIPv4Address().range();
      const etiqueta = ETIQUETAS[interior] ?? interior;
      return interior === "unicast" ? "IPv4 mapeada" : `IPv4 mapeada ${etiqueta}`;
    }
  }

  const rango = dir.range();
  if (RANGOS_PERMITIDOS.has(rango)) return null;

  return ETIQUETAS[rango] ?? rango;
}

/**
 * Valida una URL de destino: esquema, credenciales, puerto, nombre y **todas**
 * las direcciones a las que resuelve.
 *
 * En producción exige HTTPS. En desarrollo se permite HTTP para poder probar
 * contra un receptor local, pero las direcciones privadas se siguen
 * rechazando salvo que `allowPrivateInDev` sea explícito.
 */
export async function validateOutboundUrl(
  rawUrl: string,
  options: {
    requireHttps?: boolean;
    allowPrivateInDev?: boolean;
    /** Resolutor inyectable. Sólo para pruebas: en producción es el DNS real. */
    resolver?: (hostname: string) => Promise<string[]>;
  } = {},
): Promise<SsrfVerdict> {
  const requireHttps = options.requireHttps ?? process.env.NODE_ENV === "production";

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: "invalid_url", message: "La URL no es válida." };
  }

  if (url.protocol !== "https:" && url.protocol !== "http:") {
    return {
      ok: false,
      reason: "scheme_not_allowed",
      message: "Sólo se admiten URLs http o https.",
    };
  }

  if (requireHttps && url.protocol !== "https:") {
    return {
      ok: false,
      reason: "scheme_not_allowed",
      message: "La URL debe usar HTTPS.",
    };
  }

  // Credenciales embebidas: se usan para camuflar el host real y no tienen
  // ningún uso legítimo aquí.
  if (url.username || url.password) {
    return {
      ok: false,
      reason: "credentials_in_url",
      message: "La URL no puede incluir usuario ni contraseña.",
    };
  }

  const port = url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80;
  if (!ALLOWED_PORTS.has(port)) {
    return {
      ok: false,
      reason: "port_not_allowed",
      message: `Puerto no admitido (${port}). Sólo 80, 443 y 8443.`,
    };
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");

  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost")) {
    return {
      ok: false,
      reason: "hostname_not_allowed",
      message: "El destino apunta a la propia máquina.",
    };
  }

  // `.internal`, `.local` y demás dominios de resolución interna.
  if (/\.(internal|local|localdomain|home\.arpa)$/.test(hostname)) {
    return {
      ok: false,
      reason: "hostname_not_allowed",
      message: "El destino apunta a un dominio de red interna.",
    };
  }

  const allowPrivate = options.allowPrivateInDev && process.env.NODE_ENV !== "production";

  // Literal IP: se valida sin pasar por DNS. `ipaddr.isValid` distingue una IP
  // de un nombre; antes se llamaba a `classifyAddress` y un `null` significaba
  // a la vez "es pública" y "no es una IP".
  if (ipaddr.isValid(hostname)) {
    const literal = classifyAddress(hostname);
    if (literal && !allowPrivate) {
      return {
        ok: false,
        reason: "private_address",
        message: `El destino apunta a una dirección ${literal}.`,
      };
    }
    return { ok: true, addresses: [hostname] };
  }

  // Resolución DNS: hay que comprobar TODAS las respuestas. Un nombre público
  // puede resolver a una dirección interna.
  let addresses: string[];
  try {
    addresses = options.resolver
      ? await options.resolver(hostname)
      : (await dnsLookup(hostname, { all: true, verbatim: true })).map((r) => r.address);
  } catch {
    return {
      ok: false,
      reason: "dns_failure",
      message: "No se pudo resolver el nombre del destino.",
    };
  }

  if (addresses.length === 0) {
    return { ok: false, reason: "dns_failure", message: "El destino no resuelve a ninguna dirección." };
  }

  for (const address of addresses) {
    const blocked = classifyAddress(address);
    if (blocked && !allowPrivate) {
      return {
        ok: false,
        reason: "private_address",
        message: `El destino resuelve a una dirección ${blocked} (${address}).`,
        addresses,
      };
    }
  }

  return { ok: true, addresses };
}

/** Límite de cuerpo leído de la respuesta del destino. */
export const MAX_RESPONSE_BYTES = 64 * 1024;
const MAX_REDIRECTS = 3;

export interface SafeFetchResult {
  ok: boolean;
  status?: number;
  /** Motivo del rechazo o del fallo de red. Nunca incluye el cuerpo remoto. */
  error?: string;
  /** Direcciones a las que realmente se conectó, en orden de salto. */
  connectedTo?: string[];
}

export interface SafeFetchOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  /**
   * Plazo TOTAL de la operación: resolución, conexión, TLS, cabeceras y
   * lectura del cuerpo. Antes el `AbortController` sólo cubría hasta que
   * `fetch` resolvía —es decir, hasta las cabeceras— y un servidor que
   * enviaba el cuerpo a un byte por minuto mantenía la conexión abierta
   * indefinidamente.
   */
  timeoutMs?: number;
  /** Resolutor inyectable. Sólo para pruebas. */
  resolver?: (hostname: string) => Promise<string[]>;
  /**
   * Transporte inyectable. Por defecto, `conectarAIpFijada`, que es la
   * implementación real. Se expone para que las pruebas puedan observar a QUÉ
   * dirección se pide la conexión sin depender de la red: es la única forma
   * estable de demostrar que la conexión usa la IP validada y no el resultado
   * de una segunda resolución.
   */
  dispatcher?: Transporte;
}

export interface RespuestaAcotada {
  status: number;
  location: string | null;
}

export type Transporte = (
  rawUrl: string,
  ip: string,
  opciones: { method: string; headers: Record<string, string>; body?: string; timeoutMs: number },
) => Promise<RespuestaAcotada>;

/**
 * Petición saliente con protección contra SSRF.
 *
 * - Valida el destino **antes** de cada salto.
 * - Conecta a la IP validada, sin volver a resolver el nombre.
 * - Redirecciones manuales: cada `Location` se valida de nuevo. Con el
 *   comportamiento por defecto, un destino público podía devolver un 302 hacia
 *   `169.254.169.254` y la petición lo seguía sin comprobar nada.
 * - Un único plazo cubre conexión, cabeceras y cuerpo.
 * - **Nunca devuelve el cuerpo de la respuesta al llamador**: si lo hiciera,
 *   un destino elegido por el cliente podría usarse para leer servicios
 *   internos y ver el resultado.
 */
export async function safeFetch(
  rawUrl: string,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const {
    timeoutMs = 7000,
    method = "GET",
    headers = {},
    body,
    resolver,
    dispatcher = transporteActivo,
  } = options;

  const limite = Date.now() + timeoutMs;
  let currentUrl = rawUrl;
  const connectedTo: string[] = [];

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const restante = limite - Date.now();
    if (restante <= 0) return { ok: false, error: "Tiempo agotado", connectedTo };

    const verdict = await validateOutboundUrl(currentUrl, { resolver });
    if (!verdict.ok) {
      return { ok: false, error: verdict.message ?? "Destino no permitido", connectedTo };
    }

    // Se fija la PRIMERA dirección validada. Todas pasaron la comprobación, así
    // que cualquiera vale; lo importante es que la conexión use una de ellas y
    // no el resultado de una resolución posterior.
    const ipFijada = verdict.addresses![0];
    connectedTo.push(ipFijada);

    let respuesta: RespuestaAcotada;
    try {
      respuesta = await dispatcher(currentUrl, ipFijada, {
        method,
        headers,
        body: hop === 0 ? body : undefined,
        timeoutMs: restante,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "error de red";
      return { ok: false, error: message.slice(0, 200), connectedTo };
    }

    // Redirección: se valida el destino nuevo en la siguiente vuelta.
    if (respuesta.status >= 300 && respuesta.status < 400) {
      const location = respuesta.location;
      if (!location) {
        return { ok: false, status: respuesta.status, error: "Redirección sin destino", connectedTo };
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    return {
      ok: respuesta.status >= 200 && respuesta.status < 300,
      status: respuesta.status,
      connectedTo,
    };
  }

  return { ok: false, error: "Demasiadas redirecciones", connectedTo };
}

/**
 * Ejecuta la petición conectando a `ip` pero hablando con el servidor como si
 * fuera `hostname`: cabecera `Host`, SNI y validación de certificado contra el
 * nombre. El `lookup` que se inyecta no consulta al DNS — devuelve la IP ya
 * validada, que es lo que cierra la ventana de rebinding.
 */
export const conectarAIpFijada: Transporte = function conectarAIpFijada(
  rawUrl,
  ip,
  opciones,
): Promise<RespuestaAcotada> {
  const url = new URL(rawUrl);
  const esHttps = url.protocol === "https:";
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const familia = ip.includes(":") ? 6 : 4;

  const lookupFijado = (
    _hostname: string,
    opcionesLookup: { all?: boolean } | undefined,
    callback: (
      err: NodeJS.ErrnoException | null,
      address: string | LookupAddress[],
      family?: number,
    ) => void,
  ) => {
    // No se consulta al DNS: se devuelve la dirección ya validada. Node llama
    // con `all: true` cuando usa conexión con familia automática, y entonces
    // espera un array de `{ address, family }` en vez de una cadena.
    if (opcionesLookup?.all) {
      callback(null, [{ address: ip, family: familia }]);
      return;
    }
    callback(null, ip, familia);
  };

  return new Promise<RespuestaAcotada>((resolve, reject) => {
    let terminado = false;

    const finalizar = (fn: () => void) => {
      if (terminado) return;
      terminado = true;
      clearTimeout(temporizador);
      fn();
    };

    const peticion = (esHttps ? httpsRequest : httpRequest)(
      {
        // `host`/`hostname` siguen siendo el nombre: de ahí salen la cabecera
        // Host por defecto y, en TLS, el SNI y el nombre contra el que se
        // valida el certificado.
        hostname,
        port: url.port ? Number(url.port) : esHttps ? 443 : 80,
        path: `${url.pathname}${url.search}`,
        method: opciones.method,
        headers: opciones.headers,
        lookup: lookupFijado as never,
        // Explícito aunque sea el valor por defecto: desactivarlo convertiría
        // el pinning en un canal sin autenticar.
        ...(esHttps ? { servername: hostname, rejectUnauthorized: true } : {}),
      },
      (respuesta: IncomingMessage) => {
        const status = respuesta.statusCode ?? 0;
        const location = respuesta.headers.location ?? null;

        // El cuerpo se consume acotado y se DESCARTA: sólo importa el estado.
        // El plazo sigue corriendo durante esta lectura.
        let leidos = 0;
        respuesta.on("data", (trozo: Buffer) => {
          leidos += trozo.length;
          if (leidos > MAX_RESPONSE_BYTES) {
            respuesta.destroy();
            finalizar(() => resolve({ status, location }));
          }
        });
        respuesta.on("end", () => finalizar(() => resolve({ status, location })));
        respuesta.on("error", () => finalizar(() => resolve({ status, location })));
      },
    );

    // Un único plazo para todo: conexión, TLS, cabeceras y cuerpo.
    const temporizador = setTimeout(() => {
      finalizar(() => {
        peticion.destroy();
        reject(new Error("Tiempo agotado"));
      });
    }, opciones.timeoutMs);

    // Plazo adicional a nivel de socket: corta una conexión que ni siquiera
    // llega a establecerse.
    peticion.setTimeout(opciones.timeoutMs, () => peticion.destroy(new Error("Tiempo agotado")));

    peticion.on("error", (err) => finalizar(() => reject(err)));

    if (opciones.body !== undefined) peticion.write(opciones.body);
    peticion.end();
  });
};

/**
 * Transporte que usa `safeFetch` cuando no se le pasa uno. En producción es
 * siempre `conectarAIpFijada`.
 *
 * El seam existe porque los emisores concretos (Slack, Teams, webhook propio)
 * llaman a `safeFetch` sin exponer sus opciones, y sus pruebas necesitan
 * observar la petición sin salir a la red. Sustituir `globalThis.fetch` ya no
 * sirve: precisamente lo que se corrigió es que dejáramos de usar `fetch`.
 */
let transporteActivo: Transporte = conectarAIpFijada;

/** Sólo para pruebas. Devuelve una función que restaura el transporte real. */
export function __setTransporteParaPruebas(t: Transporte): () => void {
  const anterior = transporteActivo;
  transporteActivo = t;
  return () => {
    transporteActivo = anterior;
  };
}
