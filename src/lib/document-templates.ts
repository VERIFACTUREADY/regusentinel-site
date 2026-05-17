/**
 * Catalogo de plantillas de documentos pre-redactadas para gestion post-mortem.
 *
 * Cada plantilla define:
 *   - Metadatos (slug, titulo, descripcion, destinatario)
 *   - Lista de campos requeridos
 *   - Cuerpo del documento con placeholders {{key}}
 *   - Footer con notas legales si procede
 *
 * Se usa tanto en la pagina publica /plantillas-documentos (lead magnet)
 * como dentro del producto para autocompletar desde el expediente.
 */

export type FieldType = "text" | "textarea" | "date" | "number" | "select";

export interface DocumentField {
  key: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  required?: boolean;
  helpText?: string;
  options?: string[];
  defaultValue?: string;
}

export interface DocumentTemplate {
  slug: string;
  title: string;
  description: string;
  destinatario: string;
  category: "banco" | "aseguradora" | "fiscal" | "comunidad" | "otros";
  /** Plain-text body with {{placeholders}} */
  body: string;
  /** Optional footer (legal disclaimer, attachments list) */
  footer?: string;
  fields: DocumentField[];
  /** Document title that appears at top (left margin) */
  documentTitle: string;
  /** Reference label below title ("Re: Solicitud certificado de saldos") */
  referenceLine?: string;
}

const COMMON_HEADER_FIELDS: DocumentField[] = [
  { key: "remitenteName", label: "Tu nombre y apellidos", type: "text", required: true, placeholder: "Maria Perez Lopez" },
  { key: "remitenteDni", label: "Tu DNI / NIE", type: "text", required: true, placeholder: "12345678A" },
  { key: "remitenteAddress", label: "Tu domicilio", type: "text", placeholder: "C/ Mayor 1, 28001 Madrid" },
  { key: "remitenteEmail", label: "Email de contacto", type: "text", placeholder: "tu@email.com" },
  { key: "remitentePhone", label: "Telefono de contacto", type: "text", placeholder: "+34 600 000 000" },
];

