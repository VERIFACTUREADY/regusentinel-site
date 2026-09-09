import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma", () => {
  /*
   * `$transaction` ejecuta el callback contra ESTE mismo doble, para que las
   * aserciones sobre `document.create` sigan valiendo tanto si la escritura
   * ocurre dentro de la transaccion como fuera.
   */
  const prisma: any = {
    case: { findFirst: vi.fn(), update: vi.fn() },
    portalMessage: { findMany: vi.fn(), create: vi.fn() },
    document: { findMany: vi.fn(), create: vi.fn(), findUnique: vi.fn() },
    // El portal exige consentimiento vigente para toda accion.
    portalConsent: { findFirst: vi.fn(), create: vi.fn() },
    task: { findFirst: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    // Estado del hueco entre autorizar y confirmar la subida directa.
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
  getPresignedUrl: vi.fn().mockResolvedValue("https://signed-url"),
  getPresignedUploadUrl: vi.fn().mockResolvedValue("https://signed-put-url"),
  headObject: vi.fn(),
  downloadHead: vi.fn(),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/doc-task-matching", () => ({
  matchDocumentToTag: vi.fn(),
}));

vi.mock("../src/lib/workflow-engine", () => ({
  triggerWorkflow: vi.fn().mockResolvedValue(undefined),
  // La ruta identifica el evento con el id del documento recien creado. Sin
  // esto en el doble, la subida del portal reventaba con un 500.
  claveDeEvento: { documentoSubido: (id: string) => `document:${id}` },
}));

vi.mock("../src/lib/deadline-engine", () => ({
  getCaseDeadlines: vi.fn(() => ({ modelo650: new Date(), siguientes: [] })),
}));

import { prisma } from "../src/lib/prisma";
import {
  uploadFile,
  getPresignedUrl,
  getPresignedUploadUrl,
  headObject,
  downloadHead,
  deleteFile,
} from "../src/lib/s3";
import { logAudit } from "../src/lib/audit";
import { matchDocumentToTag } from "../src/lib/doc-task-matching";
import { triggerWorkflow } from "../src/lib/workflow-engine";
import { PORTAL_CONSENT_VERSION } from "../src/lib/portal-consent";

import { GET as portalGET } from "../src/app/api/portal/[token]/route";
import { GET as messagesGET, POST as messagesPOST } from "../src/app/api/portal/[token]/messages/route";
import { POST as consentPOST } from "../src/app/api/portal/[token]/consent/route";
import { GET as docsGET } from "../src/app/api/portal/[token]/documents/route";
import { POST as autorizarPOST } from "../src/app/api/portal/[token]/documents/upload-url/route";
import { POST as confirmarPOST } from "../src/app/api/portal/[token]/documents/complete/route";

const caseFindFirst = prisma.case.findFirst as unknown as ReturnType<typeof vi.fn>;
const caseUpdate = prisma.case.update as unknown as ReturnType<typeof vi.fn>;
const msgFindMany = prisma.portalMessage.findMany as unknown as ReturnType<typeof vi.fn>;
const msgCreate = prisma.portalMessage.create as unknown as ReturnType<typeof vi.fn>;
const docFindMany = prisma.document.findMany as unknown as ReturnType<typeof vi.fn>;
const docCreate = prisma.document.create as unknown as ReturnType<typeof vi.fn>;
const taskFindFirst = prisma.task.findFirst as unknown as ReturnType<typeof vi.fn>;
const taskFindUnique = prisma.task.findUnique as unknown as ReturnType<typeof vi.fn>;
const taskUpdate = prisma.task.update as unknown as ReturnType<typeof vi.fn>;
const uploadMock = uploadFile as unknown as ReturnType<typeof vi.fn>;
const presignedMock = getPresignedUrl as unknown as ReturnType<typeof vi.fn>;
const auditMock = logAudit as unknown as ReturnType<typeof vi.fn>;
const matchMock = matchDocumentToTag as unknown as ReturnType<typeof vi.fn>;
const workflowMock = triggerWorkflow as unknown as ReturnType<typeof vi.fn>;
const consentFindFirst = prisma.portalConsent.findFirst as unknown as ReturnType<typeof vi.fn>;
const consentCreate = prisma.portalConsent.create as unknown as ReturnType<typeof vi.fn>;

