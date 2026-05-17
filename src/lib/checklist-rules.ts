import { TaskCategory } from "@prisma/client";

// ─── Rule definitions per category ─────────────────────

interface ChecklistItem {
  category: TaskCategory;
  title: string;
  description: string;
  sortOrder: number;
  docTag: string | null;
  deadlineOffsetDays: number | null;
}

interface RuleDefinition {
  title: string;
  description: string;
  docTag: string | null;
  deadlineOffsetDays?: number;
}

const RULES: Record<TaskCategory, RuleDefinition[]> = {
  [TaskCategory.BANCOS]: [
    {
      title: "Solicitar certificado de saldos",
      description:
        "Solicitar a cada entidad bancaria un certificado de saldos a fecha de fallecimiento para el inventario de la herencia.",
      docTag: "certificado_saldos",
      deadlineOffsetDays: 30,
    },
    {
      title: "Notificar fallecimiento a entidad bancaria",
      description:
        "Presentar certificado de defuncion en todas las entidades bancarias donde el fallecido tenia cuentas o productos financieros.",
      docTag: "notificacion_banco",
      deadlineOffsetDays: 15,
    },
    {
      title: "Solicitar bloqueo de cuentas",
      description:
        "Solicitar el bloqueo preventivo de cuentas y tarjetas para evitar movimientos no autorizados hasta la adjudicacion de la herencia.",
      docTag: "bloqueo_cuentas",
      deadlineOffsetDays: 7,
    },
    {
      title: "Gestionar transferencia de titularidad",
      description:
        "Una vez obtenida la escritura de aceptacion de herencia, gestionar el cambio de titularidad de cuentas y productos bancarios.",
      docTag: "transferencia_titularidad_banco",
    },
  ],

  [TaskCategory.SUMINISTROS]: [
    {
      title: "Cambio de titularidad de suministros (luz, agua, gas)",
      description:
        "Contactar con las companias de suministros para realizar el cambio de titularidad de los contratos de luz, agua y gas a nombre del heredero o nuevo titular.",
      docTag: "titularidad_suministros",
      deadlineOffsetDays: 60,
    },
    {
      title: "Solicitar baja de suministros no necesarios",
      description:
        "Identificar suministros contratados que ya no sean necesarios (por ejemplo, en vivienda que se va a vender) y solicitar su baja.",
      docTag: "baja_suministros",
      deadlineOffsetDays: 90,
    },
  ],

  [TaskCategory.TELECOM]: [
    {
      title: "Notificar a operadores de telecomunicaciones",
      description:
        "Contactar con operadores de telefonia, internet y television para notificar el fallecimiento y solicitar informacion sobre contratos vigentes.",
      docTag: "notificacion_telecom",
      deadlineOffsetDays: 30,
    },
    {
      title: "Solicitar portabilidad o baja de lineas",
      description:
        "Gestionar la portabilidad de lineas telefonicas que se deseen conservar o solicitar la baja de las que no sean necesarias, evitando penalizaciones.",
      docTag: "baja_telecom",
      deadlineOffsetDays: 60,
    },
  ],

  [TaskCategory.SUSCRIPCIONES]: [
    {
      title: "Identificar y cancelar suscripciones activas",
      description:
        "Revisar extractos bancarios y correos electronicos para identificar todas las suscripciones activas (streaming, revistas, apps, gimnasio, etc.) y proceder a su cancelacion.",
      docTag: "cancelacion_suscripciones",
      deadlineOffsetDays: 30,
    },
    {
      title: "Solicitar reembolsos pendientes",
      description:
        "Para suscripciones con periodos prepagados no consumidos, solicitar el reembolso proporcional a los proveedores correspondientes.",
      docTag: "reembolso_suscripciones",
      deadlineOffsetDays: 60,
    },
  ],

  [TaskCategory.SEGUROS]: [
    {
      title: "Reclamar seguro de vida",
      description:
        "Identificar polizas de seguro de vida del fallecido mediante el Registro de Contratos de Seguros de Cobertura de Fallecimiento y presentar la reclamacion con la documentacion requerida.",
      docTag: "seguro_vida",
      deadlineOffsetDays: 150,
    },
    {
      title: "Notificar a companias de seguros",
      description:
        "Notificar el fallecimiento a todas las companias de seguros donde el fallecido tuviera polizas contratadas (hogar, auto, salud, etc.).",
      docTag: "notificacion_seguro",
      deadlineOffsetDays: 30,
    },
    {
      title: "Gestionar seguro de decesos",
      description:
        "Si el fallecido contaba con un seguro de decesos, activar la cobertura para gastos funerarios y tramites asociados.",
      docTag: "seguro_decesos",
      deadlineOffsetDays: 7,
    },
  ],

  [TaskCategory.VIDA_DIGITAL]: [
    {
      title: "Gestionar cuentas de redes sociales",
      description:
        "Identificar las cuentas en redes sociales del fallecido (Facebook, Instagram, Twitter/X, LinkedIn, etc.) y decidir si se solicita la memorializacion o el cierre.",
      docTag: "redes_sociales",
      deadlineOffsetDays: 90,
    },
    {
      title: "Solicitar memorializacion o cierre",
      description:
        "Presentar la documentacion requerida por cada plataforma para memorializar la cuenta (mantenerla como homenaje) o proceder a su eliminacion definitiva.",
      docTag: "memorializacion",
      deadlineOffsetDays: 120,
    },
    {
      title: "Recuperar datos digitales",
      description:
        "Solicitar la descarga de datos personales almacenados en servicios en la nube (Google, Apple, Microsoft, etc.) antes de proceder al cierre de cuentas.",
      docTag: "datos_digitales",
      deadlineOffsetDays: 60,
    },
  ],

  [TaskCategory.FISCAL]: [
    {
      title: "Recopilar documentacion fiscal del fallecido",
      description:
        "Reunir todas las declaraciones fiscales, certificados de IRPF, datos catastrales, e informacion sobre bienes y deudas del fallecido.",
      docTag: "doc_fiscal",
      deadlineOffsetDays: 60,
    },
    {
      title: "Preparar modelo 650 (Impuesto de Sucesiones)",
      description:
        "Elaborar y presentar el modelo 650 de autoliquidacion del Impuesto sobre Sucesiones y Donaciones ante la Comunidad Autonoma correspondiente.",
      docTag: "modelo_650",
      deadlineOffsetDays: 180,
    },
    {
      title: "Identificar plazos fiscales aplicables",
      description:
        "Verificar los plazos de presentacion del Impuesto de Sucesiones (6 meses desde fallecimiento, prorrogable) y de la plusvalia municipal (6 meses), para evitar recargos.",
      docTag: "plazos_fiscales",
      deadlineOffsetDays: 15,
    },
  ],

  [TaskCategory.OTROS]: [
    {
      title: "Notificar a Seguridad Social",
      description:
        "Comunicar el fallecimiento a la Seguridad Social para dar de baja al fallecido y gestionar las prestaciones que pudieran corresponder a los beneficiarios.",
      docTag: "seguridad_social",
      deadlineOffsetDays: 30,
    },
    {
      title: "Solicitar certificado de defuncion",
      description:
        "Obtener copias suficientes del certificado de defuncion en el Registro Civil, documento imprescindible para la mayoria de tramites post-mortem.",
      docTag: "certificado_defuncion",
      deadlineOffsetDays: 7,
    },
    {
      title: "Gestionar pension de viudedad/orfandad",
      description:
        "Solicitar ante la Seguridad Social las pensiones de viudedad u orfandad que correspondan a los familiares del fallecido.",
      docTag: "pension",
      deadlineOffsetDays: 90,
    },
  ],
};

// ─── Public API ─────────────────────────────────────────

/**
 * Generate a task checklist based on the given categories.
 * Returns items sorted by category order, then by sortOrder within each category.
 */
export function getChecklistForCategories(
  categories: TaskCategory[]
): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  let globalSort = 0;

  for (const category of categories) {
    const rules = RULES[category];
    if (!rules) continue;

    for (const rule of rules) {
      items.push({
        category,
        title: rule.title,
        description: rule.description,
        sortOrder: globalSort++,
        docTag: rule.docTag,
        deadlineOffsetDays: rule.deadlineOffsetDays ?? null,
      });
    }
  }

  return items;
}