const COMMON_DECEASED_FIELDS: DocumentField[] = [
  { key: "deceasedName", label: "Nombre completo del causante (fallecido)", type: "text", required: true, placeholder: "Juan Garcia Lopez" },
  { key: "deceasedDni", label: "DNI / NIE del causante", type: "text", required: true, placeholder: "87654321B" },
  { key: "deathDate", label: "Fecha de fallecimiento", type: "date", required: true },
];

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    slug: "carta-banco-solicitud-saldos",
    title: "Carta al banco solicitando saldos a fecha de fallecimiento",
    description: "Modelo de carta para solicitar a una entidad bancaria el certificado de saldos del causante a fecha de fallecimiento, necesario para el Modelo 650.",
    destinatario: "Entidad bancaria",
    category: "banco",
    documentTitle: "SOLICITUD DE CERTIFICADO DE SALDOS A FECHA DE FALLECIMIENTO",
    referenceLine: "Re: Causante {{deceasedName}} - DNI {{deceasedDni}}",
    fields: [
      ...COMMON_HEADER_FIELDS,
      ...COMMON_DECEASED_FIELDS,
      { key: "relationship", label: "Tu parentesco con el causante", type: "select", required: true, options: ["Hijo/a", "Conyuge", "Padre/Madre", "Hermano/a", "Albacea", "Representante legal", "Otro"] },
      { key: "bancoName", label: "Nombre del banco", type: "text", required: true, placeholder: "Banco Santander" },
      { key: "bancoOffice", label: "Oficina / sucursal donde el causante operaba", type: "text", placeholder: "Sucursal Madrid Centro" },
      { key: "knownAccounts", label: "Cuentas conocidas (opcional)", type: "textarea", placeholder: "ES12 0049 0001 23 4567890123\\nES98 0049 5555 22 9988776655" },
    ],
    body: `Estimados/as señores/as:

Por la presente, en mi condicion de {{relationship}} del causante {{deceasedName}}, con DNI {{deceasedDni}}, fallecido/a el {{deathDate}}, vengo a SOLICITAR la emision del certificado de saldos a la fecha del fallecimiento de todas las cuentas, depositos, productos de inversion y cualesquiera otros instrumentos financieros que el causante mantuviese en esa entidad.

A tal efecto:

PRIMERO. Se acompañan a la presente solicitud los documentos acreditativos siguientes: certificado literal de defuncion expedido por el Registro Civil, copia de mi DNI/NIE y, en su caso, declaracion de herederos abintestato o testamento, junto con certificado de ultimas voluntades.

SEGUNDO. La informacion solicitada se requiere para los siguientes fines:
  a) Confeccionar el inventario del caudal hereditario.
  b) Cumplimentar la autoliquidacion del Impuesto sobre Sucesiones (Modelo 650), conforme a la Ley 29/1987 y al plazo legal de seis meses desde el fallecimiento.
  c) Tramitar la posterior aceptacion y particion de la herencia ante notario.

TERCERO. Solicito que el certificado se emita por escrito, con firma autorizada, indicando expresamente para cada producto: numero de cuenta o referencia, saldo a fecha del fallecimiento ({{deathDate}}), titularidad (individual / mancomunada / solidaria) y movimientos de los seis meses anteriores.

CUARTO. Quedo a su disposicion para aportar cualquier documentacion adicional. Para la entrega del certificado pueden remitirlo a la siguiente direccion:

  {{remitenteName}}
  {{remitenteAddress}}
  Email: {{remitenteEmail}}
  Telefono: {{remitentePhone}}

Agradeciendo de antemano su colaboracion, le saluda atentamente,`,
    footer: "Documentacion adjunta: certificado literal de defuncion, DNI del solicitante, certificado de ultimas voluntades y, en su caso, copia simple del testamento o declaracion de herederos abintestato.",
  },

  {
    slug: "solicitud-prorroga-modelo-650",
    title: "Solicitud de prórroga del Impuesto sobre Sucesiones (Modelo 650)",
    description: "Escrito dirigido a la oficina liquidadora autonomica para solicitar la prorroga de 6 meses adicionales del plazo del Modelo 650.",
    destinatario: "Oficina liquidadora de la CCAA del causante",
    category: "fiscal",
    documentTitle: "SOLICITUD DE PRORROGA DEL PLAZO DE PRESENTACION DEL IMPUESTO SOBRE SUCESIONES",
    referenceLine: "Causante: {{deceasedName}} - DNI {{deceasedDni}} - Fallecimiento: {{deathDate}}",
    fields: [
      ...COMMON_HEADER_FIELDS,
      ...COMMON_DECEASED_FIELDS,
      { key: "relationship", label: "Tu parentesco con el causante", type: "select", required: true, options: ["Hijo/a", "Conyuge", "Padre/Madre", "Hermano/a", "Albacea", "Representante legal", "Otro"] },
      { key: "ccaaOffice", label: "Oficina liquidadora competente", type: "text", required: true, placeholder: "Direccion General de Tributos de la Comunidad de Madrid" },
      { key: "motivo", label: "Motivo de la solicitud (breve)", type: "textarea", required: true, placeholder: "Pendiente de obtener tasaciones de los inmuebles incluidos en el caudal hereditario y certificados de saldos definitivos." },
    ],
    body: `Al amparo de los articulos 67 y 68 del Reglamento del Impuesto sobre Sucesiones y Donaciones (RD 1629/1991), formulo la presente SOLICITUD DE PRORROGA del plazo de presentacion de la autoliquidacion (Modelo 650) correspondiente a la herencia del causante D./D.ª {{deceasedName}}, con DNI {{deceasedDni}}, fallecido/a el {{deathDate}}.

EXPONGO:

PRIMERO. Que en mi condicion de {{relationship}} del causante, soy sujeto pasivo del Impuesto sobre Sucesiones por la transmision mortis causa derivada del fallecimiento.

SEGUNDO. Que el plazo ordinario de presentacion de la autoliquidacion vence a los seis meses contados desde la fecha del fallecimiento.

TERCERO. Que existen circunstancias justificadas que impiden la presentacion en plazo ordinario, en concreto:

{{motivo}}

CUARTO. Que la presente solicitud se formula dentro de los cinco primeros meses desde el fallecimiento, conforme exige el art. 68 del Reglamento.

QUINTO. Tengo conocimiento de que la concesion de la prorroga implica el devengo de intereses de demora desde el final del plazo ordinario, sin perjuicio del propio aplazamiento del plazo de presentacion.

SOLICITO:

Que se tenga por presentada esta solicitud y, previos los tramites oportunos, se acuerde la PRORROGA DE SEIS MESES ADICIONALES del plazo de presentacion de la autoliquidacion del Impuesto sobre Sucesiones de la herencia del causante referenciado.

Quedo a su disposicion para aportar la documentacion complementaria que requieran. La notificacion de la resolucion puede dirigirse a:

  {{remitenteName}} - {{remitenteDni}}
  {{remitenteAddress}}
  Email: {{remitenteEmail}}
  Telefono: {{remitentePhone}}`,
    footer: "Esta solicitud debe presentarse antes del transcurso del quinto mes desde el fallecimiento; pasado ese plazo no es posible obtener la prorroga.",
  },

  {
    slug: "carta-aseguradora-siniestro",
    title: "Carta a la aseguradora declarando siniestro y reclamando capital",
    description: "Modelo para comunicar el siniestro a una aseguradora y solicitar el pago del capital del seguro de vida o de decesos.",
    destinatario: "Compañia aseguradora",
    category: "aseguradora",
    documentTitle: "DECLARACION DE SINIESTRO Y SOLICITUD DE PAGO DEL CAPITAL ASEGURADO",
    referenceLine: "Poliza nº {{polizaNumber}} - Asegurado/a {{deceasedName}}",
    fields: [
      ...COMMON_HEADER_FIELDS,
      ...COMMON_DECEASED_FIELDS,
      { key: "relationship", label: "Tu condicion (beneficiario / heredero)", type: "select", required: true, options: ["Beneficiario designado en poliza", "Heredero/a", "Albacea", "Representante legal"] },
      { key: "aseguradoraName", label: "Nombre de la aseguradora", type: "text", required: true, placeholder: "Mapfre Vida S.A." },
      { key: "polizaNumber", label: "Numero de poliza", type: "text", required: true, placeholder: "VIDA-2020-0012345" },
      { key: "polizaTipo", label: "Tipo de seguro", type: "select", required: true, options: ["Seguro de vida", "Seguro de decesos", "Accidentes", "Otro"] },
      { key: "deathCause", label: "Causa del fallecimiento (segun certificado medico)", type: "text", placeholder: "Causa natural / accidente / enfermedad" },
    ],
    body: `Estimados/as señores/as:

Por la presente, en mi condicion de {{relationship}} de D./D.ª {{deceasedName}}, asegurado/a en la poliza numero {{polizaNumber}} ({{polizaTipo}}) suscrita en esa entidad, comunico el SINIESTRO y SOLICITO el pago del capital asegurado.

DATOS DEL ASEGURADO:
  Nombre: {{deceasedName}}
  DNI: {{deceasedDni}}
  Fecha de fallecimiento: {{deathDate}}
  Causa: {{deathCause}}

DATOS DEL SOLICITANTE:
  Nombre: {{remitenteName}}
  DNI: {{remitenteDni}}
  Domicilio: {{remitenteAddress}}
  Email: {{remitenteEmail}}
  Telefono: {{remitentePhone}}
  Condicion: {{relationship}}

Adjunto la siguiente documentacion para acreditar el siniestro y mi condicion:

  - Certificado literal de defuncion expedido por el Registro Civil
  - Certificado medico de defuncion (causa de la muerte)
  - DNI/NIE del solicitante
  - Certificado de ultimas voluntades y, en su caso, copia simple del testamento o declaracion de herederos
  - Certificado del Registro de Contratos de Seguro de Vida (RCSV)
  - Numero de cuenta bancaria donde se desea recibir la indemnizacion: [INDICAR IBAN]

Conforme al articulo 18 de la Ley 50/1980 de Contrato de Seguro, la aseguradora dispone de un plazo de cuarenta dias naturales desde la recepcion de toda la documentacion necesaria para efectuar el pago del capital, salvo controversia justificada.

Quedo a su disposicion para aportar cualquier documentacion adicional que estimen necesaria. Solicito acuse de recibo de la presente y plazo estimado de resolucion.

Agradeciendo de antemano su colaboracion, le saluda atentamente,`,
    footer: "Importante: el pago del capital se debe realizar dentro de 40 dias naturales desde la entrega de la documentacion completa (art. 18 LCS). Pasado ese plazo, la aseguradora debe abonar intereses de demora.",
  },

  {
    slug: "comunicacion-comunidad-propietarios",
    title: "Comunicación al administrador de la comunidad de propietarios",
    description: "Modelo para comunicar el fallecimiento del titular y el cambio futuro de titularidad a la comunidad de propietarios.",
    destinatario: "Administrador de fincas / presidente de la comunidad",
    category: "comunidad",
    documentTitle: "COMUNICACION DE FALLECIMIENTO DEL PROPIETARIO Y CAMBIO DE TITULARIDAD",
    referenceLine: "Vivienda: {{viviendaAddress}} - {{deceasedName}}",
    fields: [
      ...COMMON_HEADER_FIELDS,
      ...COMMON_DECEASED_FIELDS,
      { key: "relationship", label: "Tu parentesco con el causante", type: "select", required: true, options: ["Hijo/a", "Conyuge", "Padre/Madre", "Hermano/a", "Albacea", "Representante legal", "Otro"] },
      { key: "viviendaAddress", label: "Direccion de la vivienda en la comunidad", type: "text", required: true, placeholder: "C/ Mayor 1, Esc 2, 3ºB - 28001 Madrid" },
      { key: "comunidadNombre", label: "Nombre / referencia de la comunidad", type: "text", placeholder: "Comunidad de Propietarios C/ Mayor 1" },
    ],
    body: `Estimados/as señores/as:

Por la presente, en mi condicion de {{relationship}} de D./D.ª {{deceasedName}}, propietario/a del inmueble sito en {{viviendaAddress}}, comunico formalmente el FALLECIMIENTO del titular y los proximos pasos respecto a la titularidad y obligaciones derivadas.

DATOS DEL CAUSANTE:
  Nombre: {{deceasedName}}
  DNI: {{deceasedDni}}
  Fecha de fallecimiento: {{deathDate}}
  Vivienda: {{viviendaAddress}}

INFORMACION COMUNICADA:

PRIMERO. El causante figura como titular del inmueble referenciado y, por tanto, como copropietario en la Comunidad. Su fallecimiento determina la apertura del proceso sucesorio para el cambio de titularidad.

SEGUNDO. Mientras se complete el proceso de aceptacion y particion de la herencia ante notario, las obligaciones de la propiedad (cuotas ordinarias, derramas, comunicaciones, asistencia a juntas) seran atendidas por los herederos en regimen de comunidad hereditaria.

TERCERO. Solicito que las comunicaciones de la Comunidad se dirijan, hasta nueva orden, a la siguiente direccion:

  {{remitenteName}} - {{remitenteDni}}
  {{remitenteAddress}}
  Email: {{remitenteEmail}}
  Telefono: {{remitentePhone}}

CUARTO. Una vez se inscriba la escritura de aceptacion y particion en el Registro de la Propiedad, se comunicara el nuevo titular para actualizar el censo de propietarios de la Comunidad.

QUINTO. En tanto se completa este proceso, los gastos pendientes y futuros se atenderan puntualmente por los herederos. Solicito recibir el detalle de cuotas pendientes a fecha del fallecimiento, asi como las cuotas devengadas desde dicha fecha.

Agradeciendo de antemano su atencion, quedo a su disposicion para cualquier aclaracion.

Atentamente,`,
    footer: "Documentacion adjunta sugerida: copia del certificado literal de defuncion y DNI del comunicante.",
  },

  {
    slug: "carta-suministros-cambio-titular",
    title: "Carta a compañia de suministros (luz / gas / agua) por mortis causa",
    description: "Modelo para solicitar el cambio de titularidad o la baja de un suministro tras el fallecimiento del titular.",
    destinatario: "Compañia comercializadora de luz, gas o agua",
    category: "otros",
    documentTitle: "SOLICITUD DE CAMBIO DE TITULARIDAD POR MORTIS CAUSA / BAJA DE SUMINISTRO",
    referenceLine: "Suministro a nombre de {{deceasedName}} - {{servicioTipo}}",
    fields: [
      ...COMMON_HEADER_FIELDS,
      ...COMMON_DECEASED_FIELDS,
      { key: "relationship", label: "Tu parentesco con el causante", type: "select", required: true, options: ["Hijo/a", "Conyuge", "Padre/Madre", "Hermano/a", "Heredero", "Otro"] },
      { key: "comercializadoraName", label: "Nombre de la comercializadora", type: "text", required: true, placeholder: "Iberdrola Clientes S.A.U." },
      { key: "servicioTipo", label: "Tipo de servicio", type: "select", required: true, options: ["Electricidad", "Gas natural", "Agua", "Telefono fijo", "Internet"] },
      { key: "cupsPolizaNum", label: "CUPS / numero de poliza / referencia", type: "text", required: true, placeholder: "ES0021000000000000XX" },
      { key: "supplyAddress", label: "Direccion del suministro", type: "text", required: true, placeholder: "C/ Mayor 1, 3ºB - 28001 Madrid" },
      { key: "accion", label: "Accion solicitada", type: "select", required: true, options: ["Cambio de titularidad a mi nombre", "Baja del suministro", "Cambio temporal hasta cierre de herencia"] },
    ],
    body: `Estimados/as señores/as:

Por la presente, en mi condicion de {{relationship}} de D./D.ª {{deceasedName}}, fallecido/a el {{deathDate}}, comunico el fallecimiento del titular del suministro de {{servicioTipo}} contratado en esa entidad y SOLICITO la siguiente actuacion:

  ACCION: {{accion}}

DATOS DEL SUMINISTRO:
  Tipo: {{servicioTipo}}
  Comercializadora: {{comercializadoraName}}
  CUPS / poliza: {{cupsPolizaNum}}
  Direccion del suministro: {{supplyAddress}}
  Titular fallecido: {{deceasedName}} (DNI {{deceasedDni}})

DATOS DEL SOLICITANTE:
  Nombre: {{remitenteName}}
  DNI: {{remitenteDni}}
  Domicilio: {{remitenteAddress}}
  Email: {{remitenteEmail}}
  Telefono: {{remitentePhone}}

Adjunto la siguiente documentacion:

  - Certificado literal de defuncion del titular
  - DNI/NIE del solicitante
  - Acreditacion del parentesco / condicion de heredero (libro de familia, declaracion de herederos)
  - Ultimo recibo del suministro (referencia para localizar el contrato)
  - En caso de cambio de titularidad, datos bancarios para domiciliacion del nuevo recibo: [INDICAR IBAN]

Solicito que el cambio se realice sin penalizacion por permanencia, conforme al regimen de mortis causa. Quedo a su disposicion para aportar cualquier documentacion adicional. Agradeceria confirmacion del cambio efectuado y fecha de efectividad.

Atentamente,`,
    footer: "El cambio de titularidad por mortis causa es gratuito en la mayoria de comercializadoras y no implica perdida del periodo de permanencia o promociones del causante.",
  },

  {
    slug: "solicitud-tasacion-inmueble",
    title: "Solicitud de tasación de inmueble heredado para el ISD",
    description: "Modelo para solicitar a una sociedad de tasacion homologada la valoracion de un inmueble incluido en el caudal hereditario.",
    destinatario: "Sociedad de tasacion homologada",
    category: "otros",
    documentTitle: "SOLICITUD DE TASACION DE INMUEBLE A EFECTOS DEL IMPUESTO SOBRE SUCESIONES",
    referenceLine: "Inmueble: {{inmuebleAddress}} - Causante: {{deceasedName}}",
    fields: [
      ...COMMON_HEADER_FIELDS,
      ...COMMON_DECEASED_FIELDS,
      { key: "relationship", label: "Tu parentesco con el causante", type: "select", required: true, options: ["Hijo/a", "Conyuge", "Padre/Madre", "Hermano/a", "Heredero", "Albacea", "Otro"] },
      { key: "tasadoraName", label: "Sociedad de tasacion", type: "text", required: true, placeholder: "Tinsa, Tecnitasa, Sociedad de Tasacion S.A., etc." },
      { key: "inmuebleAddress", label: "Direccion completa del inmueble", type: "text", required: true, placeholder: "C/ Mayor 1, 3ºB - 28001 Madrid" },
      { key: "refCatastral", label: "Referencia catastral", type: "text", placeholder: "9872023VH5797S0001WX" },
      { key: "tipoInmueble", label: "Tipo de inmueble", type: "select", required: true, options: ["Vivienda", "Local comercial", "Garaje", "Trastero", "Suelo / parcela", "Otro"] },
      { key: "purposeNote", label: "Finalidad adicional (opcional)", type: "text", placeholder: "Aceptacion de herencia y partition" },
    ],
    body: `Estimados/as señores/as:

Por la presente, en mi condicion de {{relationship}} de D./D.ª {{deceasedName}}, fallecido/a el {{deathDate}}, SOLICITO la valoracion homologada del inmueble que se identifica a continuacion, a efectos de su declaracion en el Impuesto sobre Sucesiones (Modelo 650) y eventual aceptacion y particion de la herencia.

DATOS DEL INMUEBLE:
  Direccion: {{inmuebleAddress}}
  Tipo: {{tipoInmueble}}
  Referencia catastral: {{refCatastral}}
  Titular registral: {{deceasedName}} - DNI {{deceasedDni}}
  Fecha de fallecimiento del titular: {{deathDate}}

FINALIDAD DE LA TASACION:

  - Determinacion del valor real del inmueble a la fecha del devengo del impuesto.
  - Comparacion con el Valor de Referencia del Catastro (Ley 11/2021).
  - Soporte tecnico para la autoliquidacion del Impuesto sobre Sucesiones.
  - {{purposeNote}}

REQUERIMIENTOS:

  - Tasacion realizada conforme a la Orden ECO/805/2003 y demas normativa aplicable.
  - Informe firmado por arquitecto o tecnico competente colegiado.
  - Comparables de mercado a fecha del devengo (fecha del fallecimiento).
  - Plazo estimado de entrega y presupuesto.

DATOS DEL SOLICITANTE:
  Nombre: {{remitenteName}}
  DNI: {{remitenteDni}}
  Domicilio: {{remitenteAddress}}
  Email: {{remitenteEmail}}
  Telefono: {{remitentePhone}}

Quedo a la espera de su presupuesto y disponibilidad para coordinar la visita al inmueble. Para entregas de documentacion o aclaraciones, pueden dirigirse a los datos de contacto anteriores.

Agradeciendo de antemano su atencion, le saluda atentamente,`,
    footer: "Recomendable obtener tasacion oficial cuando el Valor de Referencia del Catastro pueda ser superior al de mercado, para soportar una declaracion del valor real inferior y evitar regularizaciones por parte de Hacienda.",
  },
];

export function getTemplateBySlug(slug: string): DocumentTemplate | null {
  return DOCUMENT_TEMPLATES.find((t) => t.slug === slug) ?? null;
}

export const ALL_TEMPLATE_SLUGS = DOCUMENT_TEMPLATES.map((t) => t.slug);

/**
 * Renders body and reference line by substituting {{key}} with values.
 * Missing keys are replaced with [PENDIENTE: key].
 */
export function renderTemplate(template: DocumentTemplate, values: Record<string, string>): {
  documentTitle: string;
  referenceLine: string | null;
  body: string;
  footer: string | null;
} {
  const body = substitute(template.body, values);
  const referenceLine = template.referenceLine ? substitute(template.referenceLine, values) : null;
  return {
    documentTitle: template.documentTitle,
    referenceLine,
    body,
    footer: template.footer ?? null,
  };
}

function substitute(str: string, values: Record<string, string>): string {
  return str.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const v = values[key];
    if (v == null || v === "") return `[PENDIENTE: ${key}]`;
    return v;
  });
}
