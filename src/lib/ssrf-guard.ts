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
 */

import { lookup } from "node:dns/promises";

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

/** Endpoints de metadatos conocidos, por IP. */
const METADATA_ADDRESSES = new Set([
  "169.254.169.254", // AWS, GCP, Azure, DigitalOcean, OpenStack
  "169.254.170.2", // AWS ECS task metadata
  "100.100.100.200", // Alibaba Cloud
  "fd00:ec2::254", // AWS IMDSv2 sobre IPv6
]);

function ipv4ToInt(ip: string): number | null {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;
  let value = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    value = value * 256 + n;
  }
  return value;
}

/** Rangos IPv4 que no deben alcanzarse desde un webhook saliente. */
const IPV4_BLOCKED_RANGES: Array<{ cidr: string; label: string }> = [
  { cidr: "0.0.0.0/8", label: "red actual" },
  { cidr: "10.0.0.0/8", label: "privada" },
  { cidr: "100.64.0.0/10", label: "CGNAT" },
  { cidr: "127.0.0.0/8", label: "loopback" },
  { cidr: "169.254.0.0/16", label: "link-local / metadatos cloud" },
  { cidr: "172.16.0.0/12", label: "privada" },
  { cidr: "192.0.0.0/24", label: "reservada IETF" },
  { cidr: "192.0.2.0/24", label: "documentación" },
  { cidr: "192.168.0.0/16", label: "privada" },
  { cidr: "198.18.0.0/15", label: "benchmarking" },
  { cidr: "198.51.100.0/24", label: "documentación" },
  { cidr: "203.0.113.0/24", label: "documentación" },
  { cidr: "224.0.0.0/4", label: "multicast" },
  { cidr: "240.0.0.0/4", label: "reservada" },
];

function inCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split("/");
  const bits = Number(bitsRaw);
  const ipInt = ipv4ToInt(ip);
  const baseInt = ipv4ToInt(base);
  if (ipInt === null || baseInt === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return (ipInt & mask) === (baseInt & mask);
}

function isBlockedIpv6(ip: string): string | null {
  const normalized = ip.toLowerCase().split("%")[0];

  if (normalized === "::1" || normalized === "::") return "loopback";
  if (normalized.startsWith("fe80:")) return "link-local";
  // fc00::/7 — direcciones únicas locales.
  if (/^f[cd][0-9a-f]{2}:/.test(normalized)) return "privada (ULA)";
  if (normalized.startsWith("ff")) return "multicast";

  // IPv4 mapeada (::ffff:10.0.0.1) — se valida como IPv4.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped) {
    const v4 = checkIpv4(mapped[1]);
    return v4;
  }

  if (METADATA_ADDRESSES.has(normalized)) return "metadatos cloud";
  return null;
}

function checkIpv4(ip: string): string | null {
  if (METADATA_ADDRESSES.has(ip)) return "metadatos cloud";
  for (const range of IPV4_BLOCKED_RANGES) {
    if (inCidr(ip, range.cidr)) return range.label;
  }
  return null;
}

/** Devuelve el motivo del bloqueo, o `null` si la dirección es pública. */
export function classifyAddress(ip: string): string | null {
  return ip.includes(":") ? isBlockedIpv6(ip) : checkIpv4(ip);
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
  options: { requireHttps?: boolean; allowPrivateInDev?: boolean } = {},
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

  // Literal IP: se valida sin pasar por DNS.
  const literal = classifyAddress(hostname);
  if (literal) {
    return {
      ok: false,
      reason: "private_address",
      message: `El destino apunta a una dirección ${literal}.`,
    };
  }

  // Resolución DNS: hay que comprobar TODAS las respuestas. Un nombre público
  // puede resolver a una dirección interna.
  let addresses: string[];
  try {
    const records = await lookup(hostname, { all: true, verbatim: true });
    addresses = records.map((r) => r.address);
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

  const allowPrivate = options.allowPrivateInDev && process.env.NODE_ENV !== "production";

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
}

/**
 * `fetch` con protección contra SSRF.
 *
 * - Valida el destino **antes** de cada salto.
 * - `redirect: "manual"`: cada redirección se valida de nuevo. Con el
 *   comportamiento por defecto, un destino público podía devolver un 302 hacia
 *   `169.254.169.254` y la petición lo seguía sin comprobar nada.
 * - Timeout y tope de lectura del cuerpo.
 * - **Nunca devuelve el cuerpo de la respuesta al llamador**: si lo hiciera,
 *   un destino elegido por el cliente podría usarse para leer servicios
 *   internos y ver el resultado.
 */
export async function safeFetch(
  rawUrl: string,
  init: RequestInit & { timeoutMs?: number } = {},
): Promise<SafeFetchResult> {
  const { timeoutMs = 7000, ...requestInit } = init;

  let currentUrl = rawUrl;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const verdict = await validateOutboundUrl(currentUrl);
    if (!verdict.ok) {
      return { ok: false, error: verdict.message ?? "Destino no permitido" };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        ...requestInit,
        redirect: "manual",
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const message = err instanceof Error ? err.message : "error de red";
      return { ok: false, error: message.slice(0, 200) };
    }
    clearTimeout(timer);

    // Redirección: se valida el destino nuevo en la siguiente vuelta.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        return { ok: false, status: response.status, error: "Redirección sin destino" };
      }
      currentUrl = new URL(location, currentUrl).toString();
      continue;
    }

    // Se consume una cantidad acotada del cuerpo y se descarta: sólo importa
    // el código de estado.
    try {
      await readCapped(response);
    } catch {
      // Un cuerpo ilegible no invalida un 2xx.
    }

    return { ok: response.ok, status: response.status };
  }

  return { ok: false, error: "Demasiadas redirecciones" };
}

async function readCapped(response: Response): Promise<void> {
  const body = response.body;
  if (!body) return;
  const reader = body.getReader();
  let read = 0;
  while (read < MAX_RESPONSE_BYTES) {
    const { done, value } = await reader.read();
    if (done) break;
    read += value?.byteLength ?? 0;
  }
  await reader.cancel().catch(() => {});
}
