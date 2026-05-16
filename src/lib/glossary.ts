/**
 * Glosario de terminos del Impuesto sobre Sucesiones y Donaciones.
 *
 * Cada termino es una pagina SEO dedicada (/glosario/[slug]) que ranquea
 * para queries como "que es base imponible ISD", "coeficiente multiplicador
 * herencia", "ajuar domestico Hacienda".
 *
 * Estructura:
 *   - definition: parrafo principal (2-3 lineas)
 *   - longExplanation: cuerpo extenso con ejemplos y casuistica
 *   - category: para agrupar en el index
 *   - relatedTerms: cross-linking a otros terminos
 *   - relatedTools: links a calculadora, borrador, etc.
 *   - normRef: art./ley relevante para SEO juridico
 */

export type GlossaryCategory =
  | "Base imponible"
  | "Cuota y calculo"
  | "Plazos y procedimiento"
  | "Sujetos"
  | "Bonificaciones y reducciones"
  | "Bienes y caudal"
  | "Documentacion";

export interface GlossaryTerm {
  slug: string;
  term: string;
  /** Definición corta (1-2 frases) para mostrar en cards e index */
  definition: string;
  /** Cuerpo extenso para la pagina /glosario/[slug] */
  longExplanation: string[];
  category: GlossaryCategory;
  /** Slugs de otros terminos relacionados */
  relatedTerms: string[];
  /** Links a herramientas del sitio */
  relatedTools: { label: string; href: string }[];
  /** Referencia normativa: "Art. 20 Ley 29/1987" */
  normRef?: string;
  /** Sinónimos / variantes de búsqueda */
  synonyms?: string[];
}

