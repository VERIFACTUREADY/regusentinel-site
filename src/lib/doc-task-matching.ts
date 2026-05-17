import { TaskCategory } from "@prisma/client";

/**
 * Document-to-task matching rules.
 * Each task has a docTag and a set of keywords that match filenames.
 * When a document is uploaded, we search for the best matching PENDING task.
 */

interface DocMatchRule {
  category: TaskCategory;
  taskTitle: string;
  docTag: string;
  keywords: string[]; // lowercase substrings to match in filename
}

export const DOC_MATCH_RULES: DocMatchRule[] = [
  // BANCOS
  { category: "BANCOS", taskTitle: "Solicitar certificado de saldos", docTag: "certificado_saldos", keywords: ["certificado", "saldos", "saldo", "extracto bancario"] },
  { category: "BANCOS", taskTitle: "Notificar fallecimiento a entidad bancaria", docTag: "notificacion_banco", keywords: ["notificacion banco", "comunicacion banco", "defuncion banco"] },
  { category: "BANCOS", taskTitle: "Solicitar bloqueo de cuentas", docTag: "bloqueo_cuentas", keywords: ["bloqueo", "bloqueo cuenta"] },
  { category: "BANCOS", taskTitle: "Gestionar transferencia de titularidad", docTag: "transferencia_titularidad_banco", keywords: ["transferencia titularidad", "cambio titularidad banco", "escritura herencia", "aceptacion herencia"] },

  // SUMINISTROS
  { category: "SUMINISTROS", taskTitle: "Cambio de titularidad de suministros (luz, agua, gas)", docTag: "titularidad_suministros", keywords: ["suministro", "luz", "agua", "gas", "endesa", "iberdrola", "naturgy", "titularidad suministro"] },
  { category: "SUMINISTROS", taskTitle: "Solicitar baja de suministros no necesarios", docTag: "baja_suministros", keywords: ["baja suministro", "cancelacion suministro"] },

  // TELECOM
  { category: "TELECOM", taskTitle: "Notificar a operadores de telecomunicaciones", docTag: "notificacion_telecom", keywords: ["telecom", "telefonica", "movistar", "vodafone", "orange", "masmovil", "operador"] },
  { category: "TELECOM", taskTitle: "Solicitar portabilidad o baja de lineas", docTag: "baja_telecom", keywords: ["portabilidad", "baja linea", "baja telefon"] },

  // SUSCRIPCIONES
  { category: "SUSCRIPCIONES", taskTitle: "Identificar y cancelar suscripciones activas", docTag: "cancelacion_suscripciones", keywords: ["suscripcion", "cancelacion suscripcion", "netflix", "spotify", "gimnasio", "streaming"] },
  { category: "SUSCRIPCIONES", taskTitle: "Solicitar reembolsos pendientes", docTag: "reembolso_suscripciones", keywords: ["reembolso", "devolucion suscripcion"] },

  // SEGUROS
  { category: "SEGUROS", taskTitle: "Reclamar seguro de vida", docTag: "seguro_vida", keywords: ["seguro vida", "poliza vida", "reclamacion seguro vida", "cobertura fallecimiento"] },
  { category: "SEGUROS", taskTitle: "Notificar a companias de seguros", docTag: "notificacion_seguro", keywords: ["notificacion seguro", "poliza", "seguro hogar", "seguro auto", "seguro salud"] },
  { category: "SEGUROS", taskTitle: "Gestionar seguro de decesos", docTag: "seguro_decesos", keywords: ["decesos", "seguro decesos", "funeraria", "cobertura funerari"] },

  // VIDA_DIGITAL
  { category: "VIDA_DIGITAL", taskTitle: "Gestionar cuentas de redes sociales", docTag: "redes_sociales", keywords: ["facebook", "instagram", "twitter", "linkedin", "red social", "redes sociales"] },
  { category: "VIDA_DIGITAL", taskTitle: "Solicitar memorializacion o cierre", docTag: "memorializacion", keywords: ["memorializacion", "cierre cuenta", "eliminar cuenta"] },
  { category: "VIDA_DIGITAL", taskTitle: "Recuperar datos digitales", docTag: "datos_digitales", keywords: ["datos digital", "google takeout", "descarga datos", "backup", "nube", "icloud"] },

  // FISCAL
  { category: "FISCAL", taskTitle: "Recopilar documentacion fiscal del fallecido", docTag: "doc_fiscal", keywords: ["irpf", "declaracion renta", "catastro", "fiscal", "hacienda", "agencia tributaria"] },
  { category: "FISCAL", taskTitle: "Preparar modelo 650 (Impuesto de Sucesiones)", docTag: "modelo_650", keywords: ["modelo 650", "sucesiones", "impuesto sucesiones", "autoliquidacion"] },
  { category: "FISCAL", taskTitle: "Identificar plazos fiscales aplicables", docTag: "plazos_fiscales", keywords: ["plazo fiscal", "plusvalia", "plusvalia municipal"] },

  // OTROS
  { category: "OTROS", taskTitle: "Solicitar certificado de defuncion", docTag: "certificado_defuncion", keywords: ["certificado defuncion", "defuncion", "registro civil", "partida defuncion"] },
  { category: "OTROS", taskTitle: "Notificar a Seguridad Social", docTag: "seguridad_social", keywords: ["seguridad social", "ss", "inss", "baja seguridad social"] },
  { category: "OTROS", taskTitle: "Gestionar pension de viudedad/orfandad", docTag: "pension", keywords: ["pension", "viudedad", "orfandad", "prestacion"] },
];

/**
 * Find the best matching task for a given filename among PENDING tasks.
 * Returns the docTag of the best match, or null if no match.
 */
export function matchDocumentToTag(fileName: string): string | null {
  const lower = fileName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  let bestMatch: { docTag: string; score: number } | null = null;

  for (const rule of DOC_MATCH_RULES) {
    for (const keyword of rule.keywords) {
      const normalizedKeyword = keyword.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      if (lower.includes(normalizedKeyword)) {
        const score = normalizedKeyword.length; // longer match = more specific
        if (!bestMatch || score > bestMatch.score) {
          bestMatch = { docTag: rule.docTag, score };
        }
      }
    }
  }

  return bestMatch?.docTag ?? null;
}

/**
 * Get the docTag for a task based on its title and category.
 */
export function getDocTagForTask(category: TaskCategory, title: string): string | null {
  const rule = DOC_MATCH_RULES.find(
    (r) => r.category === category && r.taskTitle === title
  );
  return rule?.docTag ?? null;
}
