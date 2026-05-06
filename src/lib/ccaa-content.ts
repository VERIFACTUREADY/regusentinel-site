/**
 * Contenido editorial por CCAA para las landings programaticas /sucesiones/[ccaa].
 *
 * Cada entrada incluye:
 * - slug SEO
 * - capital y tipo de regimen
 * - peculiaridades clave del ISD en esa comunidad
 * - plazos especificos si los hay
 * - oficina de hacienda autonomica donde se presenta
 *
 * No es asesoramiento juridico. Datos publicos consolidados y verificables.
 */

import type { CCAAKey } from "./isd-calculator";

export interface CCAAContent {
  slug: string;
  ccaa: CCAAKey;
  capital: string;
  haciendaName: string;
  haciendaUrl: string;
  modelo: string;
  /** Highlights for hero — short bullet points. */
  highlights: string[];
  /** Long-form content paragraphs. */
  paragraphs: string[];
  /** Specific deadlines or quirks. */
  notes: string[];
  /** FAQ pairs specific to this CCAA. */
  faq: { q: string; a: string }[];
}

export const CCAA_CONTENT: Record<CCAAKey, CCAAContent> = {
  MADRID: {
    slug: "madrid",
    ccaa: "MADRID",
    capital: "Madrid",
    haciendaName: "Comunidad de Madrid — Consejería de Economía, Hacienda y Empleo",
    haciendaUrl: "https://www.comunidad.madrid/servicios/administracion-electronica-punto-acceso-general/impuestos",
    modelo: "Modelo 650 (autoliquidación) y Modelo 651 (donaciones).",
    highlights: [
      "Bonificación del 99% para cónyuge, hijos y padres (grupos I y II)",
      "Bonificación del 25% para hermanos, tíos y sobrinos (grupo III, desde 2023)",
      "Bonificación del 10% para grupo IV (sin parentesco, desde 2024)",
      "Plazo: 6 meses desde el fallecimiento, prorrogable a 12 meses",
    ],
    paragraphs: [
      "La Comunidad de Madrid es una de las más favorables de España para la tributación del Impuesto sobre Sucesiones y Donaciones. La bonificación del 99% sobre la cuota tributaria para cónyuge, descendientes y ascendientes (grupos I y II) hace que en la práctica la herencia entre familiares directos tribute prácticamente a cero.",
      "Desde 2023, los hermanos, tíos y sobrinos (grupo III) cuentan con una bonificación del 25%, y desde 2024 incluso los herederos sin vínculo familiar (grupo IV) pueden aplicar un 10%. Esto convierte a Madrid en una de las comunidades más competitivas del país a efectos de planificación sucesoria.",
      "Las reducciones estatales (vivienda habitual del 95% hasta 122.606,47 €, empresa familiar del 95%, seguros de vida hasta 9.195,49 € por beneficiario) se mantienen plenamente aplicables y se acumulan a la bonificación autonómica.",
    ],
    notes: [
      "La autoliquidación se presenta telemáticamente a través del portal de la Comunidad de Madrid.",
      "El Valor de Referencia del Catastro es la base mínima desde 2022 salvo que se declare un valor superior.",
      "Si el causante residía en Madrid los últimos 5 años, aplica la normativa madrileña aunque los herederos vivan en otra CCAA.",
    ],
    faq: [
      {
        q: "¿Cuánto se paga de herencia en Madrid?",
        a: "Para cónyuge, hijos y padres prácticamente nada: la bonificación del 99% deja la cuota efectiva en torno al 1% de lo que correspondería con la tarifa estatal. Por ejemplo, en una herencia de 200.000 € a un hijo, la cuota a pagar suele quedar por debajo de 250 €.",
      },
      {
        q: "¿Hay que presentar el Modelo 650 aunque no se pague?",
        a: "Sí. La presentación es obligatoria aunque la cuota tras bonificación sea cero. Se considera autoliquidación y debe presentarse en plazo para que la bonificación sea válida.",
      },
      {
        q: "¿Dónde se presenta el Modelo 650 en Madrid?",
        a: "En la sede electrónica de la Consejería de Economía, Hacienda y Empleo de la Comunidad de Madrid. Existe asistencia presencial en las oficinas tributarias de la CCAA, pero el grueso del trámite es telemático.",
      },
    ],
  },

  ANDALUCIA: {
    slug: "andalucia",
    ccaa: "ANDALUCIA",
    capital: "Sevilla",
    haciendaName: "Junta de Andalucía — Agencia Tributaria de Andalucía",
    haciendaUrl: "https://www.juntadeandalucia.es/agenciatributariadeandalucia",
    modelo: "Modelo 650 autonómico.",
    highlights: [
      "Bonificación del 99% para cónyuge, descendientes y ascendientes (grupos I y II)",
      "Reducción autonómica adicional para vivienda habitual del causante",
      "Plazo: 6 meses, prorrogable a 12 meses",
    ],
    paragraphs: [
      "Andalucía es, junto con Madrid, una de las comunidades autónomas más favorables a la herencia entre familiares directos. La bonificación del 99% sobre la cuota tributaria fue aprobada en 2019 y mantiene su vigencia, acumulándose a las reducciones estatales del art. 20 de la Ley 29/1987.",
      "La presentación se realiza a través de la Agencia Tributaria de Andalucía (ATRIAN), que ofrece la mayoría de trámites telemáticamente. Para herencias con inmuebles, conviene comprobar el Valor de Referencia catastral antes de presentar la autoliquidación.",
    ],
    notes: [
      "La bonificación del 99% solo aplica a la cuota tributaria — las reducciones estatales se aplican antes y siguen disponibles.",
      "Existe una reducción autonómica propia para empresa familiar y vivienda habitual.",
    ],
    faq: [
      {
        q: "¿Cuánto se paga de herencia en Andalucía?",
        a: "Para cónyuge, hijos y padres, prácticamente nada — el 99% de bonificación deja la cuota residual muy baja. Para grupos III y IV se aplica la tarifa estatal completa.",
      },
      {
        q: "¿Andalucía tiene reducciones propias?",
        a: "Sí, además de las estatales aplica reducciones específicas para empresa familiar y vivienda habitual del causante, en algunos supuestos más generosas que las estatales.",
      },
    ],
  },

  CATALUNA: {
    slug: "cataluna",
    ccaa: "CATALUNA",
    capital: "Barcelona",
    haciendaName: "Generalitat de Catalunya — Agència Tributària de Catalunya (ATC)",
    haciendaUrl: "https://atc.gencat.cat",
    modelo: "Modelo 650 catalán (autoliquidación).",
    highlights: [
      "Bonificaciones progresivas: 99% hasta 100K€, 97% hasta 200K€, 90% hasta 500K€, 70% hasta 1M€",
      "Reducciones por parentesco específicas (grupos I y II)",
      "Sistema de tramos: cruzar un umbral reduce la bonificación al siguiente nivel",
    ],
    paragraphs: [
      "Cataluña aplica un sistema de bonificaciones progresivas único en España. La bonificación arranca en el 99% para bases liquidables hasta 100.000 €, y se va reduciendo por tramos: 97% hasta 200.000 €, 90% hasta 500.000 €, 70% hasta 1.000.000 € y 50% por encima.",
      "Esta progresividad hace especialmente importante valorar correctamente el caudal hereditario: cruzar un umbral por unos pocos miles de euros puede suponer pagar miles de euros más de impuesto. Por eso conviene revisar el Valor de Referencia catastral, las tasaciones y considerar reducciones de patrimonio antes de la declaración.",
      "Adicionalmente, Cataluña ofrece reducciones específicas para grupos I y II por parentesco que se aplican antes de la cuota, y reducciones por discapacidad, empresa familiar y vivienda habitual.",
    ],
    notes: [
      "Cruzar el umbral de 100K, 200K, 500K o 1M€ baja un escalón la bonificación; planificar la valoración con cuidado.",
      "Existe Modelo 660 para la declaración informativa cuando hay varios herederos.",
    ],
    faq: [
      {
        q: "¿Cómo funcionan los tramos de bonificación en Cataluña?",
        a: "La bonificación se aplica por tramos según la base liquidable. Si la base supera ligeramente un umbral, la diferencia con el siguiente tramo puede ser muy alta. Es la única CCAA con este sistema progresivo.",
      },
      {
        q: "¿Conviene reducir la base imponible en Cataluña?",
        a: "Sí. A diferencia de Madrid o Andalucía donde la bonificación es plana, en Cataluña una valoración ajustada puede mantener la base por debajo de un umbral y ahorrar mucho impuesto.",
      },
    ],
  },

  GALICIA: {
    slug: "galicia",
    ccaa: "GALICIA",
    capital: "Santiago de Compostela",
    haciendaName: "Xunta de Galicia — Axencia Tributaria de Galicia (ATRIGA)",
    haciendaUrl: "https://www.atriga.gal",
    modelo: "Modelo 650 (autoliquidación).",
    highlights: [
      "Bonificación del 99% para cónyuge, hijos y padres hasta 1.000.000 € de base",
      "Reducción específica por parentesco grupo II hasta 1M€",
      "Plazo: 6 meses, prorrogable a 12 meses",
    ],
    paragraphs: [
      "Galicia bonifica al 99% la cuota del impuesto para grupos I y II hasta una base liquidable de 1.000.000 €. Por encima, se aplica la tarifa estatal sin bonificación general, lo que la convierte en una CCAA muy favorable para herencias medianas y altas hasta ese umbral.",
      "La gestión se realiza a través de la Axencia Tributaria de Galicia (ATRIGA), con presentación telemática preferente. Las reducciones estatales (vivienda, seguros de vida, empresa familiar) se aplican normalmente antes de la cuota tributaria.",
    ],
    notes: [
      "Para bases superiores a 1M€, conviene revisar si conviene una distribución distinta del caudal entre herederos.",
      "Galicia mantiene además reducciones por minusvalía y empresa familiar específicas.",
    ],
    faq: [
      {
        q: "¿Cuánto se paga de herencia en Galicia?",
        a: "Hasta 1.000.000 € de base liquidable, prácticamente nada para cónyuge, hijos o padres (99% de bonificación). Por encima, se aplica la tarifa estatal completa.",
      },
    ],
  },

  CANARIAS: {
    slug: "canarias",
    ccaa: "CANARIAS",
    capital: "Las Palmas / Santa Cruz",
    haciendaName: "Gobierno de Canarias — Agencia Tributaria Canaria",
    haciendaUrl: "https://sede.gobiernodecanarias.org/tributos",
    modelo: "Modelo 650.",
    highlights: [
      "Bonificación del 99,9% para grupos I y II",
      "Reducciones autonómicas adicionales por discapacidad",
      "Plazo: 6 meses, prorrogable",
    ],
    paragraphs: [
      "Canarias aplica una bonificación del 99,9% a la cuota tributaria para cónyuge, descendientes y ascendientes (grupos I y II), una de las más altas de España. La gestión corresponde a la Agencia Tributaria Canaria, con sedes en Las Palmas y Santa Cruz de Tenerife.",
      "Para grupos III y IV se aplica la tarifa estatal completa. Existen reducciones autonómicas específicas para personas con discapacidad y empresa familiar canaria que pueden complementar las estatales.",
    ],
    notes: [
      "Aplica la normativa canaria si el causante residió en Canarias en los 5 años anteriores al fallecimiento.",
    ],
    faq: [
      {
        q: "¿Cuánto se paga de herencia en Canarias?",
        a: "Para grupos I y II prácticamente nada: la bonificación del 99,9% deja la cuota efectiva muy baja en herencias entre familiares directos.",
      },
    ],
  },

  BALEARES: {
    slug: "baleares",
    ccaa: "BALEARES",
    capital: "Palma",
    haciendaName: "Govern de les Illes Balears — Agència Tributària de les Illes Balears (ATIB)",
    haciendaUrl: "https://www.atib.es",
    modelo: "Modelo 650.",
    highlights: [
      "Bonificación del 100% para cónyuge, hijos y padres (desde mayo 2023)",
      "Plazo: 6 meses",
      "Trámite preferente telemático en la sede de la ATIB",
    ],
    paragraphs: [
      "Las Islas Baleares aprobaron en mayo de 2023 una bonificación del 100% para los grupos I y II, eliminando de hecho el impuesto para cónyuge, hijos y padres. Es una de las medidas autonómicas más generosas del país.",
      "La gestión corresponde a la Agència Tributària de les Illes Balears (ATIB), con presentación telemática a través de su sede electrónica.",
    ],
    notes: [
      "La bonificación del 100% es de aplicación a fallecimientos posteriores a la entrada en vigor de la reforma (mayo 2023).",
    ],
    faq: [
      {
        q: "¿Se paga herencia en Baleares?",
        a: "No para grupos I y II. La bonificación del 100% deja la cuota a cero. Para grupos III y IV sí se aplica la tarifa estatal.",
      },
    ],
  },

  MURCIA: {
    slug: "murcia",
    ccaa: "MURCIA",
    capital: "Murcia",
    haciendaName: "Comunidad Autónoma de la Región de Murcia — ATRM",
    haciendaUrl: "https://agenciatributaria.carm.es",
    modelo: "Modelo 650.",
    highlights: [
      "Bonificación del 99% para grupos I y II",
      "Plazo: 6 meses, prorrogable a 12",
    ],
    paragraphs: [
      "La Región de Murcia bonifica al 99% la cuota tributaria del ISD para cónyuge, hijos y padres. La presentación es telemática a través de la Agencia Tributaria de la Región de Murcia.",
    ],
    notes: [],
    faq: [
      {
        q: "¿Cuánto se paga de herencia en Murcia?",
        a: "Para cónyuge, hijos y padres, prácticamente nada gracias a la bonificación del 99% sobre la cuota tributaria.",
      },
    ],
  },

  CANTABRIA: {
    slug: "cantabria",
    ccaa: "CANTABRIA",
    capital: "Santander",
    haciendaName: "Gobierno de Cantabria — Agencia Cántabra de Administración Tributaria",
    haciendaUrl: "https://acat.cantabria.es",
    modelo: "Modelo 650.",
    highlights: [
      "Bonificación del 100% hasta 100.000 €",
      "Por encima de 100K, bonificación reducida según escalado",
      "Plazo: 6 meses",
    ],
    paragraphs: [
      "Cantabria aplica una bonificación del 100% para herencias hasta 100.000 € de base liquidable cuando el heredero es cónyuge, descendiente o ascendiente. Por encima del umbral, la bonificación se reduce según un escalado autonómico específico.",
      "Es una de las CCAA en las que el valor exacto de la herencia importa: cruzar el umbral de 100.000 € puede suponer un cambio relevante en la cuota a pagar.",
    ],
    notes: [
      "Existe escalado especifico — verificar la bonificación aplicable según la base liquidable real.",
    ],
    faq: [
      {
        q: "¿Hasta cuánto está bonificado al 100% en Cantabria?",
        a: "Hasta 100.000 € de base liquidable para grupos I y II. Por encima, la bonificación se reduce.",
      },
    ],
  },

  CASTILLA_LEON: {
    slug: "castilla-y-leon",
    ccaa: "CASTILLA_LEON",
    capital: "Valladolid",
    haciendaName: "Junta de Castilla y León — Consejería de Economía y Hacienda",
    haciendaUrl: "https://tributos.jcyl.es",
    modelo: "Modelo 650.",
    highlights: [
      "Bonificación del 99% para grupos I y II",
      "Reducción autonómica adicional para vivienda habitual del causante",
      "Plazo: 6 meses",
    ],
    paragraphs: [
      "Castilla y León bonifica al 99% la cuota tributaria del ISD para cónyuge, descendientes y ascendientes. La gestión corresponde a la Consejería de Economía y Hacienda de la Junta.",
    ],
    notes: [],
    faq: [
      {
        q: "¿Cuánto se paga de herencia en Castilla y León?",
        a: "Prácticamente nada para grupos I y II — la bonificación del 99% reduce la cuota al mínimo. Para grupos III y IV se aplica la tarifa estatal.",
      },
    ],
  },

  CASTILLA_LA_MANCHA: {
    slug: "castilla-la-mancha",
    ccaa: "CASTILLA_LA_MANCHA",
    capital: "Toledo",
    haciendaName: "Castilla-La Mancha — Consejería de Hacienda y Administraciones Públicas",
    haciendaUrl: "https://tributos.castillalamancha.es",
    modelo: "Modelo 650.",
    highlights: [
      "Bonificación progresiva: 100% hasta 175K€, 95% hasta 225K€, 90% hasta 275K€, 85% hasta 300K€",
      "Por encima de 300.000 € se aplica la tarifa estatal",
      "Plazo: 6 meses, prorrogable a 12",
    ],
    paragraphs: [
      "Castilla-La Mancha aplica una escala de bonificaciones progresivas similar a la de Cataluña. Hasta 175.000 € de base liquidable la bonificación es del 100% (cuota cero). A partir de ahí, se va reduciendo: 95%, 90%, 85% según el tramo.",
      "Por la naturaleza progresiva del esquema, la valoración del caudal hereditario es crítica: cruzar un umbral por poco puede suponer un salto importante en la cuota.",
    ],
    notes: [
      "Cruzar 175K€, 225K€, 275K€ o 300K€ reduce la bonificación al siguiente tramo.",
    ],
    faq: [
      {
        q: "¿Hasta qué importe es gratis en Castilla-La Mancha?",
        a: "Hasta 175.000 € de base liquidable la bonificación es del 100% — la cuota es cero. Por encima se aplican tramos decrecientes.",
      },
    ],
  },

  ARAGON: {
    slug: "aragon",
    ccaa: "ARAGON",
    capital: "Zaragoza",
    haciendaName: "Gobierno de Aragón — Dirección General de Tributos",
    haciendaUrl: "https://www.aragon.es/tramites/impuesto-sucesiones",
    modelo: "Modelo 650.",
    highlights: [
      "Bonificación del 65% para grupos I y II hasta 100.000 €",
      "Por encima del umbral aplica tarifa estatal",
      "Reducciones autonómicas por discapacidad",
    ],
    paragraphs: [
      "Aragón aplica una bonificación del 65% para grupos I y II hasta 100.000 € de base. Por encima de ese umbral se aplica la tarifa estatal sin bonificación general, lo que la sitúa en una posición intermedia entre las CCAA más generosas y las más estrictas.",
    ],
    notes: [],
    faq: [
      {
        q: "¿Cuánto se paga de herencia en Aragón?",
        a: "Hasta 100.000 € de base, la bonificación del 65% reduce significativamente la cuota. Por encima, se aplica la tarifa estatal completa.",
      },
    ],
  },

  EXTREMADURA: {
    slug: "extremadura",
    ccaa: "EXTREMADURA",
    capital: "Mérida",
    haciendaName: "Junta de Extremadura — Consejería de Hacienda",
    haciendaUrl: "https://portaltributario.juntaex.es",
    modelo: "Modelo 650.",
    highlights: [
      "Bonificación del 99% para grupos I y II",
      "Reducciones autonómicas para vivienda y empresa familiar",
      "Plazo: 6 meses",
    ],
    paragraphs: [
      "Extremadura bonifica al 99% la cuota tributaria para cónyuge, hijos y padres. La gestión se realiza a través de la Consejería de Hacienda y Administraciones Públicas de la Junta.",
    ],
    notes: [],
    faq: [
      {
        q: "¿Cuánto se paga de herencia en Extremadura?",
        a: "Para grupos I y II prácticamente nada — la bonificación del 99% deja la cuota residual muy baja.",
      },
    ],
  },

  LA_RIOJA: {
    slug: "la-rioja",
    ccaa: "LA_RIOJA",
    capital: "Logroño",
    haciendaName: "Gobierno de La Rioja — Consejería de Hacienda",
    haciendaUrl: "https://www.larioja.org/hacienda/es",
    modelo: "Modelo 650.",
    highlights: [
      "Bonificación del 99% para grupos I y II",
      "Plazo: 6 meses",
    ],
    paragraphs: [
      "La Rioja aplica una bonificación del 99% sobre la cuota tributaria para cónyuge, hijos y padres. Es una de las comunidades más favorables al lado de Madrid, Andalucía y Galicia.",
    ],
    notes: [],
    faq: [
      {
        q: "¿Cuánto se paga de herencia en La Rioja?",
        a: "Para grupos I y II, gracias a la bonificación del 99%, la cuota efectiva queda muy baja.",
      },
    ],
  },

  VALENCIA: {
    slug: "comunidad-valenciana",
    ccaa: "VALENCIA",
    capital: "Valencia",
    haciendaName: "Generalitat Valenciana — Conselleria d'Hisenda",
    haciendaUrl: "https://atv.gva.es",
    modelo: "Modelo 650.",
    highlights: [
      "Bonificación del 99% para grupos I y II (desde 2023)",
      "Reducción adicional para herederos con discapacidad",
      "Plazo: 6 meses",
    ],
    paragraphs: [
      "La Comunitat Valenciana incrementó en 2023 la bonificación al 99% para cónyuge, hijos y padres. Esta reforma situó a la región a la altura de Madrid, Andalucía y otras comunidades pioneras en bonificación.",
    ],
    notes: [
      "La bonificación del 99% aplica a fallecimientos desde la entrada en vigor de la reforma — verificar la fecha de devengo.",
    ],
    faq: [
      {
        q: "¿Cuánto se paga de herencia en la Comunitat Valenciana?",
        a: "Desde 2023, la bonificación del 99% para grupos I y II hace que la cuota residual sea mínima.",
      },
    ],
  },

  ASTURIAS: {
    slug: "asturias",
    ccaa: "ASTURIAS",
    capital: "Oviedo",
    haciendaName: "Principado de Asturias — Consejería de Hacienda",
    haciendaUrl: "https://www.tributasenasturias.es",
    modelo: "Modelo 650 (tarifa propia asturiana).",
    highlights: [
      "Sin bonificación general en cuota — aplica la tarifa autonómica completa",
      "Tarifa propia más progresiva que la estatal",
      "Reducciones específicas por discapacidad y vivienda habitual",
    ],
    paragraphs: [
      "Asturias es una de las comunidades autónomas que mantiene una tributación efectiva sobre las herencias entre familiares directos. No aplica una bonificación general en cuota como Madrid o Andalucía, sino que utiliza una tarifa propia con reducciones específicas.",
      "Esto convierte a Asturias en una de las CCAA donde más conviene planificar la sucesión. Las reducciones por vivienda habitual (95% hasta 122.606 €), discapacidad y empresa familiar siguen siendo aplicables y pueden reducir notablemente la base liquidable.",
    ],
    notes: [
      "Verificar siempre la tarifa autonómica vigente — Asturias actualiza tramos con frecuencia.",
      "La planificación con reducciones aplicables (vivienda, seguro de vida, empresa familiar) es clave aquí.",
    ],
    faq: [
      {
        q: "¿Por qué se paga más herencia en Asturias?",
        a: "Asturias no aplica una bonificación general en cuota como otras comunidades. La cuota tributaria se paga íntegra, salvo las reducciones aplicables a la base imponible (vivienda habitual, seguros de vida, etc.).",
      },
      {
        q: "¿Conviene planificar antes en Asturias?",
        a: "Mucho. Donaciones en vida, ampliación de seguros de vida, valoración cuidadosa del patrimonio y aplicación de todas las reducciones disponibles pueden reducir notablemente la cuota final.",
      },
    ],
  },

  NAVARRA: {
    slug: "navarra",
    ccaa: "NAVARRA",
    capital: "Pamplona",
    haciendaName: "Hacienda Foral de Navarra",
    haciendaUrl: "https://hacienda.navarra.es",
    modelo: "Modelo 650 foral (no estatal).",
    highlights: [
      "Régimen foral propio — no aplica la normativa estatal",
      "Tarifa y reducciones específicas de la Hacienda Foral",
      "Plazo: 6 meses, prorrogable",
    ],
    paragraphs: [
      "Navarra es una comunidad foral con su propio sistema tributario. El Impuesto sobre Sucesiones y Donaciones se gestiona ante la Hacienda Foral de Navarra, no ante la AEAT, y se rige por la normativa foral propia, generalmente más favorable que el régimen general en algunos aspectos.",
      "Para herencias entre cónyuges y descendientes directos, el régimen foral aplica una tarifa significativamente más baja que la estatal, con reducciones específicas que conviene revisar caso a caso.",
    ],
    notes: [
      "La presentación es ante la Hacienda Foral, no ante la AEAT ni ante una agencia autonómica del régimen común.",
      "El cálculo es completamente distinto al estatal — la calculadora estatal es solo orientativa.",
    ],
    faq: [
      {
        q: "¿Por qué Navarra es diferente?",
        a: "Navarra tiene Concierto Foral, lo que significa que regula y recauda sus propios impuestos según normativa propia. El ISD navarro tiene tipos y reducciones distintos al régimen estatal.",
      },
    ],
  },

  PAIS_VASCO: {
    slug: "pais-vasco",
    ccaa: "PAIS_VASCO",
    capital: "Vitoria-Gasteiz",
    haciendaName: "Diputaciones Forales (Bizkaia, Gipuzkoa, Álava)",
    haciendaUrl: "https://www.bizkaia.eus/ogasuna",
    modelo: "Modelo foral según provincia (Bizkaia, Gipuzkoa, Álava).",
    highlights: [
      "Régimen foral propio en cada Diputación",
      "Bonificación general para cónyuge, hijos y padres en las tres Diputaciones",
      "Gestión ante la Diputación Foral correspondiente",
    ],
    paragraphs: [
      "El País Vasco tiene tres regímenes forales distintos: Bizkaia, Gipuzkoa y Álava. Cada Diputación Foral regula y gestiona sus propios impuestos, incluido el ISD. Aunque las reglas son similares en líneas generales (bonificaciones generosas para grupos I y II), existen diferencias entre las tres provincias.",
      "Para grupos I y II, el régimen general en las tres Diputaciones es altamente favorable, con bonificaciones cercanas al 100% en muchos supuestos. Para grupos III y IV se aplican tarifas propias con escalado por base.",
    ],
    notes: [
      "Verificar la Diputación Foral competente según la residencia del causante.",
      "La calculadora estatal es solo orientativa — el cálculo foral puede ser muy distinto.",
    ],
    faq: [
      {
        q: "¿Cuánto se paga de herencia en el País Vasco?",
        a: "Para cónyuge, hijos y padres, muy poco. Las tres Diputaciones Forales aplican bonificaciones generosas que dejan la cuota efectiva muy baja.",
      },
      {
        q: "¿Hay diferencias entre Bizkaia, Gipuzkoa y Álava?",
        a: "Sí. Aunque la filosofía es similar, los tramos y reducciones específicas pueden variar. Conviene revisar la normativa foral de la Diputación competente.",
      },
    ],
  },
};

export const ALL_CCAA_SLUGS = Object.values(CCAA_CONTENT).map((c) => c.slug);

export function getCCAABySlug(slug: string): CCAAContent | null {
  return Object.values(CCAA_CONTENT).find((c) => c.slug === slug) ?? null;
}