export const GLOSSARY: GlossaryTerm[] = [
  {
    slug: "base-imponible",
    term: "Base imponible",
    category: "Base imponible",
    definition: "Es el valor de los bienes y derechos que se transmiten en una herencia o donación, antes de aplicar reducciones y bonificaciones.",
    longExplanation: [
      "En el Impuesto sobre Sucesiones y Donaciones, la base imponible representa el valor patrimonial bruto que recibe cada heredero o donatario.",
      "Para sucesiones (Modelo 650), la base imponible se calcula sumando el valor de todos los bienes y derechos del caudal hereditario (inmuebles, cuentas bancarias, vehículos, valores, ajuar) y restando las cargas y deudas deducibles del causante.",
      "Cada heredero declara su parte alícuota como base imponible individual. La cuota se calcula sobre la base liquidable (base imponible menos reducciones del art. 20).",
    ],
    relatedTerms: ["base-liquidable", "caudal-hereditario", "ajuar-domestico", "reducciones-art-20"],
    relatedTools: [
      { label: "Calculadora ISD", href: "/calculadora-isd" },
      { label: "Borrador Modelo 650 PDF", href: "/borrador-modelo650" },
    ],
    normRef: "Art. 9 Ley 29/1987",
    synonyms: ["base imponible ISD", "base imponible sucesiones"],
  },
  {
    slug: "base-liquidable",
    term: "Base liquidable",
    category: "Base imponible",
    definition: "Resultado de restar las reducciones del art. 20 a la base imponible. Es el importe sobre el que se aplica la tarifa estatal.",
    longExplanation: [
      "La base liquidable se obtiene tras minorar la base imponible con las reducciones aplicables: parentesco, vivienda habitual, empresa familiar, seguros de vida, discapacidad.",
      "Si la base imponible es 200.000 € y aplican reducciones por 15.957 € (parentesco grupo II), la base liquidable es 184.043 €.",
      "Sobre la base liquidable se aplica la tarifa progresiva del 7,65% al 34% (art. 21) para obtener la cuota íntegra.",
    ],
    relatedTerms: ["base-imponible", "tarifa-estatal", "reducciones-art-20", "cuota-integra"],
    relatedTools: [{ label: "Calculadora ISD", href: "/calculadora-isd" }],
    normRef: "Art. 20 Ley 29/1987",
  },
  {
    slug: "cuota-integra",
    term: "Cuota íntegra",
    category: "Cuota y calculo",
    definition: "Resultado de aplicar la tarifa progresiva del Impuesto a la base liquidable.",
    longExplanation: [
      "La cuota íntegra es el impuesto antes del coeficiente multiplicador y antes de la bonificación autonómica.",
      "Se obtiene aplicando la tarifa del art. 21 a la base liquidable. La tarifa estatal es progresiva por tramos: 7,65% en el primer tramo, hasta 34% por encima de 797.555 €.",
      "Para una base liquidable de 100.000 € la cuota íntegra estatal es aproximadamente 9.166 €.",
    ],
    relatedTerms: ["tarifa-estatal", "cuota-tributaria", "coeficiente-multiplicador"],
    relatedTools: [{ label: "Calculadora ISD", href: "/calculadora-isd" }],
    normRef: "Art. 21 Ley 29/1987",
  },
  {
    slug: "cuota-tributaria",
    term: "Cuota tributaria",
    category: "Cuota y calculo",
    definition: "Cuota íntegra multiplicada por el coeficiente del art. 22 (parentesco × patrimonio preexistente).",
    longExplanation: [
      "La cuota tributaria es la cuota íntegra multiplicada por el coeficiente del art. 22 de la Ley 29/1987.",
      "El coeficiente depende del grupo de parentesco del heredero y de su patrimonio preexistente. Va de 1,0 (grupo I/II sin patrimonio) hasta 2,4 (grupo IV con patrimonio muy alto).",
      "Sobre la cuota tributaria se aplica la bonificación autonómica para obtener la cuota a pagar.",
    ],
    relatedTerms: ["cuota-integra", "coeficiente-multiplicador", "bonificacion-autonomica"],
    relatedTools: [{ label: "Calculadora ISD", href: "/calculadora-isd" }],
    normRef: "Art. 22 Ley 29/1987",
  },
  {
    slug: "coeficiente-multiplicador",
    term: "Coeficiente multiplicador",
    category: "Cuota y calculo",
    definition: "Factor que multiplica la cuota íntegra según el grupo de parentesco y el patrimonio preexistente del heredero.",
    longExplanation: [
      "Establecido en el art. 22 de la Ley 29/1987. Aplica al heredero o donatario, no al causante.",
      "Para grupos I y II (descendientes, cónyuge, ascendientes) parte de 1,0 y sube hasta 1,2 con patrimonio alto.",
      "Para grupo III (hermanos, sobrinos, tíos) parte de 1,5882 y llega a 1,9059.",
      "Para grupo IV (sin parentesco) parte de 2,0 y llega a 2,4 — duplica la cuota sin más.",
      "El coeficiente es la principal fuente de diferencias fiscales entre grupos: un hermano paga aproximadamente 60% más que un hijo por la misma herencia.",
    ],
    relatedTerms: ["grupo-parentesco", "patrimonio-preexistente", "cuota-tributaria"],
    relatedTools: [{ label: "Calculadora ISD con coeficiente real", href: "/calculadora-isd" }],
    normRef: "Art. 22 Ley 29/1987",
  },
  {
    slug: "tarifa-estatal",
    term: "Tarifa estatal",
    category: "Cuota y calculo",
    definition: "Escala progresiva del 7,65% al 34% que se aplica a la base liquidable del ISD.",
    longExplanation: [
      "La tarifa estatal del art. 21 es subsidiaria: aplica salvo que la CCAA tenga su propia tarifa (Cataluña y Asturias tienen escalas propias diferentes).",
      "Tramos principales: hasta 7.993 € al 7,65%; de 7.993 a 31.956 € entre 8,5% y 11,9%; de 31.956 a 79.880 € entre 13,6% y 17%; de 79.880 a 239.389 € entre 18,7% y 25,5%; más de 797.555 € al 34%.",
      "Es una tarifa marginal por tramos, no proporcional. La cuota se calcula sumando lo que paga cada tramo.",
    ],
    relatedTerms: ["base-liquidable", "cuota-integra", "tramos-isd"],
    relatedTools: [
      { label: "Calculadora ISD", href: "/calculadora-isd" },
      { label: "Comparador 17 CCAA", href: "/comparador-isd" },
    ],
    normRef: "Art. 21 Ley 29/1987",
  },
  {
    slug: "bonificacion-autonomica",
    term: "Bonificación autonómica",
    category: "Bonificaciones y reducciones",
    definition: "Porcentaje de reducción sobre la cuota tributaria que aplica cada CCAA, va del 0% al 100% según comunidad y grupo de parentesco.",
    longExplanation: [
      "Es la palanca fiscal más importante: una misma herencia puede tributar 100 € o 50.000 € según la CCAA del causante.",
      "Madrid, Andalucía, Galicia, Murcia, Castilla y León, Extremadura, La Rioja, Canarias y Valencia bonifican el 99% para grupos I y II. Baleares y Cantabria llegan al 100% en algunos tramos.",
      "Cataluña aplica un sistema progresivo: 99% hasta 100.000 €, 97% hasta 200.000 €, 90% hasta 500.000 €, 70% hasta 1M €.",
      "Asturias prácticamente no bonifica (tiene tarifa propia más progresiva). Aragón bonifica al 65% hasta 100.000 €.",
      "Navarra y País Vasco son régimen foral propio.",
    ],
    relatedTerms: ["regimen-foral", "ccaa-competente", "cuota-tributaria"],
    relatedTools: [
      { label: "Comparador 17 CCAA", href: "/comparador-isd" },
      { label: "Calculadora ISD", href: "/calculadora-isd" },
    ],
  },
  {
    slug: "reducciones-art-20",
    term: "Reducciones del art. 20",
    category: "Bonificaciones y reducciones",
    definition: "Conjunto de reducciones que se aplican a la base imponible antes de calcular la cuota. Incluyen parentesco, vivienda habitual, seguros de vida y empresa familiar.",
    longExplanation: [
      "Las reducciones se aplican a la base imponible (no a la cuota) y son acumulables entre sí.",
      "Por parentesco: 47.858 € (grupo I + 3.990 por año <21), 15.957 € (grupo II), 7.993 € (grupo III), 0 € (grupo IV).",
      "Vivienda habitual del causante: 95% del valor con tope de 122.606 € por heredero. Requiere mantenimiento 10 años.",
      "Empresa familiar y participaciones: 95% del valor si se cumplen requisitos del art. 20.6 (titularidad, ejercicio, mantenimiento).",
      "Seguros de vida: 9.195 € por beneficiario, grupos I y II.",
      "Discapacidad del heredero: 47.858 € (33-65%) o 150.253 € (≥65%).",
    ],
    relatedTerms: ["base-imponible", "base-liquidable", "vivienda-habitual", "empresa-familiar"],
    relatedTools: [{ label: "Calculadora con todas las reducciones", href: "/calculadora-isd" }],
    normRef: "Art. 20 Ley 29/1987",
  },
  {
    slug: "vivienda-habitual",
    term: "Vivienda habitual (reducción)",
    category: "Bonificaciones y reducciones",
    definition: "Reducción del 95% sobre el valor de la vivienda habitual del causante hasta un tope de 122.606,47 € por heredero.",
    longExplanation: [
      "Para que aplique: el causante debe haber residido habitualmente en esa vivienda, y el heredero debe mantenerla en propiedad durante 10 años.",
      "La reducción se aplica al heredero cónyuge, descendientes o ascendientes que adquieran la vivienda.",
      "Tope individual: 122.606,47 €. Si la vivienda vale más, sólo se reduce hasta ese tope por heredero.",
      "Si varios herederos reciben la vivienda, cada uno aplica su tope individual.",
      "Algunas CCAA (Galicia, Asturias) tienen reducciones autonómicas adicionales sobre vivienda habitual.",
    ],
    relatedTerms: ["reducciones-art-20", "valor-referencia", "caudal-hereditario"],
    relatedTools: [{ label: "Calculadora ISD con vivienda habitual", href: "/calculadora-isd" }],
    normRef: "Art. 20.2.c.3 Ley 29/1987",
  },
  {
    slug: "empresa-familiar",
    term: "Empresa familiar",
    category: "Bonificaciones y reducciones",
    definition: "Reducción del 95% sobre el valor de la empresa familiar o participaciones cuando el heredero las mantiene durante 10 años.",
    longExplanation: [
      "Para aplicar: el causante debía ejercer la actividad de forma habitual, personal y directa, y obtener de ella más del 50% de su renta total.",
      "Si son participaciones sociales: el grupo familiar debe tener más del 20% (individualmente 5%), y uno de los miembros debe ejercer funciones de dirección con remuneración mayoritaria.",
      "El heredero debe mantener la titularidad durante 10 años desde la fecha del fallecimiento. Si vende antes, debe regularizar.",
      "Es una de las reducciones más significativas (puede salvar millones de euros), pero también la más auditada por Hacienda.",
    ],
    relatedTerms: ["reducciones-art-20", "donacion-empresa-familiar"],
    relatedTools: [],
    normRef: "Art. 20.2.c Ley 29/1987",
  },
  {
    slug: "ajuar-domestico",
    term: "Ajuar doméstico",
    category: "Bienes y caudal",
    definition: "Conjunto de bienes muebles del hogar del causante. Se valora al 3% del caudal hereditario salvo prueba en contrario.",
    longExplanation: [
      "Comprende muebles, electrodomésticos, ropa, vajilla y demás efectos personales del causante.",
      "Por defecto se cuantifica al 3% del caudal hereditario bruto (sin restar deudas).",
      "El heredero puede declarar un valor inferior si lo prueba: tasación pericial, valoración de un perito tasador, justificantes de venta posterior.",
      "El Tribunal Supremo (sentencia de 2020) limitó la base de cálculo del 3% al excluir bienes que no formen parte del ajuar (cuentas, valores, vehículos, etc.).",
    ],
    relatedTerms: ["caudal-hereditario", "base-imponible"],
    relatedTools: [],
    normRef: "Art. 15 Ley 29/1987",
  },
  {
    slug: "caudal-hereditario",
    term: "Caudal hereditario",
    category: "Bienes y caudal",
    definition: "Conjunto de bienes y derechos del causante en el momento del fallecimiento, antes del reparto entre herederos.",
    longExplanation: [
      "Incluye: inmuebles, cuentas bancarias, valores, vehículos, joyas, ajuar doméstico, derechos económicos, seguros de vida.",
      "Se valoran a su valor real a fecha de fallecimiento. Los inmuebles, al Valor de Referencia del Catastro o al de mercado si es superior.",
      "Del caudal bruto se restan las cargas y deudas deducibles del art. 13 para obtener el caudal neto.",
      "El caudal neto se reparte entre los herederos según el testamento o, en su defecto, la declaración de herederos.",
    ],
    relatedTerms: ["base-imponible", "ajuar-domestico", "valor-referencia", "deudas-deducibles"],
    relatedTools: [{ label: "Calculadora ISD", href: "/calculadora-isd" }],
  },
  {
    slug: "valor-referencia",
    term: "Valor de Referencia del Catastro",
    category: "Bienes y caudal",
    definition: "Valor que la DG del Catastro asigna a cada inmueble, base mínima para tributar en ISD desde 2022.",
    longExplanation: [
      "Introducido por la Ley 11/2021 anti-fraude. Desde el 1 de enero de 2022 es la base mínima para tributar en ITP, ISD y AJD.",
      "Si el inmueble heredado se declara por un valor inferior al de Referencia, Hacienda regulariza al alza.",
      "Se consulta gratuitamente en sede.catastro.gob.es con la referencia catastral del inmueble.",
      "Es impugnable: si está claramente por encima del valor de mercado (zona degradada, vicios ocultos), se puede solicitar rectificación de la autoliquidación o tasación pericial contradictoria.",
    ],
    relatedTerms: ["caudal-hereditario", "vivienda-habitual"],
    relatedTools: [
      { label: "Solicitar tasación inmueble (plantilla)", href: "/plantillas-documentos" },
    ],
    normRef: "Ley 11/2021",
  },
  {
    slug: "deudas-deducibles",
    term: "Deudas deducibles",
    category: "Bienes y caudal",
    definition: "Deudas y gastos del causante que minoran la base imponible del ISD.",
    longExplanation: [
      "Deudas del causante acreditadas documentalmente: hipotecas pendientes, préstamos personales, deudas fiscales.",
      "Gastos del último internamiento, sepelio y funeral (con factura).",
      "Gastos del juicio en interés común si los herederos litigan sobre la herencia.",
      "Determinadas deudas con la Seguridad Social del causante.",
      "Importante: las deudas tributarias del causante por IRPF, IBI, etc. devengadas antes del fallecimiento son deducibles.",
    ],
    relatedTerms: ["base-imponible", "caudal-hereditario"],
    relatedTools: [],
    normRef: "Art. 13 Ley 29/1987",
  },
  {
    slug: "grupo-parentesco",
    term: "Grupo de parentesco",
    category: "Sujetos",
    definition: "Clasificación de los herederos en 4 grupos (I-IV) según su grado de parentesco con el causante. Determina reducciones, coeficiente y bonificación.",
    longExplanation: [
      "Grupo I: descendientes y adoptados menores de 21 años. Reducción base 47.858 € (+3.990 por año <21).",
      "Grupo II: descendientes ≥21, cónyuge y ascendientes. Reducción base 15.957 €.",
      "Grupo III: colaterales de 2º y 3er grado (hermanos, sobrinos, tíos), ascendientes y descendientes por afinidad. Reducción base 7.993 €.",
      "Grupo IV: colaterales de 4º grado, parientes lejanos y extraños. Sin reducción base.",
      "El grupo determina también el coeficiente multiplicador y, en la mayoría de CCAA, la bonificación aplicable.",
    ],
    relatedTerms: ["coeficiente-multiplicador", "reducciones-art-20", "patrimonio-preexistente"],
    relatedTools: [{ label: "Calculadora ISD con grupo", href: "/calculadora-isd" }],
    normRef: "Art. 20.2.a Ley 29/1987",
  },
  {
    slug: "patrimonio-preexistente",
    term: "Patrimonio preexistente",
    category: "Sujetos",
    definition: "Patrimonio del heredero a la fecha de devengo. Junto al grupo de parentesco determina el coeficiente multiplicador.",
    longExplanation: [
      "Es el patrimonio neto del heredero (activos menos pasivos) a la fecha del fallecimiento del causante.",
      "Cuatro tramos: hasta 402.678 € (coef. más bajo), de 402.678 a 2.007.380 €, de 2.007.380 a 4.020.770 €, y más de 4.020.770 € (coef. más alto).",
      "A mayor patrimonio del heredero, mayor coeficiente y por tanto mayor cuota a pagar — el legislador penaliza la concentración de patrimonio.",
      "Se acredita con la última declaración del Impuesto sobre el Patrimonio o, en su defecto, valoración indicativa.",
    ],
    relatedTerms: ["coeficiente-multiplicador", "grupo-parentesco"],
    relatedTools: [{ label: "Calculadora con patrimonio preexistente", href: "/calculadora-isd" }],
    normRef: "Art. 22 Ley 29/1987",
  },
  {
    slug: "ccaa-competente",
    term: "CCAA competente",
    category: "Sujetos",
    definition: "Comunidad Autónoma donde se presenta el Modelo 650. Para sucesiones es la de la residencia habitual del causante.",
    longExplanation: [
      "Para sucesiones: la CCAA donde el causante hubiese tenido su residencia habitual durante el mayor número de días del periodo de los 5 años anteriores al fallecimiento.",
      "Para donaciones de bienes muebles: la CCAA de la residencia habitual del donatario.",
      "Para donaciones de inmuebles: la CCAA donde se ubica el inmueble.",
      "La CCAA competente determina la normativa aplicable (bonificaciones y reducciones autonómicas) y la oficina liquidadora ante la que se presenta el modelo.",
    ],
    relatedTerms: ["bonificacion-autonomica", "regimen-foral"],
    relatedTools: [
      { label: "Comparador 17 CCAA", href: "/comparador-isd" },
      { label: "Calculadora ISD", href: "/calculadora-isd" },
    ],
  },
  {
    slug: "regimen-foral",
    term: "Régimen foral",
    category: "Sujetos",
    definition: "Sistema fiscal propio de Navarra y País Vasco. El ISD se tramita ante la Hacienda Foral con normativa propia, distinta de la estatal.",
    longExplanation: [
      "Navarra y las 3 Diputaciones Forales del País Vasco (Bizkaia, Gipuzkoa, Álava) tienen competencia normativa plena en ISD.",
      "Las tarifas y reducciones son distintas, generalmente más favorables para herederos directos.",
      "El Modelo 650 se presenta ante la Hacienda Foral, no ante la AEAT ni ante una agencia autonómica del régimen común.",
      "Para que aplique el régimen foral, el causante (sucesiones) o el donatario (donaciones de bienes muebles) debe tener su residencia habitual en territorio foral durante los 5 años anteriores.",
    ],
    relatedTerms: ["ccaa-competente", "bonificacion-autonomica"],
    relatedTools: [{ label: "Comparador CCAA con régimen foral", href: "/comparador-isd" }],
  },
  {
    slug: "modelo-650",
    term: "Modelo 650",
    category: "Documentacion",
    definition: "Autoliquidación del Impuesto sobre Sucesiones. Se presenta en 6 meses desde el fallecimiento ante la CCAA del causante.",
    longExplanation: [
      "Es el modelo oficial para liquidar el ISD por adquisiciones mortis causa (herencias).",
      "Plazo: 6 meses desde el fallecimiento, prorrogable a 12 si se solicita en los primeros 5 meses.",
      "Sujeto pasivo: cada heredero declara individualmente por su parte alícuota.",
      "Presentación telemática preferente en la sede electrónica de la CCAA competente.",
      "Acompaña a la presentación: certificado literal de defunción, certificado de últimas voluntades, RCSV, testamento o declaración de herederos, inventario detallado del caudal.",
    ],
    relatedTerms: ["modelo-651", "plazo-isd", "prorroga-isd"],
    relatedTools: [
      { label: "Borrador Modelo 650 en PDF", href: "/borrador-modelo650" },
      { label: "Calculadora ISD", href: "/calculadora-isd" },
    ],
  },
  {
    slug: "modelo-651",
    term: "Modelo 651",
    category: "Documentacion",
    definition: "Autoliquidación del Impuesto sobre Donaciones. Plazo de 30 días hábiles desde la fecha de la donación.",
    longExplanation: [
      "Modelo oficial para liquidar el ISD por adquisiciones inter vivos (donaciones).",
      "Plazo: 30 días hábiles desde la donación. No es prorrogable como el 650.",
      "Sujeto pasivo: el donatario (quien recibe), no el donante.",
      "CCAA competente: residencia del donatario para bienes muebles, ubicación del inmueble para donaciones de inmuebles.",
      "Reducciones específicas distintas a las del 650 (no hay reducción base por parentesco, sí hay reducciones específicas: vivienda habitual a hijo, empresa familiar, donación dineraria para vivienda).",
    ],
    relatedTerms: ["modelo-650", "donacion-empresa-familiar"],
    relatedTools: [
      { label: "Borrador Modelo 651 en PDF", href: "/borrador-modelo651" },
      { label: "Calculadora Donaciones", href: "/calculadora-donaciones" },
    ],
  },
  {
    slug: "modelo-660",
    term: "Modelo 660",
    category: "Documentacion",
    definition: "Declaración informativa colectiva de la sucesión. Se presenta junto al 650 cuando hay varios herederos.",
    longExplanation: [
      "Es el modelo de declaración informativa que recoge los datos comunes de la sucesión: inventario completo del caudal, identificación de todos los herederos, distribución de las adquisiciones.",
      "Se presenta una sola vez por la sucesión, mientras que el 650 lo presenta cada heredero individualmente.",
      "Suele facilitarlo la gestoría o asesor que tramita la herencia para evitar discrepancias entre las autoliquidaciones individuales.",
      "Su presentación es obligatoria en algunas CCAA y opcional en otras.",
    ],
    relatedTerms: ["modelo-650"],
    relatedTools: [],
  },
  {
    slug: "certificado-ultimas-voluntades",
    term: "Certificado de Últimas Voluntades",
    category: "Documentacion",
    definition: "Documento del Ministerio de Justicia que acredita si una persona otorgó testamento y, en su caso, ante qué notario.",
    longExplanation: [
      "Imprescindible para iniciar cualquier trámite hereditario: testamentaría, declaración de herederos abintestato, presentación del Modelo 650.",
      "Se solicita con el Modelo 790 código 006 tras un mínimo de 15 días hábiles desde el fallecimiento.",
      "Presentación: online en la sede del Ministerio de Justicia (recomendado, 3-7 días) o presencial en Gerencias Territoriales (2-4 semanas).",
      "Tasa aproximada: 4 € por certificado.",
    ],
    relatedTerms: ["rcsv", "modelo-650"],
    relatedTools: [],
  },
  {
    slug: "rcsv",
    term: "RCSV (Registro de Contratos de Seguros de Vida)",
    category: "Documentacion",
    definition: "Registro del Ministerio de Justicia que informa de los seguros de vida y accidentes con cobertura de fallecimiento contratados por el causante.",
    longExplanation: [
      "Permite descubrir todos los seguros de vida que el causante tenía contratados, incluso los que la familia desconoce.",
      "Se solicita con el Modelo 790 código 006 (mismo modelo que el de Últimas Voluntades) tras un mínimo de 15 días hábiles desde el fallecimiento.",
      "Una vez identificadas las pólizas, los beneficiarios contactan con cada aseguradora para reclamar el capital.",
      "Los seguros de vida tributan en ISD con reducción específica de 9.195 € por beneficiario (grupos I y II).",
    ],
    relatedTerms: ["certificado-ultimas-voluntades", "modelo-650", "seguros-vida-reduccion"],
    relatedTools: [
      { label: "Plantilla: carta a la aseguradora declarando siniestro", href: "/plantillas-documentos" },
    ],
  },
  {
    slug: "plazo-isd",
    term: "Plazo del Modelo 650 (6 meses)",
    category: "Plazos y procedimiento",
    definition: "Plazo legal para presentar la autoliquidación del Impuesto sobre Sucesiones: 6 meses desde la fecha del fallecimiento.",
    longExplanation: [
      "Plazo ordinario: 6 meses contados de fecha a fecha desde el día del fallecimiento. Si el último día es inhábil, pasa al siguiente día hábil.",
      "Si la documentación no estará lista, se puede solicitar una prórroga de 6 meses adicionales antes del transcurso del quinto mes.",
      "Presentación fuera de plazo: recargos del 5% al 20% según retraso (art. 27 LGT), más intereses de demora.",
      "Hacienda puede iniciar comprobación si no se presenta. En ese caso el recargo se eleva al 50%.",
    ],
    relatedTerms: ["modelo-650", "prorroga-isd", "recargo-modelo-650"],
    relatedTools: [{ label: "Borrador Modelo 650 con plazos", href: "/borrador-modelo650" }],
    normRef: "Art. 67 RD 1629/1991",
  },
  {
    slug: "prorroga-isd",
    term: "Prórroga del ISD",
    category: "Plazos y procedimiento",
    definition: "Solicitud de ampliar 6 meses adicionales el plazo de presentación del Modelo 650. Debe pedirse antes del quinto mes.",
    longExplanation: [
      "Permite ampliar el plazo de presentación del Modelo 650 hasta los 12 meses desde el fallecimiento.",
      "Requisitos: solicitarla antes del transcurso del quinto mes desde el fallecimiento, mediante escrito a la oficina liquidadora.",
      "No requiere justificar causa: cualquier motivo razonable (tasación pendiente, dificultad documental) es válido.",
      "Devenga intereses de demora desde el final del plazo ordinario, pero evita los recargos.",
      "Una vez transcurridos los 5 primeros meses, la prórroga ya no es solicitable: solo queda presentar fuera de plazo con recargo.",
    ],
    relatedTerms: ["plazo-isd", "modelo-650", "recargo-modelo-650"],
    relatedTools: [
      { label: "Plantilla de solicitud de prórroga", href: "/plantillas-documentos" },
    ],
    normRef: "Art. 68 RD 1629/1991",
  },
  {
    slug: "recargo-modelo-650",
    term: "Recargos por presentación fuera de plazo",
    category: "Plazos y procedimiento",
    definition: "Sanciones automáticas por presentar el Modelo 650 después del plazo legal: del 5% al 20% según retraso.",
    longExplanation: [
      "Establecidos en el art. 27 de la Ley General Tributaria.",
      "Hasta 3 meses tarde: 5%. De 3 a 6 meses: 10%. De 6 a 12 meses: 15%. Más de 12 meses: 20% más intereses de demora.",
      "Si Hacienda requiere antes de presentar: el recargo se eleva al 50% (sanción por infracción tributaria leve).",
      "Los recargos no son negociables, son automáticos al presentar fuera de plazo.",
      "Algunas CCAA pueden además denegar bonificaciones autonómicas si la presentación es tardía, convirtiendo una cuota de 0 € en una cuota completa.",
    ],
    relatedTerms: ["plazo-isd", "prorroga-isd", "modelo-650"],
    relatedTools: [],
    normRef: "Art. 27 LGT",
  },
  {
    slug: "plusvalia-municipal",
    term: "Plusvalía municipal (IIVTNU)",
    category: "Plazos y procedimiento",
    definition: "Impuesto municipal sobre el incremento del valor de los terrenos urbanos que se devenga al transmitir un inmueble por herencia.",
    longExplanation: [
      "Es un impuesto municipal (no autonómico ni estatal). Lo aplica el ayuntamiento donde radica el inmueble.",
      "Plazo: 6 meses desde el fallecimiento, prorrogables a 1 año en la mayoría de municipios.",
      "Si hay varios inmuebles en distintos municipios, son tramitaciones independientes en cada ayuntamiento.",
      "Tras la STC de octubre 2021, se permite no tributar si no hay incremento real de valor (probable con valoraciones a la baja durante la crisis 2008-2014).",
      "Se complementa con el Modelo 650 pero es un impuesto distinto y se paga aparte.",
    ],
    relatedTerms: ["modelo-650", "valor-referencia"],
    relatedTools: [],
  },
  {
    slug: "donacion-empresa-familiar",
    term: "Donación de empresa familiar",
    category: "Bonificaciones y reducciones",
    definition: "Donación de una empresa familiar o sus participaciones con reducción del 95% si cumple los requisitos del art. 20.6.",
    longExplanation: [
      "Para aplicar la reducción del 95%: el donante debe tener 65 años o estar en incapacidad permanente, debe dejar de ejercer funciones de dirección con remuneración, y el donatario debe mantener la titularidad durante 10 años.",
      "Si son participaciones sociales, el grupo familiar debe tener al menos el 20% (individualmente 5%).",
      "Es la fórmula clásica para transmitir la empresa familiar en vida, evitando los costes del ISD post-mortem.",
      "Si el donatario incumple el mantenimiento de 10 años, debe regularizar pagando el ISD sobre el valor completo más intereses.",
    ],
    relatedTerms: ["modelo-651", "empresa-familiar"],
    relatedTools: [
      { label: "Calculadora de donaciones", href: "/calculadora-donaciones" },
      { label: "Borrador Modelo 651", href: "/borrador-modelo651" },
    ],
    normRef: "Art. 20.6 Ley 29/1987",
  },
  {
    slug: "seguros-vida-reduccion",
    term: "Reducción por seguros de vida",
    category: "Bonificaciones y reducciones",
    definition: "Reducción específica de 9.195,49 € por beneficiario en seguros de vida del causante, aplicable a grupos I y II.",
    longExplanation: [
      "Es una reducción específica e independiente de las demás (parentesco, vivienda, etc.).",
      "Solo aplica a beneficiarios de los grupos I y II (descendientes, cónyuge, ascendientes).",
      "El tope es por beneficiario, no por póliza: si una persona es beneficiaria de 3 seguros, su tope total es 9.195,49 €.",
      "Para acreditarla: aportar el RCSV, las pólizas y la documentación del capital recibido.",
    ],
    relatedTerms: ["rcsv", "reducciones-art-20", "modelo-650"],
    relatedTools: [{ label: "Calculadora ISD con seguros", href: "/calculadora-isd" }],
    normRef: "Art. 20.2.b Ley 29/1987",
  },
  {
    slug: "tramos-isd",
    term: "Tramos del ISD",
    category: "Cuota y calculo",
    definition: "Escalas progresivas dentro de la tarifa estatal y de algunas bonificaciones autonómicas.",
    longExplanation: [
      "La tarifa estatal del art. 21 se aplica por tramos: cada tramo tiene su tipo marginal.",
      "Algunas CCAA aplican bonificaciones progresivas por tramos (Cataluña, Castilla-La Mancha, Cantabria).",
      "En estas CCAA, cruzar un tramo puede tener un impacto fiscal desproporcionado: 100.001 € paga significativamente más que 99.999 €.",
      "Estrategia: revisar la valoración del caudal para evitar cruzar tramos por poco.",
    ],
    relatedTerms: ["tarifa-estatal", "bonificacion-autonomica"],
    relatedTools: [{ label: "Comparador 17 CCAA con tramos", href: "/comparador-isd" }],
  },
  {
    slug: "declaracion-herederos",
    term: "Declaración de herederos abintestato",
    category: "Documentacion",
    definition: "Acta notarial que designa a los herederos legales cuando el causante no dejó testamento.",
    longExplanation: [
      "Si el Certificado de Últimas Voluntades acredita que no hay testamento, los herederos deben tramitar un acta notarial de declaración de herederos.",
      "La hace cualquier notario con competencia territorial. Plazo habitual: 20 días tras la solicitud.",
      "Se citan al notario los herederos legales según el orden del Código Civil: descendientes, ascendientes, cónyuge, colaterales.",
      "Una vez firmada, sustituye al testamento como título sucesorio para presentar el Modelo 650 y la posterior escritura de aceptación.",
    ],
    relatedTerms: ["certificado-ultimas-voluntades", "modelo-650"],
    relatedTools: [],
  },
  {
    slug: "aceptacion-herencia",
    term: "Aceptación de herencia",
    category: "Documentacion",
    definition: "Acto jurídico por el que los herederos aceptan la herencia. Puede ser pura, a beneficio de inventario o tácita.",
    longExplanation: [
      "Aceptación pura: el heredero asume todos los derechos y obligaciones del causante, incluidas las deudas.",
      "Aceptación a beneficio de inventario: el heredero solo responde de las deudas hasta el valor de los bienes recibidos. Recomendado cuando hay sospecha de deudas.",
      "Aceptación tácita: cualquier acto (vender, cobrar saldos) que implique ánimo de aceptar.",
      "La escritura de aceptación y partición se inscribe en el Registro de la Propiedad para los inmuebles.",
      "Tras aceptar, las deudas del causante recaen en el heredero (salvo beneficio de inventario).",
    ],
    relatedTerms: ["caudal-hereditario", "deudas-deducibles"],
    relatedTools: [],
  },
];

export const ALL_GLOSSARY_SLUGS = GLOSSARY.map((t) => t.slug);

export function getTermBySlug(slug: string): GlossaryTerm | null {
  return GLOSSARY.find((t) => t.slug === slug) ?? null;
}

export function getRelatedTerms(slug: string): GlossaryTerm[] {
  const term = getTermBySlug(slug);
  if (!term) return [];
  return term.relatedTerms
    .map((s) => getTermBySlug(s))
    .filter((t): t is GlossaryTerm => t !== null);
}

export const GLOSSARY_CATEGORIES: GlossaryCategory[] = [
  "Base imponible",
  "Cuota y calculo",
  "Plazos y procedimiento",
  "Sujetos",
  "Bonificaciones y reducciones",
  "Bienes y caudal",
  "Documentacion",
];
