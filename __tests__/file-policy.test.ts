/**
 * Politica de archivos: tamano, formatos permitidos y verificacion del
 * contenido real.
 *
 * UNIT TESTS. Antes no habia ninguna politica: ambos endpoints de subida
 * aceptaban cualquier File, de cualquier tamano, confiando en el
 * Content-Type que fija el cliente.
 */
import { describe, it, expect } from "vitest";
import {
  validateFile,
  sanitizeFileName,
  buildFileKey,
  downloadHeaders,
  MAX_FILE_BYTES,
  MAX_FILE_MB,
} from "../src/lib/file-policy";

const PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
const ZIP = Buffer.from([0x50, 0x4b, 0x03, 0x04]);
const EXE = Buffer.from([0x4d, 0x5a, 0x90, 0x00]);
const ELF = Buffer.from([0x7f, 0x45, 0x4c, 0x46]);

const ok = (over: Partial<Parameters<typeof validateFile>[0]> = {}) =>
  validateFile({ fileName: "doc.pdf", size: PDF.length, declaredMime: "application/pdf", head: PDF, ...over });

describe("Tamano maximo", () => {
  it("acepta un archivo dentro del limite", () => {
    expect(ok().ok).toBe(true);
  });

  it("rechaza un archivo por encima del maximo", () => {
    const r = ok({ size: MAX_FILE_BYTES + 1 });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("too_large");
    expect(r.message).toContain(String(MAX_FILE_MB));
  });

  it("rechaza un archivo vacio", () => {
    const r = validateFile({ fileName: "x.pdf", size: 0, head: Buffer.alloc(0) });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("empty");
  });

  it("el limite por defecto es 20 MB", () => {
    expect(MAX_FILE_MB).toBe(20);
  });
});

