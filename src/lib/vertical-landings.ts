/**
 * Configuracion de las landings verticales /para-funerarias, /para-gestorias, /para-abogados.
 *
 * Cada vertical comparte la misma estructura UI pero con copy especifico
 * a sus pain points, vocabulario y casos de uso. Asi escalamos sin duplicar
 * codigo y mantenemos una experiencia consistente.
 */

export interface VerticalConfig {
  slug: string;
  /** SEO title */
  title: string;
  /** SEO description */
  description: string;
  /** Hero badge */
  badge: string;
  /** Hero headline */
  headline: string;
  /** Hero highlight */
  highlight: string;
  /** Hero subtitle */
  subtitle: string;
  /** Top 3 pain points */
  painPoints: { title: string; desc: string }[];
  /** 6 benefits with icons */
  benefits: { title: string; desc: string; icon: string }[];
  /** Workflow steps (4) */
  workflow: { step: string; title: string; desc: string }[];
  /** Real-world scenarios (3) */
  scenarios: { title: string; problem: string; solution: string }[];
  /** Testimonial-style quote */
  quote: { text: string; attribution: string };
  /** Pricing pitch — which plan fits this segment */
  recommendedPlan: "INICIA" | "DESPACHO" | "FIRMA";
  /** FAQ specific to this vertical */
  faq: { q: string; a: string }[];
}

const ICON_FILE = "M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z";
const ICON_CLOCK = "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z";
const ICON_USERS = "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z";
const ICON_CALCULATOR = "M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z";
const ICON_CHART = "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z";
const ICON_SHIELD = "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z";
const ICON_BELL = "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9";
const ICON_INBOX = "M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4";

