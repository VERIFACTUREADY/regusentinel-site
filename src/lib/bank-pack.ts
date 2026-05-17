/**
 * Bank document pack generator.
 * Each Spanish bank requires a standard set of documents for post-mortem processing.
 * This module defines what's needed and checks what's already available in the case.
 */

export interface BankDocRequirement {
  name: string;
  description: string;
  docTags: string[]; // matching docTags from case tasks/documents
  required: boolean;
}

export interface BankPack {
  bankName: string;
  requirements: BankDocRequirement[];
}

/**
 * Standard documents required by virtually all Spanish banks for inheritance processing.
 * Based on BdE guidelines and common bank requirements.
 */
const STANDARD_BANK_DOCS: BankDocRequirement[] = [
  {
    name: "Certificado de defuncion",
    description: "Original o copia autorizada del Registro Civil",
    docTags: ["certificado_defuncion"],
    required: true,
  },
  {
    name: "Certificado de ultimas voluntades",
    description: "Del Ministerio de Justicia (disponible tras 15 dias habiles)",
    docTags: ["certificado_saldos"], // linked via certificates process
    required: true,
  },
  {
    name: "Certificado de seguros de fallecimiento",
    description: "Del Ministerio de Justicia (disponible tras 15 dias habiles)",
    docTags: ["seguro_vida", "notificacion_seguro"],
    required: true,
  },
  {
    name: "Testamento o declaracion de herederos",
    description: "Copia autorizada del testamento o acta notarial de declaracion de herederos ab intestato",
    docTags: [],
    required: true,
  },
  {
    name: "DNI del fallecido",
    description: "Original o copia del documento de identidad",
    docTags: [],
    required: true,
  },
  {
    name: "DNI de los herederos",
    description: "Copias de todos los herederos que figuran en el testamento",
    docTags: [],
    required: true,
  },
  {
    name: "Escritura de aceptacion de herencia",
    description: "Escritura publica notarial de aceptacion y adjudicacion de herencia",
    docTags: ["transferencia_titularidad_banco"],
    required: true,
  },
  {
    name: "Justificante de pago ISD",
    description: "Modelo 650 presentado y pagado (o exento) ante la CCAA correspondiente",
    docTags: ["modelo_650"],
    required: true,
  },
  {
    name: "Justificante de plusvalia municipal",
    description: "Si hay inmuebles en la herencia, justificante de pago del IIVTNU",
    docTags: ["plazos_fiscales"],
    required: false,
  },
  {
    name: "Certificado de saldos",
    description: "Solicitar a la propia entidad bancaria (necesario para cuadro particional)",
    docTags: ["certificado_saldos"],
    required: true,
  },
];

/**
 * Generate bank pack with document status based on available case documents.
 */
export function generateBankPack(
  availableDocTags: Set<string>
): { requirements: BankDocRequirement[]; ready: number; total: number } {
  const requirements = STANDARD_BANK_DOCS;
  let ready = 0;
  const total = requirements.filter((r) => r.required).length;

  for (const req of requirements) {
    if (req.docTags.length > 0 && req.docTags.some((tag) => availableDocTags.has(tag))) {
      ready++;
    }
  }

  return { requirements, ready, total };
}

/**
 * Get the list of missing documents for the bank pack.
 */
export function getMissingBankDocs(
  availableDocTags: Set<string>
): BankDocRequirement[] {
  return STANDARD_BANK_DOCS.filter(
    (req) => req.required && (req.docTags.length === 0 || !req.docTags.some((tag) => availableDocTags.has(tag)))
  );
}