describe("Verificacion por contenido, no por Content-Type", () => {
  it("acepta un PDF real", () => {
    expect(ok().ok).toBe(true);
  });

  it("acepta PNG y JPEG reales", () => {
    expect(validateFile({ fileName: "f.png", size: 8, head: PNG }).ok).toBe(true);
    expect(validateFile({ fileName: "f.jpg", size: 4, head: JPEG }).ok).toBe(true);
  });

  it("rechaza un MIME falsificado: dice PDF pero el contenido es PNG", () => {
    // Este es el caso que `file.type` no detecta nunca, porque lo fija el cliente.
    const r = validateFile({
      fileName: "factura.pdf",
      size: PNG.length,
      declaredMime: "application/pdf",
      head: PNG,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("content_mismatch");
  });

  it("rechaza un ejecutable de Windows renombrado a .pdf", () => {
    const r = validateFile({
      fileName: "inofensivo.pdf",
      size: EXE.length,
      declaredMime: "application/pdf",
      head: EXE,
    });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("dangerous_content");
    expect(r.message).toContain("ejecutable");
  });

  it("rechaza un binario ELF renombrado a .png", () => {
    const r = validateFile({ fileName: "logo.png", size: ELF.length, head: ELF });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("dangerous_content");
  });

  it("rechaza un script con shebang renombrado", () => {
    const sh = Buffer.from("#!/bin/sh\nrm -rf /", "utf8");
    const r = validateFile({ fileName: "notas.txt", size: sh.length, head: sh });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("dangerous_content");
  });

  it("rechaza SVG", () => {
    const svg = Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>", "utf8");
    const r = validateFile({ fileName: "icono.svg", size: svg.length, head: svg });
    expect(r.ok).toBe(false);
  });

  it("rechaza HTML activo dentro de un .txt", () => {
    const html = Buffer.from("<script>alert(1)</script>", "utf8");
    const r = validateFile({ fileName: "nota.txt", size: html.length, head: html });
    expect(r.ok).toBe(false);
    expect(r.reason).toBe("dangerous_content");
  });

  it("acepta texto plano legitimo", () => {
    const txt = Buffer.from("Certificado numero 123\nFecha: 2026-01-01", "utf8");
    expect(validateFile({ fileName: "nota.txt", size: txt.length, head: txt }).ok).toBe(true);
  });

  it("acepta docx y xlsx (contenedores ZIP)", () => {
    expect(validateFile({ fileName: "escritura.docx", size: 4, head: ZIP }).ok).toBe(true);
    expect(validateFile({ fileName: "caudal.xlsx", size: 4, head: ZIP }).ok).toBe(true);
  });
});

describe("Extensiones no admitidas", () => {
  for (const name of ["virus.exe", "script.sh", "macro.docm", "archivo.zip", "pagina.html", "app.jar"]) {
    it(`rechaza ${name}`, () => {
      const r = validateFile({ fileName: name, size: 8, head: PDF });
      expect(r.ok).toBe(false);
    });
  }
});

describe("Sanitizado del nombre", () => {
  it("elimina el path traversal", () => {
    expect(sanitizeFileName("../../etc/passwd")).toBe("passwd");
    expect(sanitizeFileName("..\\..\\windows\\system32")).toBe("system32");
  });

  it("elimina saltos de linea (inyeccion de cabeceras)", () => {
    const s = sanitizeFileName("doc\r\nContent-Type: text/html.pdf");
    expect(s).not.toContain("\n");
    expect(s).not.toContain("\r");
  });

  it("acota la longitud", () => {
    expect(sanitizeFileName("a".repeat(500) + ".pdf").length).toBeLessThanOrEqual(180);
  });

  it("nunca devuelve cadena vacia", () => {
    expect(sanitizeFileName("")).toBe("documento");
    expect(sanitizeFileName("...")).toBeTruthy();
  });
});

describe("Clave de S3", () => {
  it("no contiene el nombre original", () => {
    const key = buildFileKey({ orgId: "org1", caseId: "case1", fileName: "dni-juan-perez.pdf" });
    expect(key).not.toContain("dni-juan-perez");
    expect(key).toMatch(/^org1\/case1\/interno\/[0-9a-f]{32}\.pdf$/);
  });

  it("es impredecible: dos llamadas iguales dan claves distintas", () => {
    const a = buildFileKey({ orgId: "o", caseId: "c", fileName: "x.pdf" });
    const b = buildFileKey({ orgId: "o", caseId: "c", fileName: "x.pdf" });
    expect(a).not.toBe(b);
  });

  it("separa el ambito portal del interno", () => {
    const portal = buildFileKey({ orgId: "o", caseId: "c", fileName: "x.pdf", fromPortal: true });
    expect(portal).toContain("/portal/");
  });
});

describe("Cabeceras de descarga", () => {
  it("fuerza descarga y desactiva el sniffing", () => {
    const h = downloadHeaders("certificado.pdf", "application/pdf");
    expect(h["Content-Disposition"]).toContain("attachment");
    expect(h["X-Content-Type-Options"]).toBe("nosniff");
    expect(h["Content-Security-Policy"]).toContain("sandbox");
  });

  it("no propaga un mimeType arbitrario", () => {
    const h = downloadHeaders("x.pdf", "text/html");
    expect(h["Content-Type"]).toBe("application/octet-stream");
  });

  it("el nombre no puede romper la cabecera", () => {
    const h = downloadHeaders('mal"nombre.pdf');
    expect(h["Content-Disposition"]).not.toMatch(/[^\\]";.*"/);
  });
});

/**
 * EL TECHO DEL CUERPO DE LA PETICION TIENE QUE DEJAR PASAR EL MAXIMO DE ARCHIVO.
 *
 * Next 15 trunca el cuerpo a 10 MB por defecto y no avisa con un error: el
 * multipart llega cortado y `req.formData()` lanza. Con eso, la promesa de
 * «maximo 20 MB» era falsa por encima de 10 MB, y un archivo de exactamente el
 * maximo se rechazaba con un 413 que no le correspondia.
 *
 * `next.config.js` sube ese techo, pero su aritmetica esta escrita aparte
 * porque es CommonJS y no puede importar este modulo de TypeScript. Esta prueba
 * es la costura: si alguien cambia MAX_UPLOAD_MB, el margen o el techo y los
 * dos dejan de estar de acuerdo, falla aqui en vez de fallar en produccion con
 * una subida perdida.
 */
describe("Techo del cuerpo de la peticion (next.config.js)", () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const nextConfig = require("../next.config.js") as {
    experimental?: { middlewareClientMaxBodySize?: number };
  };
  const techo = nextConfig.experimental?.middlewareClientMaxBodySize;

  it("esta configurado de forma explicita", () => {
    // Sin esto vuelve el defecto de 10 MB de Next y la politica deja de ser real.
    expect(typeof techo, "next.config.js debe fijar middlewareClientMaxBodySize").toBe("number");
  });

  it("deja sitio al archivo maximo MAS el armazon del multipart", () => {
    /*
     * Estrictamente mayor, no «mayor o igual»: un archivo de exactamente
     * MAX_FILE_BYTES viaja con separadores y cabeceras encima, asi que el
     * cuerpo pesa mas que el archivo. Si el techo fuera igual al maximo, el
     * archivo que la politica permite no cabria.
     */
    expect(techo!).toBeGreaterThan(MAX_FILE_BYTES);
  });

  it("sigue acotado: no se aceptan peticiones sin limite", () => {
    // El margen es para el sobre del multipart, no una puerta abierta.
    expect(techo!).toBeLessThanOrEqual(MAX_FILE_BYTES + 1024 * 1024);
  });
});
