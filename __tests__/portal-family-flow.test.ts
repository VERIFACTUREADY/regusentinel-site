import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../src/lib/prisma", () => ({
  prisma: {
    case: { findFirst: vi.fn(), update: vi.fn() },
    portalMessage: { findMany: vi.fn(), create: vi.fn() },
    document: { findMany: vi.fn(), create: vi.fn() },
    task: { findFirst: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("../src/lib/s3", () => ({
  uploadFile: vi.fn().mockResolvedValue(undefined),
  getPresignedUrl: vi.fn().mockResolvedValue("https://signed-url"),
}));

vi.mock("../src/lib/audit", () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/doc-task-matching", () => ({
  matchDocumentToTag: vi.fn(),
}));

vi.mock("../src/lib/workflow-engine", () => ({
  triggerWorkflow: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/deadline-engine", () => ({
  getCaseDeadlines: vi.fn(() => ({ modelo650: new Date(), siguientes: [] })),
}));

import { prisma } from "../src/lib/prisma";
import { uploadFile, getPresignedUrl } from "../src/lib/s3";
import { logAudit } from "../src/lib/audit";
import { matchDocumentToTag } from "../src/lib/doc-task-matching";
import { triggerWorkflow } from "../src/lib/workflow-engine";

import { GET as portalGET } from "../src/app/api/portal/[token]/route";
import { GET as messagesGET, POST as messagesPOST } from "../src/app/api/portal/[token]/messages/route";
import { POST as consentPOST } from "../src/app/api/portal/[token]/consent/route";
import { GET as docsGET, POST as docsPOST } from "../src/app/api/portal/[token]/documents/route";

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
  for (const m of [caseFindFirst, caseUpdate, msgFindMany, msgCreate, docFindMany, docCreate, taskFindFirst, taskFindUnique, taskUpdate, uploadMock, presignedMock, auditMock, matchMock, workflowMock]) {
    m.mockReset();
  }
  uploadMock.mockResolvedValue(undefined);
  presignedMock.mockResolvedValue("https://signed-url");
  auditMock.mockResolvedValue(undefined);
  workflowMock.mockResolvedValue(undefined);
}

// ─── GET /api/portal/[token] ───────────────────────────────

describe("GET /api/portal/[token] — vista principal del expediente", () => {
  beforeEach(resetAll);

  it("404 si el token no corresponde a ningun expediente", async () => {
    caseFindFirst.mockResolvedValueOnce(null);
    const res = await portalGET(fakeReq(), { params: { token: "invalid" } });
    expect(res.status).toBe(404);
  });

  it("filtra por portalEnabled=true y deletedAt=null (no expone disabled ni borrados)", async () => {
    caseFindFirst.mockResolvedValueOnce(fakeCase());
    await portalGET(fakeReq(), { params: { token: "tok123" } });

    const where = caseFindFirst.mock.calls[0][0].where;
    expect(where.portalEnabled).toBe(true);
    expect(where.deletedAt).toBe(null);
    expect(where.portalToken).toBe("tok123");
  });

  it("plan INICIA muestra 'Powered by Heredia' (showPoweredBy=true)", async () => {
    caseFindFirst.mockResolvedValueOnce(fakeCase({ org: { ...fakeCase().org, subscription: { plan: "INICIA" } } }));
    const res = await portalGET(fakeReq(), { params: { token: "tok123" } });
    const body = await res.json();
    expect(body.branding.showPoweredBy).toBe(true);
  });

  it("plan DESPACHO oculta 'Powered by Heredia' (white-label)", async () => {
    caseFindFirst.mockResolvedValueOnce(fakeCase({ org: { ...fakeCase().org, subscription: { plan: "DESPACHO" } } }));
    const res = await portalGET(fakeReq(), { params: { token: "tok123" } });
    const body = await res.json();
    expect(body.branding.showPoweredBy).toBe(false);
  });

  it("plan FIRMA tambien oculta 'Powered by Heredia'", async () => {
    caseFindFirst.mockResolvedValueOnce(fakeCase({ org: { ...fakeCase().org, subscription: { plan: "FIRMA" } } }));
    const res = await portalGET(fakeReq(), { params: { token: "tok123" } });
    const body = await res.json();
    expect(body.branding.showPoweredBy).toBe(false);
  });

  it("detecta pendingDocs: tareas con docTag, no DONE, sin documento vinculado", async () => {
    caseFindFirst.mockResolvedValueOnce(fakeCase({
      tasks: [
        { id: "t1", title: "Subir DNI heredero", status: "PENDING", category: "DOCS", docTag: "DNI", deadline: null, blockedUntil: null, sortOrder: 1 },
        { id: "t2", title: "Tarea sin tag", status: "PENDING", category: "DOCS", docTag: null, deadline: null, blockedUntil: null, sortOrder: 2 },
        { id: "t3", title: "Subir certificado defuncion", status: "DONE", category: "DOCS", docTag: "CERT_DEFUNCION", deadline: null, blockedUntil: null, sortOrder: 3 },
      ],
      documents: [],
    }));

    const res = await portalGET(fakeReq(), { params: { token: "tok123" } });
    const body = await res.json();

    expect(body.pendingDocs).toHaveLength(1);
    expect(body.pendingDocs[0].title).toBe("Subir DNI heredero");
  });

  it("no incluye en pendingDocs tareas DONE aunque tengan docTag", async () => {
    caseFindFirst.mockResolvedValueOnce(fakeCase({
      tasks: [
        { id: "t1", title: "X", status: "DONE", category: "DOCS", docTag: "DNI", deadline: null, blockedUntil: null, sortOrder: 1 },
        { id: "t2", title: "Y", status: "SKIPPED", category: "DOCS", docTag: "TASA", deadline: null, blockedUntil: null, sortOrder: 2 },
      ],
      documents: [],
    }));

    const res = await portalGET(fakeReq(), { params: { token: "tok123" } });
    const body = await res.json();
    expect(body.pendingDocs).toHaveLength(0);
  });
});

