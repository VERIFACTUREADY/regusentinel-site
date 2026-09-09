/**
 * Seguridad del portal familiar: visibilidad documental, consentimiento como
 * requisito y revocacion del token.
 *
 * HANDLER TESTS con Prisma mockeado. Fallan con la implementacion anterior,
 * en la que el portal devolvia TODOS los documentos del expediente (incluidos
 * los internos, con URL de descarga prefirmada) y ningun endpoint exigia
 * consentimiento.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma", () => {
  const prisma: any = {
    case: { findFirst: vi.fn(), update: vi.fn() },
    document: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    portalConsent: { findFirst: vi.fn(), create: vi.fn() },
    portalMessage: { findMany: vi.fn(), create: vi.fn() },
    task: { findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    pendingUpload: {
      create: vi.fn(),
      findUnique: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  };
  prisma.$transaction = vi.fn(async (fn: any) => fn(prisma));
  return { prisma };
});
vi.mock("../src/lib/s3", () => ({
  uploadFile: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue("https://signed"),
  getPresignedUploadUrl: vi.fn().mockResolvedValue("https://signed-put"),
  headObject: vi.fn(),
  downloadHead: vi.fn(),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../src/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../src/lib/doc-task-matching", () => ({ matchDocumentToTag: vi.fn(() => null) }));
vi.mock("../src/lib/workflow-engine", () => ({ triggerWorkflow: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from "../src/lib/prisma";
import { getPresignedUrl } from "../src/lib/s3";
import { PORTAL_CONSENT_VERSION } from "../src/lib/portal-consent";
import { GET as docsGET } from "../src/app/api/portal/[token]/documents/route";
import { POST as autorizarPOST } from "../src/app/api/portal/[token]/documents/upload-url/route";
import { POST as confirmarPOST } from "../src/app/api/portal/[token]/documents/complete/route";
import { GET as messagesGET, POST as messagesPOST } from "../src/app/api/portal/[token]/messages/route";

const caseFindFirst = prisma.case.findFirst as unknown as ReturnType<typeof vi.fn>;
const docFindMany = prisma.document.findMany as unknown as ReturnType<typeof vi.fn>;
const consentFindFirst = prisma.portalConsent.findFirst as unknown as ReturnType<typeof vi.fn>;
const presigned = getPresignedUrl as unknown as ReturnType<typeof vi.fn>;

let ip = 0;
function req(body: unknown = {}, form?: () => Promise<FormData>): any {
  ip++;
  return {
    headers: { get: (k: string) => (k === "x-forwarded-for" ? `10.9.${ip % 250}.${(ip * 7) % 250}` : null) },
    nextUrl: new URL("http://localhost/api/portal/tok"),
    json: async () => body,
    formData: form,
  };
}

function portalCase(over: Record<string, unknown> = {}) {
  return {
    id: "case-1",
    orgId: "org-1",
    ref: "EXP-2026-0001",
    portalEnabled: true,
    portalTokenRevokedAt: null,
    portalTokenExpiresAt: null,
    ...over,
  };
}

function withConsent() {
  consentFindFirst.mockResolvedValue({
    version: PORTAL_CONSENT_VERSION,
    textHash: "h",
    acceptedAt: new Date("2026-01-01"),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  caseFindFirst.mockResolvedValue(portalCase());
  docFindMany.mockResolvedValue([]);
  presigned.mockResolvedValue("https://signed");
  withConsent();
});

describe("Visibilidad documental", () => {
  it("el portal solo consulta documentos marcados visibles para la familia", async () => {
    await docsGET(req(), { params: Promise.resolve({ token: "tok" }) });

    expect(docFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ caseId: "case-1", visibleToFamily: true }),
      }),
    );
  });

  it("no genera URL de descarga para documentos internos", async () => {
    // La consulta ya los excluye; si alguien relajara el filtro, este test
    // seguiria fallando porque el where deja de contener visibleToFamily.
    const where = () => (docFindMany.mock.calls[0][0] as any).where;
    await docsGET(req(), { params: Promise.resolve({ token: "tok" }) });
    expect(where().visibleToFamily).toBe(true);
  });

  it("excluye los documentos con borrado pendiente en S3", async () => {
    await docsGET(req(), { params: Promise.resolve({ token: "tok" }) });
    expect((docFindMany.mock.calls[0][0] as any).where.deletionState).toBeNull();
  });
});

describe("Consentimiento como requisito", () => {
  beforeEach(() => {
    consentFindFirst.mockResolvedValue(null); // nunca acepto
  });

  it("sin consentimiento no se listan documentos", async () => {
    const res = await docsGET(req(), { params: Promise.resolve({ token: "tok" }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.consentRequired).toBe(true);
    expect(docFindMany).not.toHaveBeenCalled();
  });

  it("sin consentimiento no se pueden subir documentos", async () => {
    /*
     * Con la subida directa, "no poder subir" significa NO RECIBIR EL PERMISO:
     * sin URL prefirmada el navegador no tiene a donde escribir. Por eso la
     * barrera se comprueba en la autorizacion, que es donde se entrega.
     */
    const res = await autorizarPOST(req({ fileName: "x.pdf", size: 1024 }), {
      params: Promise.resolve({ token: "tok" }),
    });
    expect(res.status).toBe(403);
    const { getPresignedUploadUrl } = await import("../src/lib/s3");
    expect(getPresignedUploadUrl).not.toHaveBeenCalled();
    expect(prisma.document.create).not.toHaveBeenCalled();
  });

  it("sin consentimiento no se leen mensajes", async () => {
    const res = await messagesGET(req(), { params: Promise.resolve({ token: "tok" }) });
    expect(res.status).toBe(403);
    expect(prisma.portalMessage.findMany).not.toHaveBeenCalled();
  });

  it("sin consentimiento no se envian mensajes", async () => {
    const res = await messagesPOST(req({ content: "Hola" }), { params: Promise.resolve({ token: "tok" }) });
    expect(res.status).toBe(403);
    expect(prisma.portalMessage.create).not.toHaveBeenCalled();
  });

  it("una version antigua del texto obliga a aceptar de nuevo", async () => {
    consentFindFirst.mockResolvedValue({
      version: "2020-v0",
      textHash: "viejo",
      acceptedAt: new Date("2020-01-01"),
    });
    const res = await docsGET(req(), { params: Promise.resolve({ token: "tok" }) });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toMatch(/condiciones han cambiado/i);
  });

  it("una aceptacion heredada de la migracion sigue dando acceso", async () => {
    // No cortamos el portal a familias que ya habian consentido.
    consentFindFirst.mockResolvedValue({
      version: "legacy-pre-2026-08",
      textHash: "x",
      acceptedAt: new Date("2026-01-01"),
    });
    const res = await docsGET(req(), { params: Promise.resolve({ token: "tok" }) });
    expect(res.status).toBe(200);
  });
});

