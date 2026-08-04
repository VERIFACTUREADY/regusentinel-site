/**
 * Integracion real (PostgreSQL): la purga elimina de verdad.
 *
 * El cron anterior solo ponia `deletedAt` y lo llamaba "limpieza": el
 * expediente seguia integro en la base de datos y sus documentos en S3. Estas
 * pruebas comprueban contra PostgreSQL que ahora las filas desaparecen y que
 * la auditoria que se conserva queda anonimizada.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

// S3 simulado: registra las claves borradas y permite forzar un fallo.
const borradas: string[] = [];
let fallarS3 = false;
vi.mock("../../src/lib/s3", () => ({
  deleteFile: vi.fn(async (key: string) => {
    if (fallarS3) throw new Error("S3 no disponible");
    borradas.push(key);
  }),
}));

import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";
import { purgeCase, runRetention, purgeOldPromptLogs } from "../../src/lib/retention";

beforeAll(async () => { await resetDatabase(); });
afterAll(async () => { await prisma.$disconnect(); });
beforeEach(async () => {
  await resetDatabase();
  borradas.length = 0;
  fallarS3 = false;
});

/** Expediente con documento, tarea, mensaje, consentimiento y auditoria. */
async function casoCompleto(orgId: string, ref: string) {
  const caso = await createCase(orgId, ref);
  await prisma.document.create({
    data: { caseId: caso.id, fileName: "dni.pdf", fileKey: `k/${caso.id}/dni` },
  });
  await prisma.task.create({
    data: { caseId: caso.id, category: "BANCOS", title: "Certificado de saldos" },
  });
  await prisma.portalMessage.create({
    data: { caseId: caso.id, fromFamily: true, content: "Adjunto el DNI de mi madre" },
  });
  await prisma.portalConsent.create({
    data: { caseId: caso.id, version: "v1", textHash: "h", declaredName: "Ana Perez", ip: "1.2.3.4" },
  });
  await prisma.auditLog.create({
    data: {
      orgId,
      caseId: caso.id,
      action: "document.uploaded",
      details: 'Archivo "DNI-Maria-Garcia.pdf" subido',
      ip: "203.0.113.9",
    },
  });
  return caso;
}

describe("La purga elimina de verdad", () => {
  it("borra el expediente y todos sus datos personales de PostgreSQL y S3", async () => {
    const { org } = await createOrg();
    const caso = await casoCompleto(org.id, "EXP-2026-0001");

    const r = await purgeCase(caso.id, prisma);

    expect(r.ok).toBe(true);
    expect(r.s3Deleted).toBe(1);
    expect(borradas).toContain(`k/${caso.id}/dni`);

    // Nada de esto debe quedar.
    expect(await prisma.case.findUnique({ where: { id: caso.id } })).toBeNull();
    expect(await prisma.document.count({ where: { caseId: caso.id } })).toBe(0);
    expect(await prisma.task.count({ where: { caseId: caso.id } })).toBe(0);
    expect(await prisma.portalMessage.count({ where: { caseId: caso.id } })).toBe(0);
    expect(await prisma.portalConsent.count({ where: { caseId: caso.id } })).toBe(0);
    expect(await prisma.deceased.count({ where: { caseId: caso.id } })).toBe(0);
    expect(await prisma.caseContact.count({ where: { caseId: caso.id } })).toBe(0);
  });

  it("la auditoria se conserva pero ANONIMIZADA", async () => {
    const { org } = await createOrg();
    const caso = await casoCompleto(org.id, "EXP-2026-0002");

    await purgeCase(caso.id, prisma);

    const logs = await prisma.auditLog.findMany({ where: { orgId: org.id } });
    const previos = logs.filter((l) => l.action === "document.uploaded");

    expect(previos.length).toBeGreaterThan(0);
    for (const log of previos) {
      // Se conserva la actuacion, no el dato personal.
      expect(log.caseId).toBeNull();
      expect(log.ip).toBeNull();
      expect(log.details).not.toContain("Maria-Garcia");
      expect(log.details).toContain("purgado");
    }
  });

  it("no queda ningun nombre del causante en la base de datos", async () => {
    const { org } = await createOrg();
    const caso = await casoCompleto(org.id, "EXP-2026-0003");

    await purgeCase(caso.id, prisma);

    // El helper crea el fallecido como "Fallecido Prueba".
    const restos = await prisma.deceased.findMany({ where: { fullName: "Fallecido Prueba" } });
    expect(restos).toHaveLength(0);
  });

  it("es idempotente: purgar dos veces no falla", async () => {
    const { org } = await createOrg();
    const caso = await casoCompleto(org.id, "EXP-2026-0004");

    expect((await purgeCase(caso.id, prisma)).ok).toBe(true);
    expect((await purgeCase(caso.id, prisma)).ok).toBe(true);
  });
});