// ─── POST /api/portal/[token]/consent ──────────────────────

describe("POST /api/portal/[token]/consent — aceptacion RGPD del heredero", () => {
  beforeEach(resetAll);

  it("404 si el expediente no existe", async () => {
    caseFindFirst.mockResolvedValueOnce(null);
    const res = await consentPOST(fakeReq({ body: { authorName: "Andrea" } }), { params: { token: "x" } });
    expect(res.status).toBe(404);
    expect(caseUpdate).not.toHaveBeenCalled();
  });

  it("acepta consent y guarda fecha + autor", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc", consentAccepted: false });
    caseUpdate.mockResolvedValueOnce({});

    const res = await consentPOST(fakeReq({ body: { authorName: "Andrea Martin" } }), { params: { token: "tok123" } });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(caseUpdate).toHaveBeenCalledWith({
      where: { id: "case_abc" },
      data: expect.objectContaining({
        consentAccepted: true,
        consentDate: expect.any(Date),
        legitimationNote: "Andrea Martin",
      }),
    });
  });

  it("ignora authorName vacio o solo espacios", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc", consentAccepted: false });
    caseUpdate.mockResolvedValueOnce({});

    await consentPOST(fakeReq({ body: { authorName: "   " } }), { params: { token: "tok123" } });

    const data = caseUpdate.mock.calls[0][0].data;
    expect(data.legitimationNote).toBeUndefined(); // no se actualiza si vacio
    expect(data.consentAccepted).toBe(true);
  });
});

// ─── GET/POST /api/portal/[token]/messages ─────────────────

describe("GET /api/portal/[token]/messages — historial de mensajes", () => {
  beforeEach(resetAll);

  it("404 si el expediente no existe", async () => {
    caseFindFirst.mockResolvedValueOnce(null);
    const res = await messagesGET(fakeReq(), { params: { token: "x" } });
    expect(res.status).toBe(404);
  });

  it("devuelve mensajes ordenados ascendentemente (cronologico)", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc" });
    msgFindMany.mockResolvedValueOnce([
      { id: "m1", fromFamily: true, authorName: "Andrea", content: "Hola", createdAt: new Date("2026-01-10") },
      { id: "m2", fromFamily: false, authorName: "Gestor", content: "Recibido", createdAt: new Date("2026-01-11") },
    ]);

    const res = await messagesGET(fakeReq(), { params: { token: "tok123" } });
    const body = await res.json();

    expect(body).toHaveLength(2);
    expect(msgFindMany.mock.calls[0][0].orderBy).toEqual({ createdAt: "asc" });
  });
});

describe("POST /api/portal/[token]/messages — enviar mensaje familiar", () => {
  beforeEach(resetAll);

  it("404 si el expediente no existe", async () => {
    caseFindFirst.mockResolvedValueOnce(null);
    const res = await messagesPOST(fakeReq({ body: { content: "Hola" } }), { params: { token: "x" } });
    expect(res.status).toBe(404);
    expect(msgCreate).not.toHaveBeenCalled();
  });

  it("400 si el mensaje esta vacio", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc" });
    const res = await messagesPOST(fakeReq({ body: { content: "" } }), { params: { token: "tok123" } });
    expect(res.status).toBe(400);
  });

  it("400 si el mensaje supera 2000 caracteres", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc" });
    const longMsg = "x".repeat(2001);
    const res = await messagesPOST(fakeReq({ body: { content: longMsg } }), { params: { token: "tok123" } });
    expect(res.status).toBe(400);
    expect(msgCreate).not.toHaveBeenCalled();
  });

  it("crea mensaje con fromFamily=true (siempre, viene del portal)", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc" });
    msgCreate.mockResolvedValueOnce({ id: "m1", fromFamily: true, authorName: "Andrea", content: "Hola gestor", createdAt: new Date() });

    const res = await messagesPOST(fakeReq({ body: { content: "Hola gestor", authorName: "Andrea" } }), { params: { token: "tok123" } });

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
    const res = await docsGET(fakeReq(), { params: { token: "x" } });
    expect(res.status).toBe(404);
  });

  it("devuelve documentos con presigned URL de S3", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc" });
    docFindMany.mockResolvedValueOnce([
      { id: "d1", fileName: "DNI.pdf", fileKey: "org1/case_abc/portal/dni.pdf", createdAt: new Date(), isPortalUpload: true, task: { id: "t1", title: "Subir DNI", category: "DOCS" } },
    ]);

    const res = await docsGET(fakeReq(), { params: { token: "tok123" } });
    const body = await res.json();

    expect(body).toHaveLength(1);
    expect(body[0].downloadUrl).toBe("https://signed-url");
    expect(body[0].linkedTask.title).toBe("Subir DNI");
    expect(presignedMock).toHaveBeenCalledWith("org1/case_abc/portal/dni.pdf");
  });
});