describe("Revocacion y caducidad del token", () => {
  it("un token revocado deja de funcionar de inmediato", async () => {
    caseFindFirst.mockResolvedValue(portalCase({ portalTokenRevokedAt: new Date("2026-02-01") }));

    const res = await docsGET(req(), { params: Promise.resolve({ token: "tok" }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/revocado/i);
    expect(docFindMany).not.toHaveBeenCalled();
  });

  it("un token caducado deja de funcionar", async () => {
    caseFindFirst.mockResolvedValue(
      portalCase({ portalTokenExpiresAt: new Date(Date.now() - 86_400_000) }),
    );

    const res = await docsGET(req(), { params: Promise.resolve({ token: "tok" }) });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toMatch(/caducado/i);
  });

  it("una caducidad futura no bloquea", async () => {
    caseFindFirst.mockResolvedValue(
      portalCase({ portalTokenExpiresAt: new Date(Date.now() + 86_400_000) }),
    );
    const res = await docsGET(req(), { params: Promise.resolve({ token: "tok" }) });
    expect(res.status).toBe(200);
  });

  it("un token inexistente da 404 sin revelar si el expediente existe", async () => {
    caseFindFirst.mockResolvedValue(null);
    const res = await docsGET(req(), { params: Promise.resolve({ token: "inventado" }) });
    expect(res.status).toBe(404);
  });
});

describe("Politica de archivos aplicada en el portal", () => {
  /*
   * DONDE SE APLICA AHORA, Y POR QUE CAMBIA
   * ---------------------------------------
   * Con el multipart, el contenido falsificado se rechazaba ANTES de tocar S3
   * porque los bytes pasaban por la funcion. Ya no pasan: el navegador escribe
   * directo en el almacenamiento (una funcion de Vercel admite 4,5 MB y el
   * maximo son 20 MiB). Asi que el objeto YA EXISTE cuando se le miran los
   * bytes, y rechazarlo implica BORRARLO.
   *
   * La exigencia no baja: sigue sin crearse documento, y ademas se comprueba
   * que el objeto no se queda en el bucket. Lo que se puede decidir sin bytes
   * —la extension— se sigue cortando antes de firmar nada.
   */
  const PENDIENTE = {
    id: "pu_1",
    orgId: "org-1",
    caseId: "case-1",
    fileKey: "org-1/case-1/portal/" + "b".repeat(32) + ".pdf",
    fileName: "factura.pdf",
    expectedSize: 8,
    uploadedBy: null,
    isPortalUpload: true,
    taskId: null,
    status: "PENDING",
    documentId: null,
    failureReason: null,
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date(),
  };

  async function confirmarCon(bytes: Uint8Array) {
    const { headObject, downloadHead } = await import("../src/lib/s3");
    (prisma as any).pendingUpload.findUnique.mockResolvedValue(PENDIENTE);
    (prisma as any).pendingUpload.update.mockResolvedValue({});
    (headObject as any).mockResolvedValue({ contentLength: bytes.length });
    (downloadHead as any).mockResolvedValue(Buffer.from(bytes));
    return confirmarPOST(req({ uploadId: "pu_1" }), {
      params: Promise.resolve({ token: "tok" }),
    });
  }

  it("rechaza un MIME falsificado y BORRA el objeto del bucket", async () => {
    // PNG dentro de un .pdf. El cliente ya no declara tipo: deciden los bytes.
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = await confirmarCon(png);

    expect(res.status).toBe(400);
    expect(prisma.document.create).not.toHaveBeenCalled();
    const { deleteFile } = await import("../src/lib/s3");
    expect(deleteFile).toHaveBeenCalledWith(PENDIENTE.fileKey);
  });

  it("rechaza un ejecutable renombrado y BORRA el objeto del bucket", async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
    const res = await confirmarCon(exe);

    expect(res.status).toBe(400);
    expect(prisma.document.create).not.toHaveBeenCalled();
    const { deleteFile } = await import("../src/lib/s3");
    expect(deleteFile).toHaveBeenCalledWith(PENDIENTE.fileKey);
  });

  it("una extension no admitida no llega ni a recibir permiso de escritura", async () => {
    const res = await autorizarPOST(req({ fileName: "programa.exe", size: 16 }), {
      params: Promise.resolve({ token: "tok" }),
    });

    expect(res.status).toBe(400);
    const { getPresignedUploadUrl } = await import("../src/lib/s3");
    expect(getPresignedUploadUrl).not.toHaveBeenCalled();
  });
});
