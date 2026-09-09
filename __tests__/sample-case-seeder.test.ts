import { describe, it, expect, vi, beforeEach } from "vitest";
import { seedSampleCase } from "../src/lib/sample-case-seeder";

interface MockTx {
  case: {
    findFirst: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  task: {
    create: ReturnType<typeof vi.fn>;
  };
}

function makeMockTx(): MockTx {
  return {
    case: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    task: {
      create: vi.fn(),
    },
  };
}

describe("seedSampleCase", () => {
  let tx: MockTx;

  beforeEach(() => {
    tx = makeMockTx();
  });

  it("creates the case and tasks when none exists", async () => {
    tx.case.findFirst.mockResolvedValueOnce(null);
    tx.case.create.mockResolvedValueOnce({ id: "case-new-id" });
    tx.task.create.mockResolvedValue({});

    const result = await seedSampleCase(tx as any, "org-1");

    expect(result.created).toBe(true);
    expect(result.caseId).toBe("case-new-id");
    expect(result.caseRef).toBe("EXP-EJEMPLO");
    expect(tx.case.create).toHaveBeenCalledTimes(1);
    expect(tx.task.create).toHaveBeenCalledTimes(10);
  });

  it("is idempotent: returns existing case without creating", async () => {
    tx.case.findFirst.mockResolvedValueOnce({ id: "case-existing-id" });

    const result = await seedSampleCase(tx as any, "org-1");

    expect(result.created).toBe(false);
    expect(result.caseId).toBe("case-existing-id");
    expect(tx.case.create).not.toHaveBeenCalled();
    expect(tx.task.create).not.toHaveBeenCalled();
  });

  it("uses madrid as province (CCAA with 99% bonification)", async () => {
    tx.case.findFirst.mockResolvedValueOnce(null);
    tx.case.create.mockResolvedValueOnce({ id: "case-id" });
    tx.task.create.mockResolvedValue({});

    await seedSampleCase(tx as any, "org-1");

    const createArgs = tx.case.create.mock.calls[0][0];
    expect(createArgs.data.province).toBe("madrid");
  });

  it("deceased deathDate is ~160 days ago (ISD plazo a 20 días — Radar activo)", async () => {
    tx.case.findFirst.mockResolvedValueOnce(null);
    tx.case.create.mockResolvedValueOnce({ id: "case-id" });
    tx.task.create.mockResolvedValue({});

    await seedSampleCase(tx as any, "org-1");

    const createArgs = tx.case.create.mock.calls[0][0];
    const deathDate = createArgs.data.deceased.create.deathDate as Date;
    const daysSinceDeath = Math.floor((Date.now() - deathDate.getTime()) / 86400000);
    // -160 días: el plazo ISD ordinario (180d) cae en ~20 días, así
    // el detector dispara isd_30d y el prospecto ve el Radar activo
    // desde el día 1 del trial.
    expect(daysSinceDeath).toBeGreaterThanOrEqual(159);
    expect(daysSinceDeath).toBeLessThanOrEqual(161);
  });

  it("ref is EXP-EJEMPLO and isUrgent is false", async () => {
    tx.case.findFirst.mockResolvedValueOnce(null);
    tx.case.create.mockResolvedValueOnce({ id: "case-id" });
    tx.task.create.mockResolvedValue({});

    await seedSampleCase(tx as any, "org-1");

    const createArgs = tx.case.create.mock.calls[0][0];
    expect(createArgs.data.ref).toBe("EXP-EJEMPLO");
    expect(createArgs.data.isUrgent).toBe(false);
  });

  it("creates a case with hasDeceasedInsurance true (triggers SEGUROS workflow in radar)", async () => {
    tx.case.findFirst.mockResolvedValueOnce(null);
    tx.case.create.mockResolvedValueOnce({ id: "case-id" });
    tx.task.create.mockResolvedValue({});

    await seedSampleCase(tx as any, "org-1");

    const createArgs = tx.case.create.mock.calls[0][0];
    expect(createArgs.data.hasDeceasedInsurance).toBe(true);
  });

  it("populates the fiscal fields that drive Radar alerts", async () => {
    tx.case.findFirst.mockResolvedValueOnce(null);
    tx.case.create.mockResolvedValueOnce({ id: "case-id" });
    tx.task.create.mockResolvedValue({});

    await seedSampleCase(tx as any, "org-1");

    const data = tx.case.create.mock.calls[0][0].data;
    // Inmueble urbano + adquisición > transmisión → plusvalia_no_incremento
    expect(data.hasUrbanProperty).toBe(true);
    expect(data.referenciaCatastral).toMatch(/^[0-9A-Z]{20}$/);
    expect(data.propertyAcquisitionValue).toBeGreaterThan(data.propertyTransmissionValue);
    // Patrimonio próximo al tramo de 402.678 → patrimony_bracket warning
    expect(data.preexistingPatrimony).toBeGreaterThan(400000);
    expect(data.preexistingPatrimony).toBeLessThan(450000);
    // Residence change con Asturias previa (0% bonif) vs Madrid (99%) → warning
    expect(data.recentResidenceChange).toBe(true);
    expect(data.previousResidenceProvince).toBe("asturias");
    // Reducción con aniversario en los próximos 30 días → reduction_maintenance_30d
    expect(Array.isArray(data.appliedReductions)).toBe(true);
    expect(data.appliedReductions).toHaveLength(1);
    const reduction = data.appliedReductions[0];
    expect(reduction.type).toBe("VIVIENDA_HABITUAL");
    expect(reduction.maintenanceYears).toBe(5);
    const aniversario = new Date(reduction.appliedDate);
    aniversario.setFullYear(aniversario.getFullYear() + reduction.maintenanceYears);
    const daysUntil = Math.round((aniversario.getTime() - Date.now()) / 86400000);
    expect(daysUntil).toBeGreaterThan(0);
    expect(daysUntil).toBeLessThanOrEqual(30);
  });

  it("includes a mix of DONE / IN_PROGRESS / PENDING / BLOCKED tasks", async () => {
    tx.case.findFirst.mockResolvedValueOnce(null);
    tx.case.create.mockResolvedValueOnce({ id: "case-id" });
    tx.task.create.mockResolvedValue({});

    await seedSampleCase(tx as any, "org-1");

    const statuses = new Set(
      tx.task.create.mock.calls.map((c) => (c[0] as any).data.status)
    );
    expect(statuses.has("DONE")).toBe(true);
    expect(statuses.has("IN_PROGRESS")).toBe(true);
    expect(statuses.has("PENDING")).toBe(true);
    expect(statuses.has("BLOCKED")).toBe(true);
  });

  it("tasks have realistic categories (BANCOS, FISCAL, SEGUROS, etc.)", async () => {
    tx.case.findFirst.mockResolvedValueOnce(null);
    tx.case.create.mockResolvedValueOnce({ id: "case-id" });
    tx.task.create.mockResolvedValue({});

    await seedSampleCase(tx as any, "org-1");

    const categories = new Set(
      tx.task.create.mock.calls.map((c) => (c[0] as any).data.category)
    );
    expect(categories.has("FISCAL")).toBe(true);
    expect(categories.has("BANCOS")).toBe(true);
    expect(categories.has("SEGUROS")).toBe(true);
  });

  it("at least one task has a deadline in the past (overdue/done)", async () => {
    tx.case.findFirst.mockResolvedValueOnce(null);
    tx.case.create.mockResolvedValueOnce({ id: "case-id" });
    tx.task.create.mockResolvedValue({});

    await seedSampleCase(tx as any, "org-1");

    const now = Date.now();
    const hasPastDeadline = tx.task.create.mock.calls.some((c) => {
      const deadline = (c[0] as any).data.deadline as Date;
      return deadline.getTime() < now;
    });
    expect(hasPastDeadline).toBe(true);
  });

  it("at least one task has a future deadline (active)", async () => {
    tx.case.findFirst.mockResolvedValueOnce(null);
    tx.case.create.mockResolvedValueOnce({ id: "case-id" });
    tx.task.create.mockResolvedValue({});

    await seedSampleCase(tx as any, "org-1");

    const now = Date.now();
    const hasFutureDeadline = tx.task.create.mock.calls.some((c) => {
      const deadline = (c[0] as any).data.deadline as Date;
      return deadline.getTime() > now;
    });
    expect(hasFutureDeadline).toBe(true);
  });

  it("query filters by orgId, ref and excludes soft-deleted", async () => {
    tx.case.findFirst.mockResolvedValueOnce(null);
    tx.case.create.mockResolvedValueOnce({ id: "case-id" });
    tx.task.create.mockResolvedValue({});

    await seedSampleCase(tx as any, "org-test");

    const findArgs = tx.case.findFirst.mock.calls[0][0];
    expect(findArgs.where.orgId).toBe("org-test");
    expect(findArgs.where.ref).toBe("EXP-EJEMPLO");
    expect(findArgs.where.deletedAt).toBeNull();
  });
});