// Piezas de la subida en dos pasos.
const docFindUnique = prisma.document.findUnique as unknown as ReturnType<typeof vi.fn>;
const taskFindMany = prisma.task.findMany as unknown as ReturnType<typeof vi.fn>;
const pendingCreate = (prisma as any).pendingUpload.create as ReturnType<typeof vi.fn>;
const pendingFindUnique = (prisma as any).pendingUpload.findUnique as ReturnType<typeof vi.fn>;
const pendingFindMany = (prisma as any).pendingUpload.findMany as ReturnType<typeof vi.fn>;
const pendingUpdateMany = (prisma as any).pendingUpload.updateMany as ReturnType<typeof vi.fn>;
const pendingUpdate = (prisma as any).pendingUpload.update as ReturnType<typeof vi.fn>;
const firmaSubidaMock = getPresignedUploadUrl as unknown as ReturnType<typeof vi.fn>;
const headMock = headObject as unknown as ReturnType<typeof vi.fn>;
const headBytesMock = downloadHead as unknown as ReturnType<typeof vi.fn>;
const borrarMock = deleteFile as unknown as ReturnType<typeof vi.fn>;

/** Consentimiento vigente: lo exigen subida, descarga y mensajes. */
function grantConsent() {
  consentFindFirst.mockResolvedValue({
    version: PORTAL_CONSENT_VERSION,
    textHash: "hash",
    acceptedAt: new Date("2026-02-01"),
  });
}

/** Sin aceptacion registrada. */
function denyConsent() {
  consentFindFirst.mockResolvedValue(null);
}

/** Cabecera PDF valida: la politica de archivos verifica los magic bytes. */
function pdfBytes(extra = "contenido"): ArrayBuffer {
  const header = [0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a];
  const body = Array.from(Buffer.from(extra, "utf8"));
  return new Uint8Array([...header, ...body]).buffer;
}

// Cada test usa una IP distinta para evitar contaminacion del rate-limit
// in-memory entre tests (los buckets son globales en el modulo).
let ipCounter = 0;
function fakeReq(opts: { body?: any; form?: () => Promise<FormData> } = {}): any {
  ipCounter++;
  const url = new URL("http://localhost/api/portal/tok123");
  return {
    headers: { get: (k: string) => k === "x-forwarded-for" ? `10.0.${ipCounter}.${ipCounter}` : null },
    nextUrl: url,
    json: async () => opts.body ?? {},
    formData: opts.form,
  };
}

function fakeCase(overrides: any = {}) {
  return {
    id: "case_abc",
    orgId: "org1",
    ref: "EXP-2026-001",
    portalToken: "tok123",
    status: "OPEN",
    consentAccepted: false,
    deceased: { fullName: "Juan Lopez", deathDate: new Date("2026-01-15") },
    tasks: [],
    documents: [],
    org: {
      name: "Despacho Demo",
      brandDisplayName: null,
      brandLogoUrl: null,
      brandPrimaryColor: null,
      brandSupportEmail: null,
      brandFooterText: null,
      subscription: { plan: "INICIA" },
    },
    ...overrides,
  };
}

function resetAll() {
  for (const m of [caseFindFirst, caseUpdate, msgFindMany, msgCreate, docFindMany, docCreate, docFindUnique, taskFindFirst, taskFindUnique, taskFindMany, taskUpdate, uploadMock, presignedMock, auditMock, matchMock, workflowMock, consentFindFirst, consentCreate, pendingCreate, pendingFindUnique, pendingFindMany, pendingUpdateMany, pendingUpdate, firmaSubidaMock, headMock, headBytesMock, borrarMock]) {
    m.mockReset();
  }
  uploadMock.mockResolvedValue(undefined);
  presignedMock.mockResolvedValue("https://signed-url");
  firmaSubidaMock.mockResolvedValue("https://signed-put-url");
  borrarMock.mockResolvedValue(undefined);
  // El barrido oportunista de caducadas no debe estorbar a ninguna prueba.
  pendingFindMany.mockResolvedValue([]);
  pendingCreate.mockImplementation(async ({ data }: any) => ({ id: "pu_1", ...data }));
  // `update` devuelve promesa en Prisma real; sin este valor por defecto el
  // doble devuelve `undefined` y el `.catch()` del descarte revienta.
  pendingUpdate.mockResolvedValue({});
  taskFindMany.mockResolvedValue([]);
  auditMock.mockResolvedValue(undefined);
  workflowMock.mockResolvedValue(undefined);
  // Por defecto hay consentimiento: cada bloque que pruebe su ausencia lo
  // anula explicitamente con denyConsent().
  grantConsent();
  consentCreate.mockImplementation(async ({ data }: any) => ({
    id: "consent-1", ...data, acceptedAt: new Date("2026-02-01"),
  }));
  docFindMany.mockResolvedValue([]);
}

