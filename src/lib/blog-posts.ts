/**
 * Posts seed del blog. Cada post se guarda como dato estructurado para
 * poder generar paginas estaticas con generateStaticParams.
 *
 * Filosofia: cada post resuelve una busqueda real con intencion de uso del
 * producto y enlaza hacia las herramientas gratuitas (calculadora, borrador,
 * comparador) o hacia las paginas SEO de CCAA.
 */

export interface BlogPost {
  slug: string;
  title: string;
  description: string;
  publishedAt: string; // ISO
  updatedAt?: string;
  category: "Plazos" | "Tramites" | "Fiscalidad" | "CCAA" | "Profesional";
  tags: string[];
  /** Time-to-read in minutes. */
  readingMinutes: number;
  /** Hero subtitle / lead paragraph. */
  lead: string;
  /** Content blocks. Renders to semantic HTML. */
  blocks: ContentBlock[];
}

export type ContentBlock =
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "callout"; tone: "info" | "warning" | "success"; title: string; text: string }
  | { type: "cta"; title: string; href: string; label: string }
  | { type: "quote"; text: string };

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "plazo-modelo-650-impuesto-sucesiones",
    title: "Plazos del Modelo 650 paso a paso: cuándo hay que presentar el Impuesto de Sucesiones",
    description:
      "Plazo legal de presentación, ventana de prórroga, recargos por presentación tardía y recomendaciones para no perder los beneficios fiscales del ISD.",
    publishedAt: "2025-01-10",
    category: "Plazos",
    tags: ["modelo 650", "isd", "plazo", "prorroga"],
    readingMinutes: 6,
    lead: "El Modelo 650 (autoliquidación del Impuesto sobre Sucesiones y Donaciones) tiene un plazo legal de 6 meses desde el fallecimiento. Conocer la mecánica de los plazos —ordinario, prórroga y recargos— evita perder bonificaciones autonómicas y minimiza el coste fiscal.",
    blocks: [
      { type: "h2", text: "Plazo ordinario: 6 meses desde el fallecimiento" },
      {
        type: "p",
        text: "El art. 67 del Reglamento del ISD fija un plazo de 6 meses contados desde el día del fallecimiento. La autoliquidación debe presentarse y, en su caso, ingresarse antes del último día hábil del sexto mes.",
      },
      {
        type: "callout",
        tone: "info",
        title: "Cómo se cuentan los meses",
        text: "Los plazos se cuentan de fecha a fecha. Si el fallecimiento fue el 15 de enero, el plazo límite ordinario será el 15 de julio. Si ese día es inhábil (fin de semana, festivo nacional o autonómico), pasa al siguiente día hábil.",
      },

      { type: "h2", text: "Prórroga: 6 meses adicionales (hasta 12 en total)" },
      {
        type: "p",
        text: "El art. 68 del Reglamento permite solicitar una prórroga de otros 6 meses. La solicitud debe presentarse antes del transcurso del quinto mes desde el fallecimiento (es decir, en el mes 5, no en el 6).",
      },
      { type: "h3", text: "Quién puede solicitarla" },
      {
        type: "ul",
        items: [
          "Cualquiera de los herederos, incluso si los demás no se han presentado",
          "El representante legal con poder bastante",
          "El albacea testamentario en su caso",
        ],
      },
      { type: "h3", text: "Cómo se solicita" },
      {
        type: "p",
        text: "Mediante escrito dirigido a la oficina liquidadora competente (según la CCAA del causante). La solicitud devenga intereses de demora desde el final del plazo ordinario aunque la prórroga se conceda, pero sin recargo por presentación fuera de plazo.",
      },

      { type: "h2", text: "Recargos por presentación tardía" },
      {
        type: "p",
        text: "Si se presenta fuera de plazo sin requerimiento previo de la Administración, los recargos del art. 27 LGT son crecientes:",
      },
      {
        type: "ol",
        items: [
          "Hasta 3 meses de retraso: recargo del 5%",
          "Entre 3 y 6 meses: recargo del 10%",
          "Entre 6 y 12 meses: recargo del 15%",
          "Más de 12 meses: recargo del 20% más intereses de demora desde el día siguiente al fin del primer año",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "Cuidado con la pérdida de bonificaciones",
        text: "Algunas CCAA exigen que la autoliquidación se haya presentado en plazo para mantener derecho a determinadas bonificaciones autonómicas. Una presentación tardía puede no solo añadir recargos, sino también convertir una cuota de cero euros en una cuota completa.",
      },

      { type: "h2", text: "Plazos especiales" },
      { type: "h3", text: "Cuando el causante muere fuera de España" },
      {
        type: "p",
        text: "Si el causante residía en el extranjero pero los herederos son residentes en España, sigue aplicando el plazo de 6 meses, pero el modelo se presenta ante la AEAT (Modelo 650 estatal) y no ante la oficina liquidadora autonómica.",
      },
      { type: "h3", text: "Cuando hay litigio sobre la herencia" },
      {
        type: "p",
        text: "El plazo se interrumpe durante el procedimiento judicial que afecte a la transmisión hereditaria, y se reanuda cuando finaliza. Es importante notificar a la oficina liquidadora.",
      },

      { type: "h2", text: "Recomendaciones prácticas" },
      {
        type: "ul",
        items: [
          "No esperes a tener todo perfecto: si el plazo se acerca, presenta una autoliquidación provisional y rectifica después",
          "Solicita la prórroga en el mes 4 si la documentación no estará lista en el mes 5",
          "Lleva un registro centralizado de las fechas: certificado literal de defunción → 15 días hábiles para certificado de últimas voluntades → 6 meses ISD",
          "Para varios herederos, valora presentar todas las autoliquidaciones a la vez para reducir errores",
        ],
      },

      {
        type: "cta",
        title: "Genera el borrador del Modelo 650 en 30 segundos",
        href: "/borrador-modelo650",
        label: "Probar gratis →",
      },
    ],
  },

  {
    slug: "certificado-ultimas-voluntades-rcsv-paso-a-paso",
    title: "Cómo solicitar el Certificado de Últimas Voluntades y el RCSV: guía 2025",
    description:
      "Cómo obtener el Certificado de Últimas Voluntades y el Registro de Contratos de Seguro de Vida (RCSV) para tramitar una herencia. Modelos, plazos y errores comunes.",
    publishedAt: "2025-01-12",
    category: "Tramites",
    tags: ["ultimas voluntades", "rcsv", "modelo 790", "herencia"],
    readingMinutes: 5,
    lead: "Antes de poder repartir una herencia hay que saber si existe testamento y si el causante tenía seguros de vida. Esa información se obtiene mediante dos certificados emitidos por el Ministerio de Justicia: el de Últimas Voluntades y el RCSV.",
    blocks: [
      { type: "h2", text: "Qué son y por qué son obligatorios" },
      {
        type: "p",
        text: "El Certificado de Últimas Voluntades (CUV) acredita si el causante había otorgado testamento y, en su caso, ante qué notario. Sin él no es posible solicitar copia del testamento ni iniciar la declaración de herederos. El Registro de Contratos de Seguro de Vida (RCSV) informa de los seguros de vida y accidentes con cobertura de fallecimiento que el causante tenía contratados.",
      },
      {
        type: "callout",
        tone: "info",
        title: "Un solo modelo, dos certificados",
        text: "Ambos certificados se solicitan con el Modelo 790 (código 006). En el formulario marcas si quieres uno, otro o los dos a la vez. La tasa son aproximadamente 4 € por cada uno (importe actualizado en 2025).",
      },

      { type: "h2", text: "Plazo de espera tras el fallecimiento" },
      {
        type: "p",
        text: "Hay que esperar 15 días hábiles desde la fecha del fallecimiento para poder solicitarlos. Antes de ese plazo, el Ministerio rechaza la solicitud porque la información del Registro Civil aún no se ha consolidado.",
      },
      {
        type: "callout",
        tone: "warning",
        title: "Días hábiles, no naturales",
        text: "Sábados, domingos y festivos no cuentan. Si el fallecimiento fue un viernes, los 15 días hábiles te pueden llevar a más de 3 semanas naturales. Anota la fecha exacta en la que podrás solicitarlos.",
      },

      { type: "h2", text: "Documentación necesaria" },
      {
        type: "ul",
        items: [
          "Certificado literal de defunción (original o copia compulsada)",
          "DNI/NIE del solicitante",
          "Modelo 790 cumplimentado (se descarga de la Sede del Ministerio de Justicia)",
          "Justificante de pago de la tasa (aprox. 4 € por certificado)",
        ],
      },

      { type: "h2", text: "Cómo presentarlo" },
      { type: "h3", text: "Online (recomendado)" },
      {
        type: "p",
        text: "Con certificado digital o Cl@ve PIN puedes solicitarlo en la Sede Electrónica del Ministerio de Justicia. La emisión suele tardar de 3 a 7 días laborables. Es la opción más rápida y permite descargar el certificado firmado electrónicamente.",
      },
      { type: "h3", text: "Presencial" },
      {
        type: "p",
        text: "En las Gerencias Territoriales del Ministerio de Justicia o en oficinas de Correos. Tarda más (entre 2 y 4 semanas) y exige presentar el original en papel.",
      },

      { type: "h2", text: "Errores comunes" },
      {
        type: "ul",
        items: [
          "Solicitarlo antes de los 15 días hábiles → el Ministerio lo rechaza",
          "Incluir mal el código de tasa (006 para ambos certificados, no confundir con otros)",
          "Olvidar incluir el certificado literal de defunción → no aceptan resúmenes ni extractos",
          "Cumplimentar el modelo a mano cuando exige formato electrónico",
        ],
      },

      { type: "h2", text: "Después de recibirlos" },
      {
        type: "p",
        text: "Una vez tengas los certificados, podrás: (1) si hay testamento, solicitar copia auténtica al notario indicado; (2) si no hay testamento, iniciar la declaración de herederos abintestato; (3) si hay seguros de vida, contactar con cada aseguradora para presentar la solicitud de pago del capital.",
      },

      {
        type: "cta",
        title: "Centraliza todos los trámites del expediente",
        href: "/#demo",
        label: "Ver BARITUR PRO →",
      },
    ],
  },

  {
    slug: "diferencias-isd-madrid-cataluna",
    title: "Diferencias del Impuesto de Sucesiones entre Madrid y Cataluña: comparativa 2025",
    description:
      "Por qué se paga 99% menos herencia en Madrid que en Cataluña. Bonificaciones, tramos progresivos catalanes y ejemplos numéricos para herederos directos.",
    publishedAt: "2025-01-15",
    category: "CCAA",
    tags: ["madrid", "cataluna", "isd", "comparativa"],
    readingMinutes: 7,
    lead: "Heredar la misma cantidad puede costar miles de euros distintos según la CCAA del causante. Madrid y Cataluña representan los dos extremos: una bonificación plana del 99% frente a un sistema progresivo por tramos. Esta es la diferencia real con cifras.",
    blocks: [
      { type: "h2", text: "Madrid: bonificación plana del 99%" },
      {
        type: "p",
        text: "La Comunidad de Madrid aplica una bonificación del 99% sobre la cuota tributaria para grupos I (hijos menores de 21) y II (cónyuge, hijos, padres). Esto significa que, al final, el heredero solo paga el 1% de la cuota que correspondería con la tarifa estatal.",
      },
      {
        type: "p",
        text: "Desde 2023 incluso los hermanos, tíos y sobrinos (grupo III) tienen un 25% de bonificación, y desde 2024 los herederos sin parentesco (grupo IV) un 10%. La bonificación es plana: no depende del importe heredado.",
      },

      { type: "h2", text: "Cataluña: bonificación progresiva por tramos" },
      {
        type: "p",
        text: "Cataluña aplica un sistema único en España: la bonificación arranca en el 99% para bases liquidables hasta 100.000 €, pero se reduce por tramos a medida que la base aumenta:",
      },
      {
        type: "ol",
        items: [
          "Hasta 100.000 €: bonificación del 99%",
          "De 100.001 € a 200.000 €: bonificación del 97%",
          "De 200.001 € a 500.000 €: bonificación del 90%",
          "De 500.001 € a 1.000.000 €: bonificación del 70%",
          "Más de 1.000.000 €: bonificación del 50%",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "Cruzar un umbral por poco sale caro",
        text: "Una base liquidable de 100.001 € se beneficia del 97%, mientras que 99.999 € se beneficia del 99%. Esto hace especialmente importante una valoración cuidadosa del caudal hereditario en Cataluña.",
      },

      { type: "h2", text: "Comparativa numérica para grupo II" },
      { type: "h3", text: "Herencia de 100.000 €" },
      {
        type: "p",
        text: "Madrid: cuota estimada en torno a 90 €. Cataluña (tramo 99%): cuota estimada en torno a 90 €. La diferencia en este tramo es prácticamente nula.",
      },
      { type: "h3", text: "Herencia de 200.000 €" },
      {
        type: "p",
        text: "Madrid: ~240 € (1% de la cuota completa). Cataluña: ~720 € al pasar al tramo 97%. La diferencia ya es relevante: 480 € más en Cataluña.",
      },
      { type: "h3", text: "Herencia de 500.000 €" },
      {
        type: "p",
        text: "Madrid: ~870 €. Cataluña (tramo 90%): ~8.700 €. La diferencia ya es de unos 7.800 €.",
      },
      { type: "h3", text: "Herencia de 1.000.000 €" },
      {
        type: "p",
        text: "Madrid: ~2.140 €. Cataluña (tramo 70%): ~64.000 €. La diferencia supera los 60.000 €.",
      },

      { type: "h2", text: "Más allá del porcentaje: las reducciones previas" },
      {
        type: "p",
        text: "Tanto Madrid como Cataluña aplican las reducciones estatales del art. 20 Ley 29/1987 antes de calcular la cuota: parentesco, vivienda habitual (95% hasta 122.606,47 €), seguros de vida (9.195,49 € por beneficiario), empresa familiar, discapacidad. Estas reducciones reducen la base imponible antes de aplicar la tarifa.",
      },
      {
        type: "p",
        text: "Cataluña además permite reducciones autonómicas específicas para grupos I y II en la base imponible que pueden reducir significativamente el impacto fiscal en herencias medianas.",
      },

      { type: "h2", text: "Cuándo decidir el cambio de domicilio fiscal" },
      {
        type: "p",
        text: "Para que aplique la normativa de una CCAA distinta, el causante debe haber residido habitualmente en ella durante los 5 años anteriores al fallecimiento. Cambios recientes pueden ser revisados por la Administración como traslados artificiales.",
      },

      {
        type: "cta",
        title: "Calcula la diferencia exacta para tu caso",
        href: "/comparador-isd/cataluna-vs-madrid",
        label: "Ver comparativa interactiva →",
      },
    ],
  },

  {
    slug: "checklist-tramites-defuncion-espana",
    title: "Checklist completo de trámites tras una defunción en España",
    description:
      "Todos los trámites administrativos, fiscales y bancarios que hay que hacer tras un fallecimiento, ordenados por urgencia. Imprimible y descargable.",
    publishedAt: "2025-01-08",
    category: "Tramites",
    tags: ["checklist", "defuncion", "tramites", "guia"],
    readingMinutes: 9,
    lead: "Cuando fallece un familiar hay que hacer decenas de gestiones en diferentes administraciones, bancos y aseguradoras, todas con plazos distintos. Esta es la lista completa, ordenada por urgencia, para no olvidar nada.",
    blocks: [
      { type: "h2", text: "Primeras 24-72 horas" },
      {
        type: "ul",
        items: [
          "Certificado médico de defunción (lo emite el médico que constata el fallecimiento)",
          "Inscripción en el Registro Civil (la suele hacer la funeraria o el centro hospitalario)",
          "Solicitar el Certificado Literal de Defunción (necesitarás varias copias)",
          "Contactar con la funeraria y decidir tipo de servicio (sepelio, incineración)",
          "Comprobar si existe seguro de decesos contratado",
        ],
      },

      { type: "h2", text: "Primera semana" },
      {
        type: "ul",
        items: [
          "Bloquear cuentas bancarias del causante (algunas operaciones se permiten para gastos del sepelio)",
          "Solicitar al banco certificado de saldos a fecha de fallecimiento (necesario para el ISD)",
          "Cancelar tarjetas de crédito/débito",
          "Avisar a la Seguridad Social si recibía pensión (suele bastar con la inscripción en el Registro Civil, pero conviene confirmar)",
          "Solicitar el auxilio por defunción a la Seguridad Social si procede (~46 €)",
        ],
      },

      { type: "h2", text: "Días 15-30: certificados y testamento" },
      {
        type: "ul",
        items: [
          "Certificado de Últimas Voluntades (a partir del día 15 hábil)",
          "Certificado de Contratos de Seguros de Vida (RCSV) — mismo plazo",
          "Solicitar copia del testamento al notario (si existe)",
          "Si no hay testamento, iniciar trámite de declaración de herederos abintestato ante notario",
        ],
      },
      {
        type: "callout",
        tone: "info",
        title: "Cómo solicitarlos",
        text: "El Modelo 790 (código 006) cubre tanto Últimas Voluntades como RCSV. Se puede presentar online en la Sede del Ministerio de Justicia con certificado digital, o presencialmente en Gerencias Territoriales.",
      },

      { type: "h2", text: "Mes 1-2: aceptación de la herencia" },
      {
        type: "ul",
        items: [
          "Reunir documentación de bienes (escrituras, certificados de saldo, fichas técnicas de vehículos)",
          "Tasar inmuebles y valorar el patrimonio total",
          "Calcular la cuota fiscal estimada (tarifa estatal + bonificación CCAA)",
          "Si hay varios herederos, escritura de aceptación y partición ante notario",
          "Solicitar copia simple del Registro de la Propiedad para cada inmueble",
        ],
      },

      { type: "h2", text: "Antes del mes 5: prórroga del ISD si procede" },
      {
        type: "p",
        text: "Si la documentación no estará lista para presentar el Modelo 650 en 6 meses, solicita la prórroga (otros 6 meses) durante el mes 5. Después del quinto mes ya no es posible solicitarla.",
      },

      { type: "h2", text: "Antes del mes 6: presentación del ISD" },
      {
        type: "ul",
        items: [
          "Presentación del Modelo 650 — Impuesto sobre Sucesiones",
          "Plusvalía municipal por cada inmueble urbano (Modelo del ayuntamiento)",
          "Pago en metálico, con bienes o financiación si la cuota es elevada",
        ],
      },

      { type: "h2", text: "Cambios de titularidad" },
      {
        type: "ul",
        items: [
          "Bancos: traspaso de saldos a la cuenta de los herederos",
          "Inmuebles: cambio de titular en el Registro de la Propiedad",
          "Vehículos: en la Jefatura Provincial de Tráfico",
          "Suministros: luz, gas, agua (cambio de titular o baja)",
          "Telecomunicaciones: fijo, móvil, internet",
          "Comunidad de propietarios (si hay vivienda con cuotas)",
          "IBI municipal (Modelo 901N en el ayuntamiento)",
        ],
      },

      { type: "h2", text: "Reclamaciones de seguros de vida" },
      {
        type: "p",
        text: "Para cada seguro detectado en el RCSV: contactar con la aseguradora, presentar declaración de siniestro, certificado de defunción, DNI de los beneficiarios y certificado médico de causa de muerte. La aseguradora tiene 40 días naturales para abonar el capital.",
      },

      { type: "h2", text: "Otros trámites posibles" },
      {
        type: "ul",
        items: [
          "Cancelación de suscripciones (Netflix, Spotify, prensa, software)",
          "Cierre de redes sociales y memorialización (Facebook, Instagram tienen procesos específicos)",
          "Reclamación de prestaciones a empresas o mutualidades",
          "Cancelación de hipoteca si hay seguro de amortización vinculado",
          "Devolución de medicamentos y material sanitario",
        ],
      },

      {
        type: "cta",
        title: "Genera un expediente completo en 1 minuto",
        href: "/#demo",
        label: "Ver demo de BARITUR PRO →",
      },
    ],
  },

  {
    slug: "valor-referencia-catastro-isd",
    title: "El Valor de Referencia del Catastro: cómo afecta al Impuesto de Sucesiones",
    description:
      "Desde 2022 el Valor de Referencia del Catastro es la base mínima para tributar inmuebles en el ISD. Cómo consultarlo, impugnarlo y reducir su impacto.",
    publishedAt: "2025-01-18",
    category: "Fiscalidad",
    tags: ["valor referencia", "catastro", "inmuebles", "isd"],
    readingMinutes: 6,
    lead: "Desde 2022 el valor de los inmuebles en el ISD se determina por el Valor de Referencia del Catastro, salvo que se declare uno superior. Esto cambió radicalmente la estrategia para herencias con bienes inmuebles.",
    blocks: [
      { type: "h2", text: "Qué es el Valor de Referencia" },
      {
        type: "p",
        text: "Es el valor que la Dirección General del Catastro asigna anualmente a cada inmueble urbano y rústico, calculado a partir de los precios de mercado registrados en transacciones reales. No es el valor catastral (que se usa para el IBI) ni el valor de mercado.",
      },
      {
        type: "p",
        text: "Desde el 1 de enero de 2022 (Ley 11/2021), es la base mínima para tributar en ITP, ISD y AJD. Si declaras un valor inferior, Hacienda regularizará al alza.",
      },

      { type: "h2", text: "Cómo consultarlo" },
      {
        type: "p",
        text: "En la Sede Electrónica del Catastro (sede.catastro.gob.es) hay una herramienta de consulta gratuita. Necesitas la referencia catastral del inmueble (figura en el recibo del IBI o en la nota simple).",
      },
      {
        type: "callout",
        tone: "info",
        title: "Truco para herederos",
        text: "Si el causante había recibido alguna comunicación del Catastro o tiene escrituras recientes, conviene revisar el Valor de Referencia ANTES de presentar la autoliquidación del Modelo 650. El cálculo puede cambiar significativamente el resultado.",
      },

      { type: "h2", text: "Cómo impugnarlo" },
      {
        type: "p",
        text: "Si el Valor de Referencia es claramente superior al de mercado (por ejemplo, en barrios degradados, viviendas con vicios ocultos o en zonas con caída brusca de precios), se puede impugnar tras presentar la autoliquidación. Hay tres vías:",
      },
      {
        type: "ol",
        items: [
          "Solicitud de rectificación de la autoliquidación (declarando un valor menor)",
          "Recurso de reposición o reclamación económico-administrativa contra la liquidación que dicte Hacienda",
          "Tasación pericial contradictoria — un perito de parte fija un valor distinto y se tramita peritaje",
        ],
      },
      {
        type: "p",
        text: "La carga de la prueba es del contribuyente: hay que demostrar con tasaciones, comparables o datos de mercado que el Valor de Referencia es excesivo.",
      },

      { type: "h2", text: "Estrategia para herencias con varios inmuebles" },
      {
        type: "ul",
        items: [
          "Aplicar la reducción de vivienda habitual del 95% (hasta 122.606 €) a la vivienda con mayor Valor de Referencia",
          "Distribuir el resto entre herederos según convenga fiscalmente",
          "Si la herencia tiene rusticos con Valor de Referencia inflado, considerar tasación oficial",
          "En CCAA con tramos progresivos (Cataluña, Castilla-La Mancha), pequeñas variaciones del Valor de Referencia pueden cambiar de tramo",
        ],
      },

      { type: "h2", text: "Cuándo NO aplica el Valor de Referencia" },
      {
        type: "ul",
        items: [
          "Inmuebles sin Valor de Referencia asignado (algunos rústicos especiales)",
          "Bienes muebles, ajuar, vehículos (se valoran por su valor de mercado normal)",
          "Inmuebles del extranjero",
        ],
      },

      { type: "h2", text: "Caso práctico" },
      {
        type: "p",
        text: "Imagina una vivienda heredada en Madrid con valor catastral de 80.000 €, valor de mercado actual de 250.000 € y Valor de Referencia de 220.000 €. Para el ISD se declara 220.000 € (no 80.000 € ni el de mercado, salvo que el de mercado sea superior). Tras aplicar la reducción del 95% por vivienda habitual (con tope de 122.606 € por heredero), la base liquidable se reduce significativamente.",
      },

      {
        type: "cta",
        title: "Calcula el ISD con tus datos reales",
        href: "/calculadora-isd",
        label: "Abrir calculadora →",
      },
    ],
  },

  {
    slug: "que-es-grupo-parentesco-isd",
    title: "Grupos de parentesco en el Impuesto de Sucesiones: I, II, III y IV",
    description:
      "Cómo se clasifica el parentesco en el ISD según el art. 20 de la Ley 29/1987 y por qué determina cuánto pagas. Ejemplos de cada grupo con cifras.",
    publishedAt: "2025-01-22",
    category: "Fiscalidad",
    tags: ["grupos parentesco", "isd", "art 20", "ley 29/1987"],
    readingMinutes: 5,
    lead: "El parentesco con el causante es el factor que más influye en cuánto se paga de Impuesto de Sucesiones. La Ley 29/1987 los clasifica en 4 grupos, cada uno con reducciones, coeficientes multiplicadores y bonificaciones autonómicas distintas.",
    blocks: [
      { type: "h2", text: "Marco legal: art. 20.2 Ley 29/1987" },
      {
        type: "p",
        text: "El art. 20.2 de la Ley 29/1987 del Impuesto sobre Sucesiones y Donaciones establece 4 grupos según el grado de parentesco con el causante. Cada grupo tiene una reducción base distinta y un coeficiente multiplicador propio.",
      },

      { type: "h2", text: "Grupo I: descendientes y adoptados menores de 21 años" },
      {
        type: "p",
        text: "Hijos, nietos y demás descendientes (incluidos adoptados) menores de 21 años en el momento del fallecimiento. La reducción base es de 15.956,87 € más 3.990,72 € por cada año menos de 21, con un máximo de 47.858,59 €.",
      },
      {
        type: "callout",
        tone: "info",
        title: "Coeficiente multiplicador",
        text: "Para grupo I oscila entre 1,0 y 1,2 según el patrimonio preexistente del heredero. Es el coeficiente más bajo de los 4 grupos.",
      },

      { type: "h2", text: "Grupo II: descendientes ≥21, cónyuge y ascendientes" },
      {
        type: "p",
        text: "Engloba a hijos y descendientes mayores de 21 años, cónyuge (también pareja de hecho registrada en algunas CCAA), padres y demás ascendientes. La reducción base es de 15.956,87 €. Es el grupo más numeroso y al que aplican la mayoría de bonificaciones autonómicas.",
      },
      {
        type: "p",
        text: "El coeficiente multiplicador es 1,0 si el patrimonio preexistente del heredero es bajo, hasta 1,2 si es muy alto.",
      },
      {
        type: "callout",
        tone: "success",
        title: "Bonificaciones del 99% en grupo II",
        text: "Madrid, Andalucía, Galicia, Murcia, Castilla y León, Extremadura, La Rioja, Canarias y Comunitat Valenciana aplican el 99% de bonificación a grupo II. Baleares y Cantabria llegan al 100% en algunos tramos.",
      },

      { type: "h2", text: "Grupo III: colaterales de 2º y 3er grado" },
      {
        type: "p",
        text: "Hermanos, sobrinos, tíos y descendientes/ascendientes por afinidad (suegros, yernos, nueras). La reducción base es de 7.993,46 €.",
      },
      {
        type: "p",
        text: "El coeficiente multiplicador parte de 1,5882 y puede subir hasta 1,9059 con patrimonio preexistente alto. Casi el doble que el grupo II — la diferencia fiscal con grupo II es enorme.",
      },

      { type: "h2", text: "Grupo IV: colaterales de 4º grado, parientes lejanos y extraños" },
      {
        type: "p",
        text: "Primos, parientes consanguíneos lejanos y personas sin parentesco con el causante (amigos, cónyuge no registrado en CCAA donde no equivale a matrimonio). No hay reducción base por parentesco.",
      },
      {
        type: "p",
        text: "El coeficiente multiplicador parte de 2,0 y llega a 2,4 con patrimonio preexistente muy alto. Pagas más del doble que un familiar directo.",
      },

      { type: "h2", text: "Tabla resumen comparativa" },
      {
        type: "ul",
        items: [
          "Grupo I (hijos <21): reducción 15.956 € + 3.990 €/año < 21 (tope 47.858 €), coef 1,0-1,2",
          "Grupo II (hijos ≥21, cónyuge, padres): reducción 15.956 €, coef 1,0-1,2, casi todas las CCAA bonifican al 99%",
          "Grupo III (hermanos, sobrinos, tíos): reducción 7.993 €, coef 1,5882-1,9059, bonificación residual",
          "Grupo IV (primos, sin parentesco): sin reducción, coef 2,0-2,4, sin bonificación general",
        ],
      },

      { type: "h2", text: "Casos prácticos" },
      { type: "h3", text: "Hermano que hereda 100.000 € en Madrid (grupo III)" },
      {
        type: "p",
        text: "Reducción: 7.993,46 €. Base liquidable: 92.006,54 €. Cuota íntegra (tarifa estatal): ~10.700 €. Coeficiente 1,5882: cuota tributaria ~17.000 €. Madrid bonifica grupo III al 25% desde 2023, así que cuota a pagar ≈ 12.750 €.",
      },
      { type: "h3", text: "Hijo que hereda 100.000 € en Madrid (grupo II)" },
      {
        type: "p",
        text: "Reducción: 15.956,87 €. Base liquidable: 84.043,13 €. Cuota íntegra: ~9.450 €. Coeficiente 1,0: cuota tributaria 9.450 €. Madrid bonifica grupo II al 99%: cuota a pagar ≈ 95 €.",
      },
      {
        type: "p",
        text: "Diferencia entre grupos II y III por la misma herencia: 12.655 € en Madrid. En CCAA sin bonificación a grupo III, la diferencia puede superar los 16.000 €.",
      },

      {
        type: "cta",
        title: "Calcula tu caso con tu grupo de parentesco",
        href: "/calculadora-isd",
        label: "Abrir calculadora →",
      },
    ],
  },

  {
    slug: "como-evitar-recargo-modelo-650-fuera-plazo",
    title: "Cómo evitar el recargo del 5-20% si presentas el Modelo 650 fuera de plazo",
    description:
      "Estrategias para reducir el coste fiscal cuando se va a presentar el Impuesto de Sucesiones fuera del plazo de 6 meses: prórroga, autoliquidación parcial y regularización.",
    publishedAt: "2025-01-25",
    category: "Plazos",
    tags: ["modelo 650", "recargo", "fuera plazo", "lgt 27"],
    readingMinutes: 6,
    lead: "Si te das cuenta de que el plazo de 6 meses del Modelo 650 está vencido o a punto de vencer y la documentación no estará lista, no estás obligado a aceptar un recargo del 20%. Hay tres estrategias para reducir el coste fiscal según en qué momento te encuentres.",
    blocks: [
      { type: "h2", text: "Recargos del art. 27 LGT" },
      {
        type: "p",
        text: "Si presentas el Modelo 650 sin requerimiento previo de la Administración pero fuera de plazo, los recargos son:",
      },
      {
        type: "ol",
        items: [
          "Hasta 3 meses tarde: 5%",
          "Entre 3 y 6 meses tarde: 10%",
          "Entre 6 y 12 meses tarde: 15%",
          "Más de 12 meses tarde: 20% más intereses de demora desde el final del primer año",
        ],
      },
      {
        type: "callout",
        tone: "warning",
        title: "Recargo del 50% si Hacienda te requiere antes",
        text: "Si Hacienda te notifica un requerimiento antes de que presentes la autoliquidación, el recargo se eleva al 50% (sanción por infracción tributaria leve). Es fundamental presentarla por iniciativa propia aunque sea tarde.",
      },

      { type: "h2", text: "Estrategia 1: solicitar prórroga si aún estás en mes 5" },
      {
        type: "p",
        text: "Hasta el último día del quinto mes desde el fallecimiento puedes solicitar una prórroga de 6 meses adicionales. La prórroga aplaza el plazo hasta el mes 12 sin recargo, aunque devenga intereses de demora desde el final del mes 6.",
      },
      {
        type: "p",
        text: "Cómo: escrito dirigido a la oficina liquidadora competente (CCAA del causante). No se exige justificar la causa: cualquier motivo válido (pendiente de tasación, herederos en disputa, dificultad para reunir documentación) es aceptable.",
      },

      { type: "h2", text: "Estrategia 2: presentación parcial en plazo y rectificación posterior" },
      {
        type: "p",
        text: "Si tienes la mayor parte de la documentación pero falta algún dato puntual (por ejemplo, valoración pendiente de un inmueble menor o saldo de una cuenta secundaria), presenta la autoliquidación dentro del plazo de 6 meses con los datos disponibles, y solicita una rectificación cuando tengas todo.",
      },
      {
        type: "p",
        text: "La rectificación al alza no genera recargo si se hace en plazo de 4 años. La rectificación a la baja (quieres que te devuelvan) requiere acreditar el error.",
      },

      { type: "h2", text: "Estrategia 3: presentación tardía con recargo voluntario" },
      {
        type: "p",
        text: "Si has agotado los plazos de prórroga y la documentación sigue sin estar lista, lo mejor es presentar lo antes posible con un recargo del 5% (hasta el mes 9). Cada mes de retraso adicional aumenta significativamente el recargo.",
      },
      {
        type: "ol",
        items: [
          "Antes del mes 9: recargo 5% (sin intereses de demora)",
          "Mes 9 a 12: recargo 10% (sin intereses de demora)",
          "Mes 12 a 18: recargo 15% (sin intereses de demora)",
          "Después del mes 18: recargo 20% más intereses de demora desde el mes 12",
        ],
      },

      { type: "h2", text: "Riesgo añadido: pérdida de bonificaciones autonómicas" },
      {
        type: "callout",
        tone: "warning",
        title: "Algunas CCAA exigen presentación en plazo",
        text: "En determinadas CCAA y supuestos (reducción por empresa familiar, bonificación de vivienda habitual), la normativa exige que la autoliquidación se presente en plazo para mantener la bonificación. Una presentación tardía puede convertir una cuota de cero euros en una cuota completa. Verifica siempre la normativa de la CCAA del causante.",
      },

      { type: "h2", text: "Recomendaciones" },
      {
        type: "ul",
        items: [
          "Marca en el calendario los meses 4 y 5 como hitos de revisión: ¿está todo listo? ¿solicitamos prórroga?",
          "Si hay cualquier duda sobre tasaciones, escrituras o saldos, solicita la prórroga en el mes 4 sin esperar al 5",
          "Antes de presentar fuera de plazo, calcula si conviene esperar al pase de tramo (de 5% a 10%) o presentar ya",
          "Documenta por escrito cualquier comunicación con el cliente sobre los plazos para evitar responsabilidad profesional",
        ],
      },

      {
        type: "cta",
        title: "Detecta plazos críticos antes de que sea tarde",
        href: "/borrador-modelo650",
        label: "Generar borrador con plazos calculados →",
      },
    ],
  },

  {
    slug: "diferencia-modelo-650-modelo-651",
    title: "Modelo 650 vs Modelo 651: cuál se usa para herencia y cuál para donación",
    description:
      "Cómo distinguir el Modelo 650 (herencia mortis causa) del Modelo 651 (donaciones inter vivos). Cuándo aplica cada uno, plazos y consecuencias de presentar el equivocado.",
    publishedAt: "2025-01-28",
    category: "Tramites",
    tags: ["modelo 650", "modelo 651", "herencia", "donacion"],
    readingMinutes: 4,
    lead: "El Impuesto sobre Sucesiones y Donaciones tiene dos modelos distintos según el origen de la transmisión patrimonial: el Modelo 650 para sucesiones mortis causa y el Modelo 651 para donaciones inter vivos. Confundirlos es un error frecuente que puede tener consecuencias fiscales.",
    blocks: [
      { type: "h2", text: "Modelo 650: transmisiones mortis causa" },
      {
        type: "p",
        text: "El Modelo 650 se utiliza para autoliquidar el ISD cuando la transmisión patrimonial deriva del fallecimiento del causante. Es el modelo que se presenta tras una herencia, sea testada (con testamento) o intestada (declaración de herederos).",
      },
      {
        type: "ul",
        items: [
          "Plazo: 6 meses desde el fallecimiento, prorrogables a 12",
          "Sujeto pasivo: cada uno de los herederos por su parte",
          "Aplica reducciones del art. 20 (parentesco, vivienda, seguros, empresa familiar)",
          "Aplica bonificaciones autonómicas según CCAA del causante",
        ],
      },

      { type: "h2", text: "Modelo 651: donaciones inter vivos" },
      {
        type: "p",
        text: "El Modelo 651 se utiliza cuando el donante transmite un bien o derecho a otra persona sin contraprestación, estando ambos vivos. Aplica tanto a dinero como a inmuebles, vehículos, valores y otros derechos.",
      },
      {
        type: "ul",
        items: [
          "Plazo: 30 días hábiles desde la donación",
          "Sujeto pasivo: el donatario (quien recibe)",
          "Reducciones más limitadas que en sucesiones",
          "CCAA aplicable: la del donatario para bienes muebles, la de ubicación del inmueble si es donación de inmueble",
        ],
      },

      { type: "h2", text: "Diferencias clave" },
      {
        type: "callout",
        tone: "info",
        title: "Plazo y CCAA aplicable",
        text: "La diferencia más práctica está en el plazo (6 meses vs 30 días) y en la CCAA aplicable: en el 650 manda la residencia del causante, en el 651 depende del tipo de bien y de la residencia del donatario.",
      },

      { type: "h2", text: "Cuándo se acumulan donaciones previas a la herencia" },
      {
        type: "p",
        text: "Si el causante hizo donaciones a un heredero en los 4 años previos al fallecimiento, esas donaciones se acumulan a la base imponible de la herencia para evitar planificaciones fraudulentas. Esto exige presentar el Modelo 650 declarando también las donaciones acumulables.",
      },

      { type: "h2", text: "Casos donde la confusión es frecuente" },
      { type: "h3", text: "Cesión gratuita del usufructo" },
      {
        type: "p",
        text: "Si en vida el causante cedió el usufructo de un bien al cónyuge y luego este fallece, la consolidación del pleno dominio en el nudo propietario tributa como sucesión (Modelo 650), no como donación.",
      },
      { type: "h3", text: "Pareja de hecho con donación previa" },
      {
        type: "p",
        text: "Si se donó un piso a la pareja de hecho hace 6 años (sin acumulable) y luego fallece el donante, la donación ya no se acumula a la herencia. Pero si fue hace 2 años, sí se acumula.",
      },
      { type: "h3", text: "Renuncia y posterior donación" },
      {
        type: "p",
        text: "Renunciar a una herencia para que pase a otro familiar y luego este lo done de vuelta: Hacienda puede recalificarlo como herencia directa al supuesto donante para evitar la doble tributación.",
      },

      { type: "h2", text: "Consecuencias de presentar el modelo equivocado" },
      {
        type: "ul",
        items: [
          "Si el plazo del modelo correcto ya venció, recargo por presentación fuera de plazo",
          "Pérdida de reducciones específicas que solo aplican a uno u otro",
          "Riesgo de comprobación administrativa con sanciones por infracción tributaria",
          "En caso de inmuebles, problemas en el Registro de la Propiedad para inscribir la titularidad",
        ],
      },

      {
        type: "cta",
        title: "Calcula la cuota del Modelo 650 para tu herencia",
        href: "/calculadora-isd",
        label: "Abrir calculadora →",
      },
    ],
  },
];

export function getPostBySlug(slug: string): BlogPost | null {
  return BLOG_POSTS.find((p) => p.slug === slug) ?? null;
}

export function getRelatedPosts(currentSlug: string, n = 3): BlogPost[] {
  return BLOG_POSTS.filter((p) => p.slug !== currentSlug).slice(0, n);
}
