/**
 * Proteccion SSRF de los destinos outbound.
 *
 * Antes no habia ninguna: `fetch(url)` directo sobre una URL escrita por el
 * cliente, siguiendo redirecciones y devolviendo el cuerpo remoto al llamador.
 * Desde el servidor eso alcanza los metadatos de la nube y cualquier servicio
 * interno.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// DNS controlado: las pruebas no deben depender de la red.
const lookupMock = vi.fn();
vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => lookupMock(...args),
}));

import { validateOutboundUrl, classifyAddress, safeFetch } from "../src/lib/ssrf-guard";

/** Resuelve cualquier nombre a la IP indicada. */
function resolvesTo(...ips: string[]) {
  lookupMock.mockResolvedValue(ips.map((address) => ({ address, family: address.includes(":") ? 6 : 4 })));
}

beforeEach(() => {
  lookupMock.mockReset();
  resolvesTo("93.184.216.34"); // dirección pública por defecto
});

describe("Clasificacion de direcciones", () => {
  const privadas: Array<[string, string]> = [
    ["127.0.0.1", "loopback"],
    ["127.5.5.5", "loopback"],
    ["10.0.0.1", "privada"],
    ["10.255.255.254", "privada"],
    ["172.16.0.1", "privada"],
    ["172.31.255.255", "privada"],
    ["192.168.1.1", "privada"],
    ["169.254.169.254", "metadatos cloud"],
    ["169.254.1.1", "link-local"],
    ["100.64.0.1", "CGNAT"],
    ["0.0.0.0", "red actual"],
    ["224.0.0.1", "multicast"],
    ["240.0.0.1", "reservada"],
    ["100.100.100.200", "metadatos cloud"],
    ["::1", "loopback"],
    ["fe80::1", "link-local"],
    ["fc00::1", "privada"],
    ["fd12:3456::1", "privada"],
    ["ff02::1", "multicast"],
    ["::ffff:10.0.0.1", "privada"],
  ];

  for (const [ip, etiqueta] of privadas) {
    it(`bloquea ${ip} (${etiqueta})`, () => {
      expect(classifyAddress(ip)).toBeTruthy();
    });
  }

  const publicas = ["93.184.216.34", "8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700::1111"];
  for (const ip of publicas) {
    it(`permite ${ip}`, () => {
      expect(classifyAddress(ip)).toBeNull();
    });
  }

  it("172.15.x y 172.32.x NO son privadas (el rango es /12, no /8)", () => {
    expect(classifyAddress("172.15.0.1")).toBeNull();
    expect(classifyAddress("172.32.0.1")).toBeNull();
    expect(classifyAddress("172.16.0.1")).toBeTruthy();
    expect(classifyAddress("172.31.0.1")).toBeTruthy();
  });
});

