/**
 * Integracion real (PostgreSQL): visibilidad documental por defecto y
 * evidencia de consentimiento.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";
import { getConsentStatus, recordConsent, PORTAL_CONSENT_VERSION } from "../../src/lib/portal-consent";

beforeAll(async () => { await resetDatabase(); });
afterAll(async () => { await prisma.$disconnect(); });
beforeEach(async () => { await resetDatabase(); });

describe("Visibilidad documental por defecto", () => {
  it("un documento interno NO es visible para la familia salvo que se indique", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-0001");

    const doc = await prisma.document.create({
      data: {
        caseId: caso.id,
        fileName: "informe-interno.pdf",
        fileKey: "k/interno",
        // No se pasa visibleToFamily: manda el valor por defecto del esquema.
      },
    });

    expect(doc.visibleToFamily).toBe(false);
  });

  it("la consulta del portal no devuelve documentos internos", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-0002");

    await prisma.document.create({
      data: { caseId: caso.id, fileName: "interno.pdf", fileKey: "k/1" },
    });
    await prisma.document.create({
      data: {
        caseId: caso.id,
        fileName: "de-la-familia.pdf",
        fileKey: "k/2",
        isPortalUpload: true,
        visibleToFamily: true,
      },
    });

    // Exactamente el filtro del endpoint del portal.
    const visibles = await prisma.document.findMany({
      where: { caseId: caso.id, visibleToFamily: true, deletionState: null },
      select: { fileName: true },
    });

    expect(visibles).toHaveLength(1);
    expect(visibles[0].fileName).toBe("de-la-familia.pdf");
  });

  it("un documento con borrado fallido en S3 se excluye del portal", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-0003");

    await prisma.document.create({
      data: {
        caseId: caso.id,
        fileName: "pendiente.pdf",
        fileKey: "k/3",
        visibleToFamily: true,
        deletionState: "S3_DELETE_FAILED",
      },
    });

    const visibles = await prisma.document.findMany({
      where: { caseId: caso.id, visibleToFamily: true, deletionState: null },
    });
    expect(visibles).toHaveLength(0);
  });
});

describe("Evidencia de consentimiento", () => {
  it("sin aceptacion, el estado no es valido", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-0010");

    const estado = await getConsentStatus(caso.id, prisma);
    expect(estado.valid).toBe(false);
  });

  it("una aceptacion registra version, hash, IP y user-agent", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-0011");

    await recordConsent({
      caseId: caso.id,
      declaredName: "Andrea",
      ip: "203.0.113.9",
      userAgent: "Mozilla/5.0",
      db: prisma,
    });

    const fila = await prisma.portalConsent.findFirstOrThrow({ where: { caseId: caso.id } });
    expect(fila.version).toBe(PORTAL_CONSENT_VERSION);
    expect(fila.textHash).toHaveLength(64); // SHA-256 hex
    expect(fila.ip).toBe("203.0.113.9");
    expect(fila.userAgent).toBe("Mozilla/5.0");

    expect((await getConsentStatus(caso.id, prisma)).valid).toBe(true);
  });

  it("una segunda aceptacion NO sobrescribe la anterior: se conserva el historico", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-0012");

    await recordConsent({ caseId: caso.id, declaredName: "Primera", db: prisma });
    await recordConsent({ caseId: caso.id, declaredName: "Segunda", db: prisma });

    const filas = await prisma.portalConsent.findMany({
      where: { caseId: caso.id },
      orderBy: { acceptedAt: "asc" },
    });
    expect(filas).toHaveLength(2);
    expect(filas.map((f) => f.declaredName)).toEqual(["Primera", "Segunda"]);
  });

  it("retirar el consentimiento invalida el acceso", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-0013");

    const consent = await recordConsent({ caseId: caso.id, db: prisma });
    expect((await getConsentStatus(caso.id, prisma)).valid).toBe(true);

    await prisma.portalConsent.update({
      where: { id: consent.id },
      data: { withdrawnAt: new Date() },
    });

    expect((await getConsentStatus(caso.id, prisma)).valid).toBe(false);
  });

  it("borrar el expediente arrastra su evidencia de consentimiento", async () => {
    const { org } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-0014");
    await recordConsent({ caseId: caso.id, db: prisma });

    await prisma.case.delete({ where: { id: caso.id } });

    expect(await prisma.portalConsent.count({ where: { caseId: caso.id } })).toBe(0);
  });
});