// ─── GET /api/portal/[token] ───────────────────────────────

describe("GET /api/portal/[token] — vista principal del expediente", () => {
  beforeEach(resetAll);

  it("404 si el token no corresponde a ningun expediente", async () => {
    caseFindFirst.mockResolvedValueOnce(null);
    const res = await portalGET(fakeReq(), { params: Promise.resolve({ token: "invalid" }) });
    expect(res.status).toBe(404);
  });

  it("filtra por portalEnabled=true y deletedAt=null (no expone disabled ni borrados)", async () => {
    caseFindFirst.mockResolvedValue(fakeCase());
    await portalGET(fakeReq(), { params: Promise.resolve({ token: "tok123" }) });

    const where = caseFindFirst.mock.calls[0][0].where;
    expect(where.portalEnabled).toBe(true);
    expect(where.deletedAt).toBe(null);
    expect(where.portalToken).toBe("tok123");
  });

  it("plan INICIA muestra 'Powered by Heredia' (showPoweredBy=true)", async () => {
    caseFindFirst.mockResolvedValue(fakeCase({ org: { ...fakeCase().org, subscription: { plan: "INICIA" } } }));
    const res = await portalGET(fakeReq(), { params: Promise.resolve({ token: "tok123" }) });
    const body = await res.json();
    expect(body.branding.showPoweredBy).toBe(true);
  });

  it("plan DESPACHO oculta 'Powered by Heredia' (white-label)", async () => {
    caseFindFirst.mockResolvedValue(fakeCase({ org: { ...fakeCase().org, subscription: { plan: "DESPACHO" } } }));
    const res = await portalGET(fakeReq(), { params: Promise.resolve({ token: "tok123" }) });
    const body = await res.json();
    expect(body.branding.showPoweredBy).toBe(false);
  });

  it("plan FIRMA tambien oculta 'Powered by Heredia'", async () => {
    caseFindFirst.mockResolvedValue(fakeCase({ org: { ...fakeCase().org, subscription: { plan: "FIRMA" } } }));
    const res = await portalGET(fakeReq(), { params: Promise.resolve({ token: "tok123" }) });
    const body = await res.json();
    expect(body.branding.showPoweredBy).toBe(false);
  });

  it("detecta pendingDocs: tareas con docTag, no DONE, sin documento vinculado", async () => {
    caseFindFirst.mockResolvedValue(fakeCase({
      tasks: [
        { id: "t1", title: "Subir DNI heredero", status: "PENDING", category: "DOCS", docTag: "DNI", deadline: null, blockedUntil: null, sortOrder: 1 },
        { id: "t2", title: "Tarea sin tag", status: "PENDING", category: "DOCS", docTag: null, deadline: null, blockedUntil: null, sortOrder: 2 },
        { id: "t3", title: "Subir certificado defuncion", status: "DONE", category: "DOCS", docTag: "CERT_DEFUNCION", deadline: null, blockedUntil: null, sortOrder: 3 },
      ],
      documents: [],
    }));

    const res = await portalGET(fakeReq(), { params: Promise.resolve({ token: "tok123" }) });
    const body = await res.json();

    expect(body.pendingDocs).toHaveLength(1);
    expect(body.pendingDocs[0].title).toBe("Subir DNI heredero");
  });

  it("no incluye en pendingDocs tareas DONE aunque tengan docTag", async () => {
    caseFindFirst.mockResolvedValue(fakeCase({
      tasks: [
        { id: "t1", title: "X", status: "DONE", category: "DOCS", docTag: "DNI", deadline: null, blockedUntil: null, sortOrder: 1 },
        { id: "t2", title: "Y", status: "SKIPPED", category: "DOCS", docTag: "TASA", deadline: null, blockedUntil: null, sortOrder: 2 },
      ],
      documents: [],
    }));

    const res = await portalGET(fakeReq(), { params: Promise.resolve({ token: "tok123" }) });
    const body = await res.json();
    expect(body.pendingDocs).toHaveLength(0);
  });
});

// ─── POST /api/portal/[token]/consent ──────────────────────