describe("POST /api/portal/[token]/documents — subir documento", () => {
  beforeEach(resetAll);

  function fakeFile(name: string, mimeType = "application/pdf", size = 1024): File {
    const blob = new Blob(["x".repeat(size)], { type: mimeType });
    return new File([blob], name, { type: mimeType });
  }

  function fakeFormReq(file: File | null) {
    return fakeReq({
      form: async () => {
        const fd = new FormData();
        if (file) fd.set("file", file);
        return fd;
      },
    });
  }

  it("404 si el expediente no existe", async () => {
    caseFindFirst.mockResolvedValueOnce(null);
    const res = await docsPOST(fakeFormReq(fakeFile("dni.pdf")), { params: { token: "x" } });
    expect(res.status).toBe(404);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("400 si no se envia archivo", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc", orgId: "org1" });
    const res = await docsPOST(fakeFormReq(null), { params: { token: "tok123" } });
    expect(res.status).toBe(400);
    expect(uploadMock).not.toHaveBeenCalled();
  });

  it("happy path: sube a S3, crea Document, auto-match tarea + audit log", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc", orgId: "org1" });
    matchMock.mockReturnValueOnce("DNI"); // doc se identifica como DNI
    taskFindFirst.mockResolvedValueOnce({ id: "t1", title: "Subir DNI heredero" });
    docCreate.mockResolvedValueOnce({ id: "doc_new", fileName: "dni.pdf" });
    taskFindUnique.mockResolvedValueOnce({ id: "t1", title: "Subir DNI heredero", status: "PENDING" });
    taskUpdate.mockResolvedValueOnce({});

    const res = await docsPOST(fakeFormReq(fakeFile("dni.pdf")), { params: { token: "tok123" } });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("doc_new");

    // S3 upload
    expect(uploadMock).toHaveBeenCalledOnce();
    const [fileKey, , mimeType] = uploadMock.mock.calls[0];
    expect(fileKey).toMatch(/^org1\/case_abc\/portal\/\d+-dni\.pdf$/);
    expect(mimeType).toBe("application/pdf");

    // Document vinculado a la tarea
    expect(docCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: "case_abc",
        taskId: "t1",
        fileName: "dni.pdf",
        isPortalUpload: true,
      }),
    });

    // Task pasa a READY automaticamente
    expect(taskUpdate).toHaveBeenCalledWith({
      where: { id: "t1" },
      data: { status: "READY" },
    });

    // Dos audits: uno por la tarea auto-actualizada, otro por el upload
    expect(auditMock).toHaveBeenCalledTimes(2);
    expect(workflowMock).toHaveBeenCalledWith({
      type: "DOCUMENT_UPLOADED",
      orgId: "org1",
      caseId: "case_abc",
    });
  });

  it("documento sin match de tarea: se sube sin vincular y audit dice 'sin tarea'", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc", orgId: "org1" });
    matchMock.mockReturnValueOnce(null); // no se identifica el tag
    docCreate.mockResolvedValueOnce({ id: "doc_new" });

    await docsPOST(fakeFormReq(fakeFile("otro.pdf")), { params: { token: "tok123" } });

    expect(docCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: null,
        fileName: "otro.pdf",
      }),
    });
    expect(taskUpdate).not.toHaveBeenCalled();
    // Solo 1 audit (el del upload), no el de tarea actualizada
    expect(auditMock).toHaveBeenCalledTimes(1);
  });

  it("tarea ya DONE no se modifica al subir el documento (no degrada)", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc", orgId: "org1" });
    matchMock.mockReturnValueOnce("DNI");
    taskFindFirst.mockResolvedValueOnce({ id: "t1", title: "Subir DNI" });
    docCreate.mockResolvedValueOnce({ id: "doc_new" });
    taskFindUnique.mockResolvedValueOnce({ id: "t1", title: "Subir DNI", status: "DONE" });

    await docsPOST(fakeFormReq(fakeFile("dni.pdf")), { params: { token: "tok123" } });

    expect(taskUpdate).not.toHaveBeenCalled();
  });

  it("error en upload S3 devuelve 500 con mensaje generico", async () => {
    caseFindFirst.mockResolvedValueOnce({ id: "case_abc", orgId: "org1" });
    uploadMock.mockRejectedValueOnce(new Error("S3 quota exceeded"));

    const res = await docsPOST(fakeFormReq(fakeFile("dni.pdf")), { params: { token: "tok123" } });
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error).toBe("Error al subir archivo");
    expect(body.error).not.toContain("S3 quota");
  });
});
