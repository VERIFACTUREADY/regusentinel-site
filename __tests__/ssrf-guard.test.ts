/**
 * Proteccion SSRF de los destinos outbound.
 *
 * Antes no habia ninguna: `fetch(url)` directo sobre una URL escrita por el
 * cliente, siguiendo redirecciones y devolviendo el cuerpo remoto al llamador.
 * Desde el servidor eso alcanza los metadatos de la nube y cualquier servicio
 * interno.
 */
import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// DNS controlado: las pruebas no deben depender de la red.
const lookupMock = vi.fn();
vi.mock("node:dns/promises", () => ({
  lookup: (...args: unknown[]) => lookupMock(...args),
}));

import {
  validateOutboundUrl,
  classifyAddress,
  safeFetch,
  conectarAIpFijada,
  MAX_RESPONSE_BYTES,
  type Transporte,
} from "../src/lib/ssrf-guard";
import { createServer, type Server } from "node:http";
import { AddressInfo } from "node:net";

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
    // fe80::/10 COMPLETO: la comprobacion anterior era `startsWith("fe80:")`,
    // asi que fe81:: .. febf:: —el resto del rango link-local— pasaba.
    ["fe80::1", "link-local"],
    ["fe90::1", "link-local"],
    ["fea0::1", "link-local"],
    ["febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff", "link-local"],
    // Site-local, obsoleto pero enrutable en redes internas.
    ["fec0::1", "site-local"],
    // IPv4 mapeada en TODAS sus representaciones. La expresion regular
    // anterior solo reconocia la forma con cuarteto decimal.
    ["::ffff:a00:1", "IPv4 mapeada"],
    ["0:0:0:0:0:ffff:10.0.0.1", "IPv4 mapeada"],
    ["::ffff:169.254.169.254", "metadatos"],
    ["::ffff:7f00:1", "IPv4 mapeada"],
    ["::ffff:8.8.8.8", "IPv4 mapeada"],
    // Formas equivalentes del endpoint de metadatos IPv6 de AWS.
    ["fd00:ec2:0:0:0:0:0:254", "metadatos cloud"],
    // Rangos de traduccion y tunelado que pueden envolver direcciones internas.
    ["2002:0a00:0001::1", "6to4"],
    ["2001:0:0:0:0:0:0:1", "Teredo"],
    ["::", "no especificada"],
    ["255.255.255.255", "de difusion"],
  ];

  for (const [ip, etiqueta] of privadas) {
    it(`bloquea ${ip} (${etiqueta})`, () => {
      expect(classifyAddress(ip)).toBeTruthy();
    });
  }

  const publicas = ["93.184.216.34", "8.8.8.8", "1.1.1.1", "172.32.0.1", "2606:4700::1111", "fe00::1"];
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


/**
 * PINNING DE LA DIRECCION VALIDADA.
 *
 * La correccion anterior validaba el DNS y despues llamaba a `fetch(url)`, que
 * VUELVE A RESOLVER el nombre. Entre la comprobacion y la conexion hay una
 * ventana en la que el atacante decide a que IP se conecta: DNS rebinding.
 *
 * Estas pruebas usan el transporte inyectable para observar a que direccion se
 * pide la conexion. No dependen de la red, que es lo que hace inestable una
 * prueba de rebinding real, y demuestran exactamente el invariante: la
 * conexion usa la IP que paso la validacion.
 */