describe("POST /api/portal/[token]/consent — aceptacion RGPD del heredero", () => {
  beforeEach(resetAll);

  it("404 si el expediente no existe", async () => {
    caseFindFirst.mockResolvedValueOnce(null);
    const res = await consentPOST(fakeReq({ body: { authorName: "Andrea" } }), { params: Promise.resolve({ token: "x" }) });
    expect(res.status).toBe(404);
    expect(caseUpdate).not.toHaveBeenCalled();
  });

  it("registra evidencia con version, hash, IP y user-agent", async () => {
    caseFindFirst.mockResolvedValue({ id: "case_abc", orgId: "org1", ref: "EXP", portalEnabled: true });
    denyConsent(); // aun no ha aceptado
    caseUpdate.mockResolvedValueOnce({});

    const res = await consentPOST(fakeReq({ body: { authorName: "Andrea Martin" } }), { params: Promise.resolve({ token: "tok123" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);

    // La evidencia va a PortalConsent, no a un booleano sobrescribible.
    expect(consentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: "case_abc",
        version: PORTAL_CONSENT_VERSION,
        textHash: expect.any(String),
        purpose: "PORTAL_FAMILIA",
        declaredName: "Andrea Martin",
        ip: expect.any(String),
      }),
    });
  });

  it("no duplica la evidencia si ya hay una aceptacion vigente", async () => {
    caseFindFirst.mockResolvedValue({ id: "case_abc", orgId: "org1", ref: "EXP", portalEnabled: true });
    grantConsent();

    const res = await consentPOST(fakeReq({ body: { authorName: "Andrea" } }), { params: Promise.resolve({ token: "tok123" }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.alreadyAccepted).toBe(true);
    expect(consentCreate).not.toHaveBeenCalled();
  });

  it("ignora authorName vacio o solo espacios", async () => {
    caseFindFirst.mockResolvedValue({ id: "case_abc", orgId: "org1", ref: "EXP", portalEnabled: true });
    denyConsent();
    caseUpdate.mockResolvedValueOnce({});

    await consentPOST(fakeReq({ body: { authorName: "   " } }), { params: Promise.resolve({ token: "tok123" }) });

    expect(consentCreate.mock.calls[0][0].data.declaredName).toBeNull();
  });
});

// ─── GET/POST /api/portal/[token]/messages ─────────────────

describe("GET /api/portal/[token]/messages — historial de mensajes", () => {
  beforeEach(resetAll);

  it("404 si el expediente no existe", async () => {
    caseFindFirst.mockResolvedValueOnce(null);
    const res = await messagesGET(fakeReq(), { params: Promise.resolve({ token: "x" }) });
    expect(res.status).toBe(404);
  });

  it("devuelve mensajes ordenados ascendentemente (cronologico)", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc" });
    msgFindMany.mockResolvedValueOnce([
      { id: "m1", fromFamily: true, authorName: "Andrea", content: "Hola", createdAt: new Date("2026-01-10") },
      { id: "m2", fromFamily: false, authorName: "Gestor", content: "Recibido", createdAt: new Date("2026-01-11") },
    ]);

    const res = await messagesGET(fakeReq(), { params: Promise.resolve({ token: "tok123" }) });
    const body = await res.json();

    expect(body).toHaveLength(2);
    expect(msgFindMany.mock.calls[0][0].orderBy).toEqual({ createdAt: "asc" });
  });
});

describe("POST /api/portal/[token]/messages — enviar mensaje familiar", () => {
  beforeEach(resetAll);

  it("404 si el expediente no existe", async () => {
    caseFindFirst.mockResolvedValueOnce(null);
    const res = await messagesPOST(fakeReq({ body: { content: "Hola" } }), { params: Promise.resolve({ token: "x" }) });
    expect(res.status).toBe(404);
    expect(msgCreate).not.toHaveBeenCalled();
  });

  it("400 si el mensaje esta vacio", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc" });
    const res = await messagesPOST(fakeReq({ body: { content: "" } }), { params: Promise.resolve({ token: "tok123" }) });
    expect(res.status).toBe(400);
  });

  it("400 si el mensaje supera 2000 caracteres", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc" });
    const longMsg = "x".repeat(2001);
    const res = await messagesPOST(fakeReq({ body: { content: longMsg } }), { params: Promise.resolve({ token: "tok123" }) });
    expect(res.status).toBe(400);
    expect(msgCreate).not.toHaveBeenCalled();
  });

  it("crea mensaje con fromFamily=true (siempre, viene del portal)", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc" });
    msgCreate.mockResolvedValueOnce({ id: "m1", fromFamily: true, authorName: "Andrea", content: "Hola gestor", createdAt: new Date() });

    const res = await messagesPOST(fakeReq({ body: { content: "Hola gestor", authorName: "Andrea" } }), { params: Promise.resolve({ token: "tok123" }) });

    expect(res.status).toBe(201);
    expect(msgCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: "case_abc",
        fromFamily: true,
        authorName: "Andrea",
        content: "Hola gestor",
      }),
      select: expect.any(Object),
    });
  });
});