describe("Fallo parcial y reintento", () => {
  it("si S3 falla, NO se borra la fila y queda marcada para reintento", async () => {
    const { org } = await createOrg();
    const caso = await casoCompleto(org.id, "EXP-2026-0010");
    fallarS3 = true;

    const r = await purgeCase(caso.id, prisma);

    expect(r.ok).toBe(false);
    expect(r.s3Failed).toBe(1);

    // La fila sigue: decir "eliminado" con el fichero aun en S3 seria falso.
    const sigue = await prisma.case.findUnique({ where: { id: caso.id } });
    expect(sigue).not.toBeNull();
    expect(sigue!.purgeAttempts).toBe(1);
    expect(sigue!.purgeError).toContain("S3");
    expect(sigue!.purgedAt).toBeNull();
  });

  it("el reintento completa la purga cuando S3 se recupera", async () => {
    const { org } = await createOrg();
    const caso = await casoCompleto(org.id, "EXP-2026-0011");

    fallarS3 = true;
    expect((await purgeCase(caso.id, prisma)).ok).toBe(false);

    fallarS3 = false;
    const segundo = await purgeCase(caso.id, prisma);

    expect(segundo.ok).toBe(true);
    expect(await prisma.case.findUnique({ where: { id: caso.id } })).toBeNull();
  });
});

describe("Ciclo completo de retencion", () => {
  it("programa la purga de los cerrados vencidos sin borrarlos aun", async () => {
    const { org } = await createOrg();
    await prisma.organization.update({ where: { id: org.id }, data: { retentionDays: 30 } });

    const caso = await createCase(org.id, "EXP-2026-0020");
    await prisma.case.update({
      where: { id: caso.id },
      data: { status: "CLOSED", closedAt: new Date("2020-01-01") },
    });

    const r = await runRetention(prisma);

    expect(r.scheduled).toBe(1);
    const tras = await prisma.case.findUniqueOrThrow({ where: { id: caso.id } });
    expect(tras.deletedAt).not.toBeNull();
    expect(tras.purgeScheduledAt).not.toBeNull();
    // Margen de gracia: todavia NO se ha purgado.
    expect(tras.purgedAt).toBeNull();
    expect(r.purged).toBe(0);
  });

  it("purga los que ya alcanzaron su fecha programada", async () => {
    const { org } = await createOrg();
    const caso = await casoCompleto(org.id, "EXP-2026-0021");
    await prisma.case.update({
      where: { id: caso.id },
      data: { deletedAt: new Date("2020-01-01"), purgeScheduledAt: new Date("2020-02-01") },
    });

    const r = await runRetention(prisma);

    expect(r.purged).toBe(1);
    expect(await prisma.case.findUnique({ where: { id: caso.id } })).toBeNull();
  });

  it("no purga un expediente cuya fecha programada aun no ha llegado", async () => {
    const { org } = await createOrg();
    const caso = await casoCompleto(org.id, "EXP-2026-0022");
    await prisma.case.update({
      where: { id: caso.id },
      data: {
        deletedAt: new Date(),
        purgeScheduledAt: new Date(Date.now() + 30 * 86400000),
      },
    });

    const r = await runRetention(prisma);

    expect(r.purged).toBe(0);
    expect(await prisma.case.findUnique({ where: { id: caso.id } })).not.toBeNull();
  });
});

describe("Retencion de PromptLog", () => {
  it("elimina los registros de IA vencidos y conserva los recientes", async () => {
    const { org, owner } = await createOrg();
    const caso = await createCase(org.id, "EXP-2026-0030");

    await prisma.promptLog.create({
      data: {
        caseId: caso.id,
        userId: owner.id,
        action: "analyze_case",
        contextHash: "a".repeat(64),
        response: "{}",
        createdAt: new Date("2020-01-01"),
      },
    });
    await prisma.promptLog.create({
      data: {
        caseId: caso.id,
        userId: owner.id,
        action: "analyze_case",
        contextHash: "b".repeat(64),
        response: "{}",
      },
    });

    const borrados = await purgeOldPromptLogs(90, prisma);

    expect(borrados).toBe(1);
    expect(await prisma.promptLog.count()).toBe(1);
  });

  it("PromptLog ya no tiene columna para el prompt integro", async () => {
    const columnas = await prisma.$queryRawUnsafe<Array<{ column_name: string }>>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'PromptLog'`,
    );
    const nombres = columnas.map((c) => c.column_name);
    expect(nombres).not.toContain("prompt");
    expect(nombres).toContain("contextHash");
  });
});
