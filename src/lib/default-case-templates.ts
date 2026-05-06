/**
 * Plantillas de expediente por defecto que se crean automaticamente al registrarse.
 *
 * Permiten que un nuevo despacho/funeraria pueda aplicar una plantilla a su primer
 * expediente sin tener que configurarla desde cero. Cubre los casos mas habituales
 * en gestion post-fallecimiento en Espanya.
 */

import type { Prisma } from "@prisma/client";

type TaskCategory =
  | "BANCOS"
  | "SUMINISTROS"
  | "TELECOM"
  | "SUSCRIPCIONES"
  | "SEGUROS"
  | "VIDA_DIGITAL"
  | "FISCAL"
  | "OTROS";

interface TemplateTaskSeed {
  category: TaskCategory;
  title: string;
  description: string;
  deadlineOffsetDays: number | null;
  sortOrder: number;
}

interface CaseTemplateSeed {
  name: string;
  description: string;
  categories: TaskCategory[];
  isDefault: boolean;
  tasks: TemplateTaskSeed[];
}

export const DEFAULT_CASE_TEMPLATES: CaseTemplateSeed[] = [
  {
    name: "Defuncion estandar",
    description:
      "Tareas habituales tras un fallecimiento sin patrimonio inmobiliario complejo. Cubre bancos, suministros, telecom y fiscal.",
    categories: ["BANCOS", "SUMINISTROS", "TELECOM", "FISCAL"],
    isDefault: true,
    tasks: [
      {
        category: "OTROS",
        title: "Solicitar Certificado Literal de Defuncion",
        description:
          "Pedir copias literales en el Registro Civil. Necesarias para la mayoria de tramites posteriores. Suele tardar 1-15 dias segun Registro.",
        deadlineOffsetDays: 7,
        sortOrder: 0,
      },
      {
        category: "OTROS",
        title: "Solicitar Certificado de Ultimas Voluntades",
        description:
          "Tramite obligatorio antes de la herencia. Solo se puede pedir tras 15 dias habiles desde el fallecimiento. Modelo 790-006.",
        deadlineOffsetDays: 25,
        sortOrder: 1,
      },
      {
        category: "OTROS",
        title: "Solicitar Certificado de Contratos de Seguros",
        description:
          "Permite saber si el causante tenia seguros de vida. Mismo plazo que el de Ultimas Voluntades.",
        deadlineOffsetDays: 25,
        sortOrder: 2,
      },
      {
        category: "BANCOS",
        title: "Bloquear cuentas y solicitar saldos a fecha de fallecimiento",
        description:
          "Contactar con cada banco donde el causante fuera titular. Solicitar certificado de saldos a fecha exacta del fallecimiento.",
        deadlineOffsetDays: 14,
        sortOrder: 3,
      },
      {
        category: "BANCOS",
        title: "Reclamar saldos a la herencia (si procede)",
        description:
          "Una vez aceptada la herencia, los saldos se reparten segun escritura. Necesario certificado de defuncion, ultimas voluntades y testamento o declaracion de herederos.",
        deadlineOffsetDays: 60,
        sortOrder: 4,
      },
      {
        category: "SUMINISTROS",
        title: "Cambiar titularidad de luz",
        description:
          "Contactar con la comercializadora electrica. Documentacion: certificado de defuncion + DNI del nuevo titular. Suele ser gratuito por mortis causa.",
        deadlineOffsetDays: 30,
        sortOrder: 5,
      },
      {
        category: "SUMINISTROS",
        title: "Cambiar titularidad de gas",
        description:
          "Mismo proceso que luz. Si la vivienda queda desocupada, valorar baja del suministro.",
        deadlineOffsetDays: 30,
        sortOrder: 6,
      },
      {
        category: "SUMINISTROS",
        title: "Cambiar titularidad de agua",
        description:
          "Contactar con el ayuntamiento o empresa concesionaria municipal. Documentacion habitual: defuncion + DNI nuevo titular + recibo anterior.",
        deadlineOffsetDays: 30,
        sortOrder: 7,
      },
      {
        category: "TELECOM",
        title: "Dar de baja o cambiar titularidad de movil/fijo/internet",
        description:
          "La permanencia se rompe sin penalizacion al presentar certificado de defuncion. Conservar el numero si la familia lo desea.",
        deadlineOffsetDays: 30,
        sortOrder: 8,
      },
      {
        category: "FISCAL",
        title: "Presentar Modelo 650 (ISD) — autoliquidacion",
        description:
          "Plazo legal: 6 meses desde el fallecimiento. Posibilidad de prorroga 6 meses adicionales si se solicita en los primeros 5 meses.",
        deadlineOffsetDays: 180,
        sortOrder: 9,
      },
      {
        category: "FISCAL",
        title: "Presentar Modelo 651 si hay donaciones previas",
        description:
          "Solo aplica si en los 4 anyos anteriores hubo donaciones del causante a los herederos. Verificar para evitar regularizaciones.",
        deadlineOffsetDays: 180,
        sortOrder: 10,
      },
      {
        category: "FISCAL",
        title: "Presentar Plusvalia municipal (si hay inmuebles urbanos)",
        description:
          "Modelo del ayuntamiento donde radique cada inmueble. Plazo: 6 meses desde el fallecimiento, prorrogable a 1 anyo en muchos municipios.",
        deadlineOffsetDays: 180,
        sortOrder: 11,
      },
    ],
  },

  {
    name: "Defuncion con seguros de vida",
    description:
      "Anyade reclamacion de capitales aseguradores y cobro de seguros de decesos al flujo estandar.",
    categories: ["BANCOS", "SUMINISTROS", "SEGUROS", "FISCAL"],
    isDefault: false,
    tasks: [
      {
        category: "OTROS",
        title: "Solicitar Certificado de Defuncion",
        description: "Original para Hacienda + copias para cada aseguradora.",
        deadlineOffsetDays: 7,
        sortOrder: 0,
      },
      {
        category: "OTROS",
        title: "Solicitar Certificado de Contratos de Seguros (RCSV)",
        description:
          "Imprescindible para conocer todos los seguros suscritos por el causante. Modelo 790-006. Plazo de espera 15 dias habiles.",
        deadlineOffsetDays: 25,
        sortOrder: 1,
      },
      {
        category: "SEGUROS",
        title: "Reclamar capital de seguros de vida",
        description:
          "Para cada seguro identificado: enviar declaracion de siniestro, certificado de defuncion, DNI beneficiarios, certificado medico de la causa. Plazo legal de respuesta: 40 dias.",
        deadlineOffsetDays: 60,
        sortOrder: 2,
      },
      {
        category: "SEGUROS",
        title: "Tramitar seguro de decesos (si existe)",
        description:
          "Cobertura de gastos de sepelio. Algunas polizas cubren tambien tramites administrativos.",
        deadlineOffsetDays: 30,
        sortOrder: 3,
      },
      {
        category: "SEGUROS",
        title: "Cancelar seguros del hogar / coche del causante",
        description:
          "Enviar certificado de defuncion. Solicitar prorrateo de prima no consumida. Si los bienes quedan en la herencia, cambiar titularidad antes.",
        deadlineOffsetDays: 30,
        sortOrder: 4,
      },
      {
        category: "BANCOS",
        title: "Bloquear cuentas y solicitar saldos a fecha del fallecimiento",
        description:
          "Si el seguro estaba domiciliado en una cuenta del causante, los recibos volveran. Coordinar con la aseguradora.",
        deadlineOffsetDays: 14,
        sortOrder: 5,
      },
      {
        category: "FISCAL",
        title: "Declarar capitales de seguros de vida en el ISD",
        description:
          "Los capitales aseguradores tributan en ISD. Existe reduccion estatal de 9.195,49€ por beneficiario. Importante incluir en el Modelo 650.",
        deadlineOffsetDays: 180,
        sortOrder: 6,
      },
      {
        category: "FISCAL",
        title: "Presentar Modelo 650 (ISD)",
        description:
          "Plazo legal: 6 meses desde el fallecimiento. Considerar prorroga si la documentacion de seguros aun no esta lista.",
        deadlineOffsetDays: 180,
        sortOrder: 7,
      },
    ],
  },

  {
    name: "Defuncion con vivienda en propiedad",
    description:
      "Para herencias con uno o mas inmuebles. Anyade plusvalia, cambio de titularidad de IBI y gestion de comunidad.",
    categories: ["BANCOS", "SUMINISTROS", "FISCAL", "OTROS"],
    isDefault: false,
    tasks: [
      {
        category: "OTROS",
        title: "Recopilar escrituras de cada inmueble",
        description:
          "Si no se localizan, solicitar nota simple en el Registro de la Propiedad y copia simple en notaria. Imprescindible para la valoracion fiscal.",
        deadlineOffsetDays: 30,
        sortOrder: 0,
      },
      {
        category: "OTROS",
        title: "Tasar inmuebles a valor de mercado",
        description:
          "Para el ISD se debe declarar el valor real (o el de referencia si es superior). Una tasacion oficial puede ahorrar problemas con Hacienda.",
        deadlineOffsetDays: 60,
        sortOrder: 1,
      },
      {
        category: "FISCAL",
        title: "Comprobar Valor de Referencia del Catastro",
        description:
          "Desde 2022 el ISD se calcula sobre el Valor de Referencia salvo que se declare uno superior. Consultar en sede.catastro.gob.es.",
        deadlineOffsetDays: 30,
        sortOrder: 2,
      },
      {
        category: "FISCAL",
        title: "Presentar Plusvalia municipal por cada inmueble urbano",
        description:
          "Modelo del ayuntamiento. Plazo: 6 meses prorrogables hasta 1 anyo. Si hay varios inmuebles en distintos municipios, son tramites separados.",
        deadlineOffsetDays: 180,
        sortOrder: 3,
      },
      {
        category: "FISCAL",
        title: "Cambiar titularidad del IBI tras la escritura de aceptacion",
        description:
          "Modelo 901N en el ayuntamiento. Necesaria escritura de aceptacion de herencia inscrita en el Registro.",
        deadlineOffsetDays: 240,
        sortOrder: 4,
      },
      {
        category: "OTROS",
        title: "Comunicar cambio a la comunidad de propietarios",
        description:
          "Dirigirse al administrador de fincas. Cambia el receptor de cuotas y comunicaciones. Algunas comunidades exigen acta firmada.",
        deadlineOffsetDays: 90,
        sortOrder: 5,
      },
      {
        category: "BANCOS",
        title: "Comprobar si hay hipoteca pendiente con seguro de amortizacion",
        description:
          "Muchos prestamos tienen seguro de vida que cancela la hipoteca al fallecer el titular. Reclamar a la aseguradora correspondiente.",
        deadlineOffsetDays: 30,
        sortOrder: 6,
      },
      {
        category: "SUMINISTROS",
        title: "Decidir cambio de titular o baja en cada suministro",
        description:
          "Si la vivienda queda vacia: baja temporal. Si la usa un heredero: cambio de titular. Si se vende: el comprador asume las nuevas altas.",
        deadlineOffsetDays: 60,
        sortOrder: 7,
      },
      {
        category: "FISCAL",
        title: "Presentar Modelo 650 (ISD)",
        description:
          "Plazo legal: 6 meses desde el fallecimiento. Con inmuebles, valorar prorroga para asegurar que las tasaciones esten listas.",
        deadlineOffsetDays: 180,
        sortOrder: 8,
      },
    ],
  },
];

/**
 * Crea las plantillas por defecto para una organizacion recien creada.
 * Devuelve el numero de plantillas creadas.
 *
 * Idempotente: si ya existen plantillas para esta org, no hace nada.
 */
export async function seedDefaultCaseTemplates(
  tx: Prisma.TransactionClient,
  orgId: string
): Promise<number> {
  const existing = await tx.caseTemplate.count({ where: { orgId } });
  if (existing > 0) return 0;

  let created = 0;
  for (const template of DEFAULT_CASE_TEMPLATES) {
    await tx.caseTemplate.create({
      data: {
        orgId,
        name: template.name,
        description: template.description,
        categories: template.categories,
        isDefault: template.isDefault,
        tasks: {
          create: template.tasks.map((t) => ({
            category: t.category,
            title: t.title,
            description: t.description,
            deadlineOffsetDays: t.deadlineOffsetDays,
            sortOrder: t.sortOrder,
          })),
        },
      },
    });
    created++;
  }
  return created;
}