// ─── GET/POST /api/portal/[token]/documents ────────────────

describe("GET /api/portal/[token]/documents — listar documentos", () => {
  beforeEach(resetAll);

  it("404 si el expediente no existe", async () => {
    caseFindFirst.mockResolvedValueOnce(null);
    const res = await docsGET(fakeReq(), { params: Promise.resolve({ token: "x" }) });
    expect(res.status).toBe(404);
  });

  it("devuelve documentos con presigned URL de S3", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc" });
    docFindMany.mockResolvedValueOnce([
      { id: "d1", fileName: "DNI.pdf", fileKey: "org1/case_abc/portal/dni.pdf", createdAt: new Date(), isPortalUpload: true, task: { id: "t1", title: "Subir DNI", category: "DOCS" } },
    ]);

    const res = await docsGET(fakeReq(), { params: Promise.resolve({ token: "tok123" }) });
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].downloadUrl).toBe("https://signed-url");
    expect(body[0].linkedTask.title).toBe("Subir DNI");
    // La URL se firma ademas con el nombre y el tipo, para que el navegador
    // DESCARGUE el archivo en vez de abrirlo dentro de la pagina.
    expect(presignedMock).toHaveBeenCalledWith("org1/case_abc/portal/dni.pdf", {
      fileName: "DNI.pdf",
      mimeType: undefined,
    });
  });
});