describe("safeFetch: la conexion usa la IP validada (anti DNS rebinding)", () => {
  /** Transporte de prueba: registra la IP pedida y devuelve una respuesta fija. */
  function transporteEspia(
    responder: (url: string, ip: string) => { status: number; location?: string | null },
  ) {
    const llamadas: Array<{ url: string; ip: string }> = [];
    const transporte: Transporte = async (url, ip) => {
      llamadas.push({ url, ip });
      const r = responder(url, ip);
      return { status: r.status, location: r.location ?? null };
    };
    return { transporte, llamadas };
  }

  it("se conecta a la IP resuelta en la validacion, no a una resolucion posterior", async () => {
    // Resolutor que hace rebinding: publica una IP publica la primera vez y el
    // endpoint de metadatos despues. Con `fetch(url)` la conexion habria usado
    // la SEGUNDA.
    let vez = 0;
    const resolver = async () => {
      vez++;
      return vez === 1 ? ["93.184.216.34"] : ["169.254.169.254"];
    };

    const { transporte, llamadas } = transporteEspia(() => ({ status: 200 }));

    const r = await safeFetch("https://rebinding.example.com/hook", {
      method: "POST",
      resolver,
      dispatcher: transporte,
    });

    expect(r.ok).toBe(true);
    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].ip).toBe("93.184.216.34");
    expect(r.connectedTo).toEqual(["93.184.216.34"]);
  });

  it("cada salto de redireccion se conecta a la IP que valido ESE salto", async () => {
    const porNombre: Record<string, string[]> = {
      "primero.example.com": ["93.184.216.34"],
      "segundo.example.com": ["151.101.1.140"],
    };
    const resolver = async (hostname: string) => porNombre[hostname] ?? ["8.8.8.8"];

    const { transporte, llamadas } = transporteEspia((url) =>
      url.includes("primero")
        ? { status: 302, location: "https://segundo.example.com/final" }
        : { status: 200 },
    );

    const r = await safeFetch("https://primero.example.com/hook", {
      resolver,
      dispatcher: transporte,
    });

    expect(r.ok).toBe(true);
    expect(llamadas.map((l) => l.ip)).toEqual(["93.184.216.34", "151.101.1.140"]);
  });

  it("NO sigue una redireccion hacia una direccion privada", async () => {
    const resolver = async () => ["93.184.216.34"];
    const { transporte, llamadas } = transporteEspia(() => ({
      status: 302,
      location: "http://169.254.169.254/latest/meta-data/",
    }));

    const r = await safeFetch("https://publico.example.com/hook", {
      resolver,
      dispatcher: transporte,
    });

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/metadatos|link-local/i);
    // La segunda conexion nunca se llego a pedir.
    expect(llamadas).toHaveLength(1);
  });

  it("rechaza el destino antes de conectar si es privado", async () => {
    const { transporte, llamadas } = transporteEspia(() => ({ status: 200 }));

    const r = await safeFetch("https://10.0.0.1/hook", { dispatcher: transporte });

    expect(r.ok).toBe(false);
    expect(llamadas).toHaveLength(0);
  });

  it("corta un bucle de redirecciones", async () => {
    const resolver = async () => ["93.184.216.34"];
    const { transporte } = transporteEspia(() => ({
      status: 302,
      location: "https://bucle.example.com/again",
    }));

    const r = await safeFetch("https://bucle.example.com/hook", {
      resolver,
      dispatcher: transporte,
    });

    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/redirecciones/i);
  });

  it("un nombre que resuelve a una IP privada se rechaza antes de conectar", async () => {
    const { transporte, llamadas } = transporteEspia(() => ({ status: 200 }));

    const r = await safeFetch("https://interno.example.com/hook", {
      resolver: async () => ["10.1.2.3"],
      dispatcher: transporte,
    });

    expect(r.ok).toBe(false);
    expect(llamadas).toHaveLength(0);
  });
});

/**
 * TRANSPORTE REAL contra un servidor HTTP de verdad.
 *
 * Aqui no hay mock del transporte: se comprueba que `conectarAIpFijada`
 * realmente conecta a la IP indicada, conserva la cabecera `Host` con el
 * NOMBRE (no con la IP, que romperia el enrutado por virtual host y, en TLS,
 * la validacion del certificado), acota el cuerpo y respeta el plazo durante
 * la lectura.
 */