describe("Validacion de URL", () => {
  it("rechaza localhost", async () => {
    const r = await validateOutboundUrl("https://localhost/hook");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("hostname_not_allowed");
  });

  it("rechaza 127.0.0.1 como literal", async () => {
    const r = await validateOutboundUrl("https://127.0.0.1/hook");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("private_address");
  });

  it("rechaza [::1] como literal", async () => {
    const r = await validateOutboundUrl("https://[::1]/hook");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("private_address");
  });

  it("rechaza una IP privada literal", async () => {
    const r = await validateOutboundUrl("https://10.1.2.3/hook");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("private_address");
  });

  it("rechaza el endpoint de metadatos cloud", async () => {
    const r = await validateOutboundUrl("http://169.254.169.254/latest/meta-data/", {
      requireHttps: false,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("private_address");
  });

  it("rechaza metadata.google.internal por nombre", async () => {
    const r = await validateOutboundUrl("http://metadata.google.internal/", { requireHttps: false });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("hostname_not_allowed");
  });

  it("rechaza un nombre PUBLICO que resuelve a una IP privada (DNS rebinding)", async () => {
    // El nombre no delata nada: sólo la resolución lo revela.
    resolvesTo("10.0.0.5");
    const r = await validateOutboundUrl("https://parece-publico.example.com/hook");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("private_address");
  });

  it("rechaza si CUALQUIERA de las IPs resueltas es privada", async () => {
    resolvesTo("93.184.216.34", "192.168.0.7");
    const r = await validateOutboundUrl("https://mixto.example.com/hook");
    expect(r.ok).toBe(false);
  });

  it("permite un webhook HTTPS publico", async () => {
    resolvesTo("93.184.216.34");
    const r = await validateOutboundUrl("https://hooks.slack.com/services/T/B/X");
    expect(r.ok).toBe(true);
    expect(r.addresses).toContain("93.184.216.34");
  });

  it("exige HTTPS cuando se pide", async () => {
    const r = await validateOutboundUrl("http://ejemplo.com/hook", { requireHttps: true });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("scheme_not_allowed");
  });

  it("rechaza esquemas que no son http/https", async () => {
    for (const url of ["file:///etc/passwd", "gopher://x/", "ftp://x/"]) {
      const r = await validateOutboundUrl(url);
      expect(r.ok).toBe(false);
    }
  });

  it("rechaza credenciales embebidas en la URL", async () => {
    const r = await validateOutboundUrl("https://user:pass@ejemplo.com/hook");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("credentials_in_url");
  });

  it("rechaza puertos fuera de la lista permitida", async () => {
    const r = await validateOutboundUrl("https://ejemplo.com:5432/hook");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("port_not_allowed");
  });

  it("rechaza dominios de red interna", async () => {
    for (const host of ["srv.internal", "nas.local", "db.home.arpa"]) {
      const r = await validateOutboundUrl(`https://${host}/hook`);
      expect(r.ok).toBe(false);
      expect(r.reason).toBe("hostname_not_allowed");
    }
  });

  it("rechaza si el DNS no resuelve", async () => {
    lookupMock.mockRejectedValue(new Error("ENOTFOUND"));
    const r = await validateOutboundUrl("https://no-existe.example.com/hook");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("dns_failure");
  });

  it("rechaza una URL mal formada", async () => {
    const r = await validateOutboundUrl("no-es-una-url");
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("invalid_url");
  });
});

describe("safeFetch: redirecciones y fuga de contenido", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("NO sigue una redireccion hacia una direccion privada", async () => {
    resolvesTo("93.184.216.34");

    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("publico")) {
        // Destino público que redirige a los metadatos de la nube.
        return new Response(null, {
          status: 302,
          headers: { location: "http://169.254.169.254/latest/meta-data/" },
        });
      }
      throw new Error("No deberia haberse solicitado el destino interno");
    });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const r = await safeFetch("https://publico.example.com/hook", { method: "POST" });

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/metadatos|link-local/i);
    // La segunda petición nunca se llegó a hacer.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("no devuelve el cuerpo de la respuesta al llamador", async () => {
    resolvesTo("93.184.216.34");
    globalThis.fetch = (async () =>
      new Response("SECRETO-INTERNO-QUE-NO-DEBE-SALIR", { status: 200 })) as unknown as typeof fetch;

    const r = await safeFetch("https://ejemplo.com/hook", { method: "POST" });

    expect(r.ok).toBe(true);
    expect(JSON.stringify(r)).not.toContain("SECRETO-INTERNO");
  });

  it("rechaza el destino antes de conectar si es privado", async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const r = await safeFetch("https://10.0.0.1/hook", { method: "POST" });

    expect(r.ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sigue una redireccion hacia otro destino publico", async () => {
    resolvesTo("93.184.216.34");
    let call = 0;
    globalThis.fetch = (async () => {
      call++;
      return call === 1
        ? new Response(null, { status: 302, headers: { location: "https://otro.example.com/final" } })
        : new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;

    const r = await safeFetch("https://publico.example.com/hook", { method: "POST" });
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
  });

  it("corta un bucle de redirecciones", async () => {
    resolvesTo("93.184.216.34");
    globalThis.fetch = (async () =>
      new Response(null, {
        status: 302,
        headers: { location: "https://bucle.example.com/again" },
      })) as unknown as typeof fetch;

    const r = await safeFetch("https://bucle.example.com/hook", { method: "POST" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/redirecciones/i);
  });
});