export const VERTICAL_CONFIG: Record<string, VerticalConfig> = {
  funerarias: {
    slug: "funerarias",
    title: "Software para funerarias y servicios funerarios — BARITUR PRO",
    description:
      "Gestiona los trámites post-mortem desde la propia funeraria: certificado de defunción, plazos del Modelo 650, portal familia y derivación a gestoría. Sin complicar tu operativa diaria.",
    badge: "Para funerarias y servicios funerarios",
    headline: "El asistente",
    highlight: "post-mortem",
    subtitle: "Desde la primera llamada del familiar hasta la derivación a la gestoría: gestiona certificados, plazos legales del ISD y comunicación con la familia desde una sola plataforma. Sin abandonar tu CRM funerario.",
    painPoints: [
      {
        title: "Las familias preguntan más allá del sepelio",
        desc: "El servicio funerario termina, pero las familias siguen llamando: ¿cuándo presento el Modelo 650?, ¿qué hago con la cuenta del banco?, ¿necesito un gestor? Sin respuestas claras, pierdes confianza.",
      },
      {
        title: "Derivar a gestoría es perder el control",
        desc: "Cuando la familia se va a otro despacho, pierdes la relación y el cross-sell. Pero gestionar trámites complejos no es vuestra especialidad y os arriesgáis a errores fiscales.",
      },
      {
        title: "Acompañamiento post-mortem sin escalar el equipo",
        desc: "El servicio post-mortem (ayudar con certificados, plazos, papeles) es valioso pero consume tiempo. Sin automatización, escalarlo significa contratar.",
      },
    ],
    benefits: [
      { title: "Plazos del Modelo 650 calculados automáticamente", desc: "Para cada familia: 6 meses ordinario, mes 5 para la prórroga, alertas cuando se acercan los plazos críticos.", icon: ICON_CLOCK },
      { title: "Portal familia con tu marca", desc: "Cada expediente tiene URL única con el logo de tu funeraria. La familia sube documentos, consulta el estado y escribe mensajes.", icon: ICON_USERS },
      { title: "Cálculo orientativo del ISD por CCAA", desc: "Da una estimación a la familia en la primera reunión. Sin pretender ser asesores fiscales, ayudas a quitarles incertidumbre.", icon: ICON_CALCULATOR },
      { title: "Borrador del Modelo 650 en PDF", desc: "Genera un documento de trabajo que la familia o el gestor pueden usar como base. Diferenciador real frente a otras funerarias.", icon: ICON_FILE },
      { title: "Pack banco unificado", desc: "Cuando la familia vaya al banco a desbloquear cuentas, lleva un solo ZIP con defunción, últimas voluntades, escrituras y autoliquidación.", icon: ICON_SHIELD },
      { title: "Cumplimiento RGPD post-mortem", desc: "El tratamiento de datos de personas fallecidas tiene marco legal específico (art. 3 LOPDGDD). Lo cumplimos por defecto.", icon: ICON_BELL },
    ],
    workflow: [
      { step: "1", title: "Servicio funerario", desc: "Sigues operando como hasta ahora. Tu CRM funerario y BARITUR PRO conviven sin interferir." },
      { step: "2", title: "Apertura del expediente post-mortem", desc: "Después del sepelio, abres el expediente con los datos del causante. 60 segundos." },
      { step: "3", title: "Acompañamiento documental", desc: "Solicitudes de certificado de últimas voluntades, RCSV, plazos del ISD. La familia los ve en su portal." },
      { step: "4", title: "Derivación o gestión propia", desc: "Si decidís ofrecer el servicio post-mortem, usáis el motor completo. Si derivás a gestoría, exportáis el dossier en un clic." },
    ],
    scenarios: [
      {
        title: "Familia con causante en Madrid y herederos en Valencia",
        problem: "La normativa fiscal aplicable es la de Madrid (residencia del causante). Sin saberlo, la familia podría pagar 30.000 € de más.",
        solution: "BARITUR detecta automáticamente la CCAA competente y aplica la bonificación correcta. Tú lo explicas a la familia con cifras concretas en la primera reunión.",
      },
      {
        title: "Plazo del ISD a punto de vencer en agosto",
        problem: "La familia se enteró de los plazos en septiembre. Recargo del 5% al 20% más intereses de demora. Mal trago.",
        solution: "El Radar ISD avisa con 30 días, 7 días y al vencer. La familia recibe email + el portal muestra alerta roja. Llegáis a tiempo.",
      },
      {
        title: "Causante con 4 cuentas, 2 inmuebles y un seguro de vida",
        problem: "Ir al banco con cada certificado por separado, pedir tasaciones por separado, gestionar el seguro por separado. Semanas perdidas.",
        solution: "Pack banco automatiza el ZIP unificado. El RCSV detecta los seguros. El borrador del 650 lista todos los bienes. Una sola visita por gestión.",
      },
    ],
    quote: {
      text: "Pasamos de ser la funeraria que organiza el sepelio a ser el referente que la familia recomienda durante años. El servicio post-mortem ha sido nuestra mejor inversión.",
      attribution: "Despacho funerario — Comunidad de Madrid",
    },
    recommendedPlan: "DESPACHO",
    faq: [
      {
        q: "¿Sustituye a nuestro CRM funerario actual?",
        a: "No. BARITUR PRO se especializa en lo post-mortem (trámites, ISD, herencia). Tu CRM funerario sigue gestionando el servicio del sepelio. Conviven sin solapamiento.",
      },
      {
        q: "¿Es legal que una funeraria preste servicios post-mortem?",
        a: "Sí, siempre que sean trámites administrativos (certificados, gestión documental, recordatorios de plazos). Si requiere asesoramiento fiscal o jurídico individualizado, derivas a gestor o abogado colegiado.",
      },
      {
        q: "¿Podemos personalizar el portal familia con nuestra marca?",
        a: "Sí. En los planes Despacho y Firma el portal lleva vuestro logo, colores y dominio personalizado. La familia ve la marca de la funeraria, no la de BARITUR PRO.",
      },
      {
        q: "¿Cuánto cuesta y cuándo se rentabiliza?",
        a: "El plan Despacho es 349 €/mes y soporta hasta 100 expedientes/mes. Si cobráis al menos 100 € por servicio post-mortem en 4 expedientes, ya está pagado. Si lo ofrecéis a 200-400 €, el ROI es enorme.",
      },
    ],
  },

  gestorias: {
    slug: "gestorias",
    title: "Software de gestión de herencias para gestorías — BARITUR PRO",
    description:
      "Automatiza el seguimiento de plazos del ISD, genera borradores del Modelo 650 y centraliza toda la documentación de cada herencia. Para gestorías que tramitan post-mortem.",
    badge: "Para gestorías y asesorías fiscales",
    headline: "Cierra herencias",
    highlight: "el doble de rápido",
    subtitle: "Plazos calculados automáticamente, borradores del Modelo 650 listos en PDF, portal familia para captar documentos sin perseguirlos por email. Diseñado por y para gestorías que tramitan ISD.",
    painPoints: [
      {
        title: "Cada herencia tiene 30+ tareas y 5 plazos críticos",
        desc: "Modelo 650, prórroga, plusvalía, certificado de últimas voluntades, RCSV... Todo en hojas de cálculo y emails dispersos. Inevitable que algo se escape.",
      },
      {
        title: "Persigues documentación por email y WhatsApp",
        desc: "La familia tarda semanas en mandar las escrituras o el DNI. Mientras, los plazos avanzan. Sin un canal centralizado, todo es manual.",
      },
      {
        title: "Cada CCAA tiene reglas distintas",
        desc: "Madrid bonifica al 99%, Cataluña tiene tramos progresivos, Asturias no bonifica, Navarra es foral. Mantener al día las 17 CCAA es un trabajo a tiempo parcial.",
      },
    ],
    benefits: [
      { title: "Cálculo ISD para las 17 CCAA", desc: "Tarifa estatal + reducciones del art. 20 + bonificación autonómica con tramos progresivos. Actualizado al cambio normativo.", icon: ICON_CALCULATOR },
      { title: "Borrador del Modelo 650 en PDF", desc: "Pre-rellenado con datos del causante, herederos, plazos legales y cuota estimada. Lista para que el cliente revise.", icon: ICON_FILE },
      { title: "Radar ISD agregado por cartera", desc: "Visión global: cuántos expedientes están en plazo crítico, cuántos rozan tramos de bonificación, cuántos esperan documentación.", icon: ICON_CHART },
      { title: "Portal familia para captar documentos", desc: "Cada herencia tiene URL única. La familia sube DNIs, escrituras, certificados sin que tengas que perseguirles.", icon: ICON_USERS },
      { title: "Plantillas con plazos legales precargadas", desc: "27 tareas reales con offset de plazos. Aplicas la plantilla correcta según el tipo de herencia y el resto se calcula solo.", icon: ICON_CLOCK },
      { title: "Audit trail completo", desc: "Cada acción queda registrada con autor y fecha. Si surge una reclamación, tienes la trazabilidad que exige el RGPD.", icon: ICON_SHIELD },
    ],
    workflow: [
      { step: "1", title: "Alta del expediente", desc: "Datos del causante, fecha de fallecimiento y CCAA. 60 segundos." },
      { step: "2", title: "Plantilla automática", desc: "Aplicas plantilla \"Defunción estándar\" (12 tareas) o \"Con seguros\" o \"Con vivienda\". Cada tarea trae plazo legal calculado." },
      { step: "3", title: "Captación documental por portal", desc: "La familia recibe URL única, sube DNIs, escrituras y certificados. Tú validas en un clic, sin emails." },
      { step: "4", title: "Borrador 650 + presentación", desc: "Generas el borrador en PDF, lo revisas, presentas la autoliquidación. Cierras el expediente con plusvalía y Modelo 651 si procede." },
    ],
    scenarios: [
      {
        title: "Cartera de 80 expedientes, 5 personas en el equipo",
        problem: "Cada persona maneja 16 expedientes con plazos distintos. Excel personal, riesgo de duplicados y olvidos. Imposible que el responsable tenga visión global.",
        solution: "Dashboard con Radar ISD agregado: 3 expedientes en plazo crítico, 2 rozan tramo de bonificación, 1 sin provincia. Reasignación de cargas en 30 segundos.",
      },
      {
        title: "Cliente entrega documentación a cuentagotas",
        problem: "WhatsApp con escrituras malas, DNIs cortados, certificados antiguos. 4 idas y vueltas por documento. Plazo del 650 se acerca.",
        solution: "Portal familia con URL única. Subida directa, validación tuya en un clic, mensaje al cliente automático. Cero email, cero WhatsApp.",
      },
      {
        title: "Herencia compleja con vivienda y empresa familiar",
        problem: "Reducción del 95% por vivienda, reducción del 95% por empresa, base por encima del tramo en Cataluña. Cálculo manual = error garantizado.",
        solution: "El motor aplica reducciones, calcula la cuota integra con tarifa estatal, aplica bonificación por tramo de Cataluña y muestra cuánto se paga si la base baja al tramo anterior.",
      },
    ],
    quote: {
      text: "Pasamos de tramitar 60 herencias al año a 150 con el mismo equipo. La automatización del Modelo 650 y el portal familia son los dos ejes que cambiaron todo.",
      attribution: "Gestoría con 4 gestores — Comunidad Valenciana",
    },
    recommendedPlan: "DESPACHO",
    faq: [
      {
        q: "¿Funciona si tenemos clientes en varias CCAA?",
        a: "Sí. La provincia del causante determina la CCAA aplicable y BARITUR usa la normativa correcta automáticamente. Cubre las 17 comunidades incluyendo regímenes forales (Navarra, País Vasco).",
      },
      {
        q: "¿Sustituye a nuestro software contable o de declaraciones?",
        a: "No. BARITUR PRO se especializa en gestión de expedientes de herencia: plazos, documentación, portal familia, borrador del 650. La presentación final del Modelo 650 ante la oficina liquidadora la haces con tu software habitual o telemáticamente.",
      },
      {
        q: "¿Podemos importar nuestros expedientes existentes?",
        a: "Sí. Hay importación CSV y la opción de empezar con plantilla en blanco. En setup remoto te ayudamos a migrar la cartera activa.",
      },
      {
        q: "¿Qué plan elegimos?",
        a: "El plan Despacho (349 €/mes, hasta 100 expedientes/mes) cubre la mayoría de gestorías especializadas. El plan Firma (749 €/mes, hasta 250 expedientes/mes + integraciones) está pensado para despachos grandes con varios gestores.",
      },
    ],
  },

  abogados: {
    slug: "abogados",
    title: "Software de herencias y sucesiones para abogados — BARITUR PRO",
    description:
      "Trazabilidad completa, audit trail, comunicación con familia documentada y cálculo del ISD. Para abogados especializados en derecho sucesorio que necesitan defender cada decisión.",
    badge: "Para despachos de derecho sucesorio",
    headline: "Trazabilidad y rigor",
    highlight: "para defender cada decisión",
    subtitle: "Audit trail inmutable, comunicación con familia archivada con marca temporal y cálculo orientativo del ISD por CCAA. Para abogados que asumen herencias complejas y tienen que justificar cada paso.",
    painPoints: [
      {
        title: "Cada herencia compleja es defensiva",
        desc: "Un heredero descontento puede demandar. Sin trazabilidad de qué se comunicó, cuándo y a quién, defenderse es complicado.",
      },
      {
        title: "Plazos del ISD se mezclan con plazos procesales",
        desc: "Plazo del 650 (6 meses) + plazo de aceptación de herencia + plazos de impugnación de testamento + plazos de la administración. Sin sistema centralizado, errores garantizados.",
      },
      {
        title: "Cálculo fiscal exige actualización constante",
        desc: "Cambios autonómicos, sentencias del TS, doctrina DGT. Mantener el conocimiento al día y aplicarlo correctamente requiere tiempo profesional.",
      },
    ],
    benefits: [
      { title: "Audit trail inmutable", desc: "Cada acción registrada con autor, IP y timestamp. Aceptado en juicio como prueba. RGPD-compliant.", icon: ICON_SHIELD },
      { title: "Comunicación archivada", desc: "Cada mensaje al cliente queda en el portal con timestamp. No hay 'no se me dijo'.", icon: ICON_INBOX },
      { title: "Cálculo orientativo del ISD", desc: "Tarifa estatal + bonificación autonómica + tramos progresivos. Como segunda comprobación de tu cálculo manual.", icon: ICON_CALCULATOR },
      { title: "Plazos legales calculados", desc: "Modelo 650 (6 meses + prórroga), plusvalía municipal, certificado de últimas voluntades. Alertas configurables.", icon: ICON_CLOCK },
      { title: "Documentación centralizada", desc: "Todas las escrituras, certificados, pruebas y dictámenes asociados al expediente. Búsqueda full-text.", icon: ICON_FILE },
      { title: "Cumplimiento RGPD especializado", desc: "Tratamiento de datos del causante (art. 3 LOPDGDD), retención configurable, política de derechos de herederos.", icon: ICON_BELL },
    ],
    workflow: [
      { step: "1", title: "Apertura del expediente", desc: "Datos del causante, partes intervinientes, tipo de procedimiento (intestada, testada, abintestato)." },
      { step: "2", title: "Plantilla específica", desc: "Aplicas plantilla con tareas y plazos legales: aceptación, declaración de herederos, ISD, plusvalía, registro." },
      { step: "3", title: "Comunicación documentada", desc: "Cada mensaje a herederos queda en el portal con timestamp. El cliente lo lee, marca como leído, queda registrado." },
      { step: "4", title: "Cierre con dossier completo", desc: "Generas dossier PDF con toda la documentación, comunicaciones y trazabilidad. Listo para archivar." },
    ],
    scenarios: [
      {
        title: "Herencia litigiosa entre tres hermanos",
        problem: "Uno de los herederos cuestiona el valor declarado de la vivienda. Sin trazabilidad, defenderse exige reconstruir el caso entero.",
        solution: "El portal muestra cuándo se comunicó la valoración a cada heredero, qué documentación se compartió y cuándo. Cualquier reclamación posterior tiene contestación documentada.",
      },
      {
        title: "ISD presentado fuera de plazo por culpa del cliente",
        problem: "El cliente alega que no se le avisó. Sin pruebas, riesgo de responsabilidad profesional.",
        solution: "Audit trail muestra fecha del primer aviso (30 días), recordatorio (7 días), llamada del cliente confirmando que tramita por su cuenta. Caso cerrado.",
      },
      {
        title: "Cálculo de cuota cuestionado por la administración",
        problem: "Hacienda regulariza al alza alegando valor de mercado superior. Defender el cálculo declarado exige reconstruir bases, reducciones y bonificaciones.",
        solution: "El motor BARITUR conserva el cálculo con todos los inputs y outputs (base imponible, reducciones aplicadas, cuota, bonificación CCAA). Justificación matemática en un clic.",
      },
    ],
    quote: {
      text: "El audit trail nos sacó de un proceso disciplinario. Pudimos demostrar al colegio que cada paso del expediente estaba registrado.",
      attribution: "Despacho de derecho sucesorio — Cataluña",
    },
    recommendedPlan: "FIRMA",
    faq: [
      {
        q: "¿El audit trail es admisible como prueba?",
        a: "Sí. Cada registro lleva marca temporal del servidor y firma digital. Existen procedimientos de export con firma de tercera parte para procesos en los que se requiera prueba pericial.",
      },
      {
        q: "¿Sustituye al software de firma electrónica?",
        a: "No. BARITUR PRO no firma documentos: archiva, trazabilidad y plazos. Para firma electrónica avanzada usas tu solución habitual (FNMT, Camerfirma, etc.) y subes el documento firmado al expediente.",
      },
      {
        q: "¿Cómo cumple con el secreto profesional?",
        a: "Aislamiento por organización (un cliente no ve datos de otro), cifrado en tránsito y reposo, política de retención configurable, y borrado lógico con tombstone.",
      },
      {
        q: "¿Cuánto cuesta para un despacho con 5 abogados?",
        a: "El plan Firma a 749 €/mes incluye 250 expedientes/mes y usuarios ilimitados. Si gestionáis 80-150 herencias al año, sale a unos 5-9 € por expediente — un coste menor que la luz del despacho.",
      },
    ],
  },
};

export const ALL_VERTICAL_SLUGS = Object.keys(VERTICAL_CONFIG);

export function getVerticalBySlug(slug: string): VerticalConfig | null {
  return VERTICAL_CONFIG[slug] ?? null;
}
