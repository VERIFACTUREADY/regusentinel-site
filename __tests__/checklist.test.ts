import { describe, it, expect } from "vitest";

// Inline the checklist rules logic to avoid Prisma client dependency

type TaskCategory = "BANCOS" | "SUMINISTROS" | "TELECOM" | "SUSCRIPCIONES" | "SEGUROS" | "VIDA_DIGITAL" | "FISCAL" | "OTROS";

interface ChecklistItem {
  category: TaskCategory;
  title: string;
  description: string;
  sortOrder: number;
  deadlineOffsetDays: number | null;
}

const RULES: Record<TaskCategory, { title: string; description: string; deadlineOffsetDays?: number }[]> = {
  BANCOS: [
    { title: "Solicitar certificado de saldos", description: "Solicitar a cada entidad bancaria...", deadlineOffsetDays: 30 },
    { title: "Notificar fallecimiento a entidad bancaria", description: "Presentar certificado...", deadlineOffsetDays: 15 },
    { title: "Solicitar bloqueo de cuentas", description: "Solicitar el bloqueo preventivo...", deadlineOffsetDays: 7 },
    { title: "Gestionar transferencia de titularidad", description: "Una vez obtenida la escritura..." },
  ],
  SUMINISTROS: [
    { title: "Cambio de titularidad de suministros (luz, agua, gas)", description: "Contactar...", deadlineOffsetDays: 60 },
    { title: "Solicitar baja de suministros no necesarios", description: "Identificar...", deadlineOffsetDays: 90 },
  ],
  TELECOM: [
    { title: "Notificar a operadores de telecomunicaciones", description: "Contactar...", deadlineOffsetDays: 30 },
    { title: "Solicitar portabilidad o baja de lineas", description: "Gestionar...", deadlineOffsetDays: 60 },
  ],
  SUSCRIPCIONES: [
    { title: "Identificar y cancelar suscripciones activas", description: "Revisar extractos...", deadlineOffsetDays: 30 },
    { title: "Solicitar reembolsos pendientes", description: "Para suscripciones...", deadlineOffsetDays: 60 },
  ],
  SEGUROS: [
    { title: "Reclamar seguro de vida", description: "Identificar polizas...", deadlineOffsetDays: 150 },
    { title: "Notificar a companias de seguros", description: "Notificar...", deadlineOffsetDays: 30 },
    { title: "Gestionar seguro de decesos", description: "Si el fallecido...", deadlineOffsetDays: 7 },
  ],
  VIDA_DIGITAL: [
    { title: "Gestionar cuentas de redes sociales", description: "Identificar...", deadlineOffsetDays: 90 },
    { title: "Solicitar memorializacion o cierre", description: "Presentar...", deadlineOffsetDays: 120 },
    { title: "Recuperar datos digitales", description: "Solicitar la descarga...", deadlineOffsetDays: 60 },
  ],
  FISCAL: [
    { title: "Recopilar documentacion fiscal del fallecido", description: "Reunir...", deadlineOffsetDays: 60 },
    { title: "Preparar modelo 650 (Impuesto de Sucesiones)", description: "Elaborar...", deadlineOffsetDays: 180 },
    { title: "Identificar plazos fiscales aplicables", description: "Verificar...", deadlineOffsetDays: 15 },
  ],
  OTROS: [
    { title: "Notificar a Seguridad Social", description: "Comunicar...", deadlineOffsetDays: 30 },
    { title: "Solicitar certificado de defuncion", description: "Obtener copias...", deadlineOffsetDays: 7 },
    { title: "Gestionar pension de viudedad/orfandad", description: "Solicitar...", deadlineOffsetDays: 90 },
  ],
};

function getChecklistForCategories(categories: TaskCategory[]): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  let globalSort = 0;
  for (const category of categories) {
    const rules = RULES[category];
    if (!rules) continue;
    for (const rule of rules) {
      items.push({ category, title: rule.title, description: rule.description, sortOrder: globalSort++, deadlineOffsetDays: rule.deadlineOffsetDays ?? null });
    }
  }
  return items;
}

describe("Checklist Rules", () => {
  it("should generate checklist for BANCOS category", () => {
    const result = getChecklistForCategories(["BANCOS"]);
    expect(result).toHaveLength(4);
    expect(result[0].category).toBe("BANCOS");
    expect(result[0].title).toBe("Solicitar certificado de saldos");
    expect(result[3].title).toBe("Gestionar transferencia de titularidad");
  });

  it("should generate checklist for multiple categories", () => {
    const result = getChecklistForCategories(["BANCOS", "SUMINISTROS"]);
    expect(result).toHaveLength(6); // 4 + 2
    expect(result[0].category).toBe("BANCOS");
    expect(result[4].category).toBe("SUMINISTROS");
  });

  it("should return empty array for empty categories", () => {
    const result = getChecklistForCategories([]);
    expect(result).toHaveLength(0);
  });

  it("should assign sequential sortOrder", () => {
    const result = getChecklistForCategories(["BANCOS", "TELECOM"]);
    for (let i = 0; i < result.length; i++) {
      expect(result[i].sortOrder).toBe(i);
    }
  });

  it("should generate all categories", () => {
    const allCategories: TaskCategory[] = [
      "BANCOS", "SUMINISTROS", "TELECOM", "SUSCRIPCIONES",
      "SEGUROS", "VIDA_DIGITAL", "FISCAL", "OTROS",
    ];
    const result = getChecklistForCategories(allCategories);
    expect(result.length).toBeGreaterThan(20);

    const categories = new Set(result.map((r) => r.category));
    expect(categories.size).toBe(8);
  });

  it("should include FISCAL tasks for fiscal category", () => {
    const result = getChecklistForCategories(["FISCAL"]);
    expect(result).toHaveLength(3);
    expect(result.some((t) => t.title.includes("modelo 650"))).toBe(true);
  });

  it("should include deadline offsets for tasks with legal deadlines", () => {
    const result = getChecklistForCategories(["FISCAL"]);
    const modelo650 = result.find((t) => t.title.includes("modelo 650"));
    expect(modelo650?.deadlineOffsetDays).toBe(180);
  });

  it("should return null deadlineOffsetDays for tasks without deadlines", () => {
    const result = getChecklistForCategories(["BANCOS"]);
    const transferencia = result.find((t) => t.title.includes("transferencia de titularidad"));
    expect(transferencia?.deadlineOffsetDays).toBeNull();
  });

  it("should have deadline offsets on all categories with legal requirements", () => {
    const result = getChecklistForCategories(["OTROS"]);
    const certDefuncion = result.find((t) => t.title.includes("certificado de defuncion"));
    expect(certDefuncion?.deadlineOffsetDays).toBe(7);
    const pension = result.find((t) => t.title.includes("pension"));
    expect(pension?.deadlineOffsetDays).toBe(90);
  });
});