describe("Transporte real: Host preservado, cuerpo acotado, plazo total", () => {
  let servidor: Server;
  let puerto = 0;
  const recibidas: Array<{ host: string | undefined; url: string | undefined }> = [];
  let responder: (req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void;

  beforeEach(async () => {
    recibidas.length = 0;
    responder = (_req, res) => {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("ok");
    };

    servidor = createServer((req, res) => {
      recibidas.push({ host: req.headers.host, url: req.url });
      responder(req, res);
    });
    await new Promise<void>((r) => servidor.listen(0, "127.0.0.1", r));
    puerto = (servidor.address() as AddressInfo).port;
  });

  afterAll(async () => {
    await new Promise<void>((r) => servidor?.close(() => r()));
  });

  it("conecta a la IP indicada y envia el NOMBRE en la cabecera Host", async () => {
    const respuesta = await conectarAIpFijada(
      `http://destino.example.com:${puerto}/hook?x=1`,
      "127.0.0.1",
      { method: "POST", headers: {}, body: "{}", timeoutMs: 5000 },
    );

    expect(respuesta.status).toBe(200);
    // La peticion llego a NUESTRO servidor (conexion a 127.0.0.1)...
    expect(recibidas).toHaveLength(1);
    // ...pero hablando con el como `destino.example.com`, no como la IP.
    expect(recibidas[0].host).toBe(`destino.example.com:${puerto}`);
    expect(recibidas[0].host).not.toContain("127.0.0.1");
    expect(recibidas[0].url).toBe("/hook?x=1");
  });

  it("no devuelve el cuerpo de la respuesta al llamador", async () => {
    responder = (_req, res) => {
      res.writeHead(200);
      res.end("SECRETO-INTERNO-QUE-NO-DEBE-SALIR");
    };

    const respuesta = await conectarAIpFijada(
      `http://destino.example.com:${puerto}/hook`,
      "127.0.0.1",
      { method: "GET", headers: {}, timeoutMs: 5000 },
    );

    expect(JSON.stringify(respuesta)).not.toContain("SECRETO-INTERNO");
  });

  it("corta un cuerpo mayor que el tope sin esperar a que termine", async () => {
    // Un servidor que envia mucho mas de lo permitido. Sin tope, la lectura
    // consumiria memoria del proceso a voluntad del destino.
    responder = (_req, res) => {
      res.writeHead(200);
      const trozo = Buffer.alloc(64 * 1024, 0x61);
      for (let i = 0; i < 40; i++) res.write(trozo);
      res.end();
    };

    const inicio = Date.now();
    const respuesta = await conectarAIpFijada(
      `http://destino.example.com:${puerto}/grande`,
      "127.0.0.1",
      { method: "GET", headers: {}, timeoutMs: 5000 },
    );

    expect(respuesta.status).toBe(200);
    expect(Date.now() - inicio).toBeLessThan(5000);
    expect(MAX_RESPONSE_BYTES).toBe(64 * 1024);
  });

  it("el plazo sigue corriendo mientras se lee el cuerpo, no solo hasta las cabeceras", async () => {
    // El servidor responde las cabeceras de inmediato y despues envia el
    // cuerpo a cuentagotas sin cerrar nunca. Con un AbortController que solo
    // cubre hasta que `fetch` resuelve, esta conexion quedaba abierta
    // indefinidamente.
    responder = (_req, res) => {
      res.writeHead(200);
      res.write("a");
      setInterval(() => {
        try {
          res.write("a");
        } catch {
          /* socket cerrado */
        }
      }, 50).unref();
    };

    const inicio = Date.now();
    await expect(
      conectarAIpFijada(`http://destino.example.com:${puerto}/lento`, "127.0.0.1", {
        method: "GET",
        headers: {},
        timeoutMs: 400,
      }),
    ).rejects.toThrow(/agotado/i);

    expect(Date.now() - inicio).toBeLessThan(3000);
  });

  it("sigue una redireccion devolviendo su Location", async () => {
    responder = (_req, res) => {
      res.writeHead(302, { location: "https://otro.example.com/final" });
      res.end();
    };

    const respuesta = await conectarAIpFijada(
      `http://destino.example.com:${puerto}/redir`,
      "127.0.0.1",
      { method: "GET", headers: {}, timeoutMs: 5000 },
    );

    expect(respuesta.status).toBe(302);
    expect(respuesta.location).toBe("https://otro.example.com/final");
  });
});
