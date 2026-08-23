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

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    case: { findFirst: vi.fn(), update: vi.fn() },
    document: { findMany: vi.fn(), create: vi.fn() },
    portalConsent: { findFirst: vi.fn(), create: vi.fn() },
    portalMessage: { findMany: vi.fn(), create: vi.fn() },
    task: { findFirst: vi.fn(), update: vi.fn() },
  },
}));
vi.mock("../src/lib/s3", () => ({
  uploadFile: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue("https://signed"),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));
vi.mock("../src/lib/audit", () => ({ logAudit: vi.fn().mockResolvedValue(undefined) }));
vi.mock("../src/lib/doc-task-matching", () => ({ matchDocumentToTag: vi.fn(() => null) }));
vi.mock("../src/lib/workflow-engine", () => ({ triggerWorkflow: vi.fn().mockResolvedValue(undefined) }));

import { prisma } from "../src/lib/prisma";
import { getPresignedUrl } from "../src/lib/s3";
import { PORTAL_CONSENT_VERSION } from "../src/lib/portal-consent";
import { GET as docsGET, POST as docsPOST } from "../src/app/api/portal/[token]/documents/route";
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
    const form = async () => {
      const fd = new FormData();
      fd.set("file", new File([new Uint8Array([0x25, 0x50, 0x44, 0x46])], "x.pdf", { type: "application/pdf" }));
      return fd;
    };
    const res = await docsPOST(req({}, form), { params: Promise.resolve({ token: "tok" }) });
    expect(res.status).toBe(403);
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
  function upload(file: File) {
    return docsPOST(
      req({}, async () => {
        const fd = new FormData();
        fd.set("file", file);
        return fd;
      }),
      { params: Promise.resolve({ token: "tok" }) },
    );
  }

  it("rechaza un MIME falsificado antes de subir a S3", async () => {
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const res = await upload(new File([png], "factura.pdf", { type: "application/pdf" }));

    expect(res.status).toBe(400);
    const { uploadFile } = await import("../src/lib/s3");
    expect(uploadFile).not.toHaveBeenCalled();
  });

  it("rechaza un ejecutable renombrado", async () => {
    const exe = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]);
    const res = await upload(new File([exe], "documento.pdf", { type: "application/pdf" }));
    expect(res.status).toBe(400);
  });
});