describe("Subida del portal en dos pasos (autorizar y confirmar)", () => {
  beforeEach(resetAll);

  /*
   * POR QUE DOS PASOS
   * -----------------
   * El archivo ya no atraviesa la funcion: una funcion de Vercel admite 4,5 MB
   * de cuerpo y el maximo del producto son 20 MiB. El navegador escribe directo
   * en el almacenamiento con una URL prefirmada, asi que estas pruebas cubren
   * AUTORIZAR (permisos, tenencia, politica de nombre y tamano) y CONFIRMAR
   * (objeto real, contenido real, creacion de la fila).
   *
   * Lo que se exige aqui es lo mismo que se exigia al multipart; lo unico que
   * cambia es donde ocurre.
   */

  const CABECERA_PDF = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a]);
  const TAMANO = 1024;

  function pendiente(overrides: any = {}) {
    return {
      id: "pu_1",
      orgId: "org1",
      caseId: "case_abc",
      fileKey: "org1/case_abc/portal/" + "a".repeat(32) + ".pdf",
      fileName: "dni.pdf",
      expectedSize: TAMANO,
      uploadedBy: null,
      isPortalUpload: true,
      taskId: null,
      status: "PENDING",
      documentId: null,
      failureReason: null,
      expiresAt: new Date(Date.now() + 60_000),
      createdAt: new Date(),
      ...overrides,
    };
  }

  /** Deja lista una confirmacion que llega hasta la creacion del documento. */
  function prepararConfirmacion(overrides: any = {}) {
    caseFindFirst.mockResolvedValue({ id: "case_abc", orgId: "org1" });
    pendingFindUnique.mockResolvedValue(pendiente(overrides));
    headMock.mockResolvedValue({ contentLength: TAMANO });
    headBytesMock.mockResolvedValue(CABECERA_PDF);
    pendingUpdateMany.mockResolvedValue({ count: 1 });
    pendingUpdate.mockResolvedValue({});
    taskFindMany.mockResolvedValue([]);
  }

  function autorizar(body: any) {
    return autorizarPOST(fakeReq({ body }), { params: Promise.resolve({ token: "tok123" }) });
  }

  function confirmar(uploadId = "pu_1") {
    return confirmarPOST(fakeReq({ body: { uploadId } }), {
      params: Promise.resolve({ token: "tok123" }),
    });
  }

  it("404 si el expediente no existe: no se firma ninguna URL de escritura", async () => {
    caseFindFirst.mockResolvedValueOnce(null);
    const res = await autorizar({ fileName: "dni.pdf", size: TAMANO });
    expect(res.status).toBe(404);
    expect(firmaSubidaMock).not.toHaveBeenCalled();
    expect(pendingCreate).not.toHaveBeenCalled();
  });

  it("400 si no se dice que archivo es", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc", orgId: "org1" });
    const res = await autorizar({});
    expect(res.status).toBe(400);
    expect(firmaSubidaMock).not.toHaveBeenCalled();
  });

  it("la clave la genera el servidor y no lleva el nombre del usuario", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc", orgId: "org1" });
    pendingCreate.mockImplementation(async ({ data }: any) => ({ id: "pu_1", ...data }));

    const res = await autorizar({ fileName: "dni.pdf", size: TAMANO });
    expect(res.status).toBe(201);

    const clave = pendingCreate.mock.calls[0][0].data.fileKey;
    // Aleatoria y dentro del ambito: ni adivinable ni con el nombre dentro.
    expect(clave).toMatch(/^org1\/case_abc\/portal\/[0-9a-f]{32}\.pdf$/);
    expect(clave).not.toContain("dni.pdf");
    expect(firmaSubidaMock).toHaveBeenCalledWith(clave, expect.anything());
  });

  it("un formato no admitido no llega a recibir permiso de escritura", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc", orgId: "org1" });
    const res = await autorizar({ fileName: "programa.exe", size: TAMANO });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/Formato no admitido/);
    expect(firmaSubidaMock).not.toHaveBeenCalled();
  });

  it("un tamano por encima del maximo se rechaza con 413 antes de firmar", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc", orgId: "org1" });
    const res = await autorizar({ fileName: "dni.pdf", size: 21 * 1024 * 1024 });
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("El archivo supera el máximo de 20 MB.");
    expect(firmaSubidaMock).not.toHaveBeenCalled();
  });

  it("happy path: verifica el objeto, crea Document, vincula tarea y audita", async () => {
    prepararConfirmacion();
    matchMock.mockReturnValueOnce("DNI");
    // 1a: la busqueda por docTag. 2a: la relectura de findTaskInCase.
    taskFindFirst.mockResolvedValueOnce({ id: "t1", title: "Subir DNI heredero" });
    docCreate.mockResolvedValueOnce({ id: "doc_new", fileName: "dni.pdf" });
    taskFindFirst.mockResolvedValueOnce({ id: "t1", title: "Subir DNI heredero", status: "PENDING" });
    taskUpdate.mockResolvedValueOnce({});

    const res = await confirmar();
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("doc_new");

    // El tamano se comprueba contra el objeto REAL, no contra lo declarado.
    expect(headMock).toHaveBeenCalledOnce();

    expect(docCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: "case_abc",
        taskId: "t1",
        fileName: "dni.pdf",
        isPortalUpload: true,
        visibleToFamily: true,
        fileSize: TAMANO,
      }),
    });

    expect(taskUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { status: "READY" },
    });

    // Dos audits: la tarea auto-actualizada y la subida.
    expect(auditMock).toHaveBeenCalledTimes(2);
    /*
     * El evento lleva la identidad DEL DOCUMENTO. Sin ella la clave del motor
     * era `(org, regla, expediente, tipo, ventana de 5 min)`, asi que dos
     * documentos seguidos del mismo expediente contaban como un solo hecho.
     */
    expect(workflowMock).toHaveBeenCalledWith({
      type: "DOCUMENT_UPLOADED",
      orgId: "org1",
      caseId: "case_abc",
      userId: undefined,
      eventKey: "document:doc_new",
    });
  });

  it("documento sin match de tarea: se guarda sin vincular y con un solo audit", async () => {
    prepararConfirmacion({ fileName: "otro.pdf" });
    matchMock.mockReturnValueOnce(null);
    docCreate.mockResolvedValueOnce({ id: "doc_new" });

    await confirmar();

    expect(docCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({ taskId: null, fileName: "otro.pdf" }),
    });
    expect(taskUpdate).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledTimes(1);
  });

  it("tarea ya DONE no se modifica al subir el documento (no degrada)", async () => {
    prepararConfirmacion();
    matchMock.mockReturnValueOnce("DNI");
    taskFindFirst.mockResolvedValueOnce({ id: "t1", title: "Subir DNI" });
    docCreate.mockResolvedValueOnce({ id: "doc_new" });
    taskFindFirst.mockResolvedValueOnce({ id: "t1", title: "Subir DNI", status: "DONE" });

    await confirmar();

    expect(taskUpdate).not.toHaveBeenCalled();
  });

  it("un fallo del almacenamiento devuelve 500 generico y no filtra el motivo", async () => {
    caseFindFirst.mockResolvedValue({ id: "case_abc", orgId: "org1" });
    pendingFindUnique.mockResolvedValue(pendiente());
    headMock.mockRejectedValueOnce(new Error("S3 quota exceeded"));

    const res = await confirmar();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Error al subir archivo");
    expect(body.error).not.toContain("S3 quota");
    expect(docCreate).not.toHaveBeenCalled();
  });

  it("si el objeto no esta, no se inventa un documento", async () => {
    caseFindFirst.mockResolvedValue({ id: "case_abc", orgId: "org1" });
    pendingFindUnique.mockResolvedValue(pendiente());
    headMock.mockResolvedValue(null); // 404 real del almacenamiento

    const res = await confirmar();
    expect(res.status).toBe(400);
    expect(docCreate).not.toHaveBeenCalled();
  });

  it("un objeto de tamano distinto al autorizado se descarta y se borra", async () => {
    prepararConfirmacion();
    // Se autorizo 1024 y se ha escrito otra cosa: no es la operacion permitida.
    headMock.mockResolvedValue({ contentLength: TAMANO + 1 });

    const res = await confirmar();

    expect(res.status).toBe(400);
    expect(docCreate).not.toHaveBeenCalled();
    expect(borrarMock).toHaveBeenCalledWith(pendiente().fileKey);
    expect(pendingUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED" }) }),
    );
  });

  it("un contenido que no corresponde a la extension se descarta y se borra", async () => {
    prepararConfirmacion();
    // Bytes de PNG dentro de un .pdf: lo delata el contenido, no la cabecera
    // declarada, que aqui ya no la pone nadie.
    headBytesMock.mockResolvedValue(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );

    const res = await confirmar();

    expect(res.status).toBe(400);
    expect(docCreate).not.toHaveBeenCalled();
    expect(borrarMock).toHaveBeenCalledWith(pendiente().fileKey);
  });

  it("confirmar dos veces no crea dos documentos", async () => {
    caseFindFirst.mockResolvedValue({ id: "case_abc", orgId: "org1" });
    // Ya confirmada: la segunda llamada devuelve el mismo documento.
    pendingFindUnique.mockResolvedValue(
      pendiente({ status: "COMPLETED", documentId: "doc_new" }),
    );
    docFindUnique.mockResolvedValue({ id: "doc_new", fileName: "dni.pdf" });

    const res = await confirmar();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.id).toBe("doc_new");
    expect(docCreate).not.toHaveBeenCalled();
  });

  it("una subida de OTRO expediente no se puede confirmar desde este portal", async () => {
    caseFindFirst.mockResolvedValue({ id: "case_abc", orgId: "org1" });
    pendingFindUnique.mockResolvedValue(pendiente({ caseId: "case_ajeno", orgId: "org2" }));

    const res = await confirmar();

    expect(res.status).toBe(404);
    expect(docCreate).not.toHaveBeenCalled();
  });

  it("una subida INTERNA no se puede confirmar desde el portal", async () => {
    // El origen decide autoria y visibilidad: cambiarlo aqui convertiria un
    // documento interno en visible para la familia.
    caseFindFirst.mockResolvedValue({ id: "case_abc", orgId: "org1" });
    pendingFindUnique.mockResolvedValue(pendiente({ isPortalUpload: false }));

    const res = await confirmar();

    expect(res.status).toBe(404);
    expect(docCreate).not.toHaveBeenCalled();
  });

  it("una subida caducada se descarta y no crea documento", async () => {
    caseFindFirst.mockResolvedValue({ id: "case_abc", orgId: "org1" });
    pendingFindUnique.mockResolvedValue(
      pendiente({ expiresAt: new Date(Date.now() - 1000) }),
    );

    const res = await confirmar();

    expect(res.status).toBe(410);
    expect(docCreate).not.toHaveBeenCalled();
    expect(borrarMock).toHaveBeenCalledWith(pendiente().fileKey);
  });
});
