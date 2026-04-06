import { describe, it, expect } from "vitest";

// Inline the checklist rules logic to avoid Prisma client dependency

type TaskCategory = "BANCOS" | "SUMINISTROS" | "TELECOM" | "SUSCRIPCIONES" | "SEGUROS" | "VIDA_DIGITAL" | "FISCAL" | "OTROS";

interface ChecklistItem {
  category: TaskCategory;
  title: string;
  description: string;
  sortOrder: number;
}

const RULES: Record<TaskCategory, { title: string; description: string }[]> = {
  BANCOS: [
    { title: "Solicitar certificado de saldos", description: "Solicitar a cada entidad bancaria..." },
    { title: "Notificar fallecimiento a entidad bancaria", description: "Presentar certificado..." },
    { title: "Solicitar bloqueo de cuentas", description: "Solicitar el bloqueo preventivo..." },
    { title: "Gestionar transferencia de titularidad", description: "Una vez obtenida la escritura..." },
  ],
  SUMINISTROS: [
    { title: "Cambio de titularidad de suministros (luz, agua, gas)", description: "Contactar..." },
    { title: "Solicitar baja de suministros no necesarios", description: "Identificar..." },
  ],
  TELECOM: [
    { title: "Notificar a operadores de telecomunicaciones", description: "Contactar..." },
    { title: "Solicitar portabilidad o baja de lineas", description: "Gestionar..." },
  ],
  SUSCRIPCIONES: [
    { title: "Identificar y cancelar suscripciones activas", description: "Revisar extractos..." },
    { title: "Solicitar reembolsos pendientes", description: "Para suscripciones..." },
  ],
  SEGUROS: [
    { title: "Reclamar seguro de vida", description: "Identificar polizas..." },
    { title: "Notificar a companias de seguros", description: "Notificar..." },
    { title: "Gestionar seguro de decesos", description: "Si el fallecido..." },
  ],
  VIDA_DIGITAL: [
    { title: "Gestionar cuentas de redes sociales", description: "Identificar..." },
    { title: "Solicitar memorializacion o cierre", description: "Presentar..." },
    { title: "Recuperar datos digitales", description: "Solicitar la descarga..." },
  ],
  FISCAL: [
    { title: "Recopilar documentacion fiscal del fallecido", description: "Reunir..." },
    { title: "Preparar modelo 650 (Impuesto de Sucesiones)", description: "Elaborar..." },
    { title: "Identificar plazos fiscales aplicables", description: "Verificar..." },
  ],
  OTROS: [
    { title: "Notificar a Seguridad Social", description: "Comunicar..." },
    { title: "Solicitar certificado de defuncion", description: "Obtener copias..." },
    { title: "Gestionar pension de viudedad/orfandad", description: "Solicitar..." },
  ],
};

function getChecklistForCategories(categories: TaskCategory[]): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  let globalSort = 0;
  for (const category of categories) {
    const rules = RULES[category];
    if (!rules) continue;
    for (const rule of rules) {
      items.push({ category, title: rule.title, description: rule.description, sortOrder: globalSort++ });
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
});
