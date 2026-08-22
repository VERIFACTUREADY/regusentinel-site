/**
 * Datos de partida para los smoke tests de navegador.
 *
 * Se crean con contraseña conocida para poder iniciar sesión de verdad desde
 * el navegador, sin mockear NextAuth.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { PORTAL_CONSENT_VERSION, PORTAL_CONSENT_HASH } from "../src/lib/portal-consent";
import { sumarDiasES, inicioDelDiaDeES, finDelDiaDeES } from "../src/lib/fecha-es";

const prisma = new PrismaClient();

export const E2E = {
  password: "PruebaE2E-2026!",
  owner: "owner.e2e@ejemplo.test",
  operador: "operador.e2e@ejemplo.test",
  manager: "manager.e2e@ejemplo.test",
  viewer: "viewer.e2e@ejemplo.test",
  expulsado: "expulsado.e2e@ejemplo.test",
  ownerSuspendido: "suspendido.e2e@ejemplo.test",
  orgSlug: "org-e2e",
  orgSuspendidaSlug: "org-e2e-suspendida",
  /**
   * Organizacion propia para las pruebas de /users.
   *
   * POR QUE APARTE
   * --------------
   * Cambiar roles y expulsar miembros altera la organizacion entera, y
   * `sesion-y-roles.spec.ts` y las suites cerradas dan por hecho que cada
   * usuario de `org-e2e` conserva SU rol. Con una organizacion propia se puede
   * degradar, promover y expulsar sin romper nada de lo ya aceptado.
   *
   * Ademas empieza SIN ninguna invitacion, que es lo que hace deterministe la
   * prueba del estado vacio del panel.
   */
  equipo: {
    slug: "org-e2e-equipo",
    /** Dos OWNER: hace falta un segundo para poder degradar a uno. */
    owner: "owner.equipo.e2e@ejemplo.test",
    owner2: "owner2.equipo.e2e@ejemplo.test",
    manager: "manager.equipo.e2e@ejemplo.test",
    operador: "operador.equipo.e2e@ejemplo.test",
    viewer: "viewer.equipo.e2e@ejemplo.test",
    /** Miembro de usar y tirar: es a quien se le cambia el rol. */
    cambiante: "cambiante.equipo.e2e@ejemplo.test",
    /** Miembro de usar y tirar: es a quien se expulsa. */
    expulsable: "expulsable.equipo.e2e@ejemplo.test",
  },
  /**
   * Segunda organizacion, sana y ajena.
   *
   * POR QUE EXISTE
   * --------------
   * El aislamiento entre organizaciones no se puede demostrar con una sola:
   * hace falta un documento REAL de otro tenant contra el que apuntar. La
   * organizacion suspendida no vale para esto, porque responde 402 por
   * suspension y taparia el 404 de autorizacion que es lo que se quiere probar.
   */
  orgAjena: {
    slug: "org-e2e-ajena",
    owner: "owner.ajena.e2e@ejemplo.test",
    caseRef: "EXP-2026-7000",
    documento: "SECRETO-DE-LA-ORGANIZACION-AJENA.pdf",
  },
  /**
   * Documentos de relleno para /documents.
   *
   * La pagina lista de 30 en 30: sin pasar de 30 el bloque de paginacion no se
   * pinta siquiera y "Siguiente"/"Anterior" quedarian sin cubrir. El prefijo
   * comun permite buscarlos y los dos origenes (equipo/familia) permiten
   * comprobar que el filtro cambia de verdad los resultados.
   */
  documentos: {
    prefijo: "D-E2E",
    /** Cuantos se siembran en el expediente principal. */
    total: 36,
    /** Nombre unico buscable, para la prueba de busqueda por nombre. */
    unico: "D-E2E-unico-escritura-notarial.pdf",
    /**
     * Portal familiar propio para las pruebas de documentos.
     *
     * Con token aparte a proposito: `smoke.spec.ts` comprueba que el portal
     * principal sigue SIN consentimiento aceptado, y estas pruebas lo aceptan
     * para poder subir. Compartir token haria que una suite rompiera a la otra
     * segun el orden de ejecucion.
     */
    portal: {
      caseRef: "EXP-2026-9600",
      token: "token-e2e-documentos-000000000000000000",
      /** Documento interno del expediente: la familia NO debe verlo. */
      interno: "D-E2E-INTERNO-NO-VISIBLE-PARA-FAMILIA.pdf",
      /** Documento compartido con la familia. */
      compartido: "D-E2E-compartido-con-familia.pdf",
    },
  },
  caseRef: "EXP-2026-9001",
  portalToken: "token-e2e-portal-de-pruebas-0000000000",
  /**
   * Expedientes ficticios de relleno.
   *
   * POR QUE EXISTEN
   * ---------------
   * Con un solo expediente en la base, la paginacion no se podia probar: el
   * bloque de paginas solo se pinta con `totalPages > 1`, asi que la prueba
   * se saltaba y la funcion quedaba sin cubrir. Tampoco habia con que
   * comprobar que los filtros de estado, categoria, provincia o urgencia
   * cambian de verdad los resultados: con una sola fila, cualquier filtro
   * "funciona".
   *
   * Son datos inventados para la base DESECHABLE de las pruebas. Nada de esto
   * toca produccion: `scripts/e2e.sh` recrea el esquema entero antes de
   * sembrar.
   */
  relleno: {
    prefijo: "EXP-2026-91",
    cuantos: 30,
    /** Nombre del causante, compartido para poder buscarlos en bloque. */
    apellido: "Rellenez",
  },
  /** Tamano de pagina del listado (`PAGE_SIZE` en /cases). */
  porPagina: 25,
  /**
   * Expediente dedicado al modulo de tareas.
   *
   * POR QUE UNO APARTE
   * ------------------
   * Las tareas de prueba necesitan estados, categorias, responsables y plazos
   * repartidos para que cada filtro de /tasks devuelva algo distinto. Colgarlas
   * de los expedientes de relleno mezclaria dos modulos: cualquier retoque aqui
   * movería los recuentos de /cases y romperia pruebas de expedientes por un
   * motivo que no tiene que ver con lo que comprueban.
   */
  tareas: {
    caseRef: "EXP-2026-9500",
    /** Prefijo de todos los titulos, para localizarlos sin ambigüedad. */
    prefijo: "T-E2E",
  },
  /**
   * Organizacion propia de /dashboard y /today.
   *
   * POR QUE APARTE
   * --------------
   * Los dos paneles son AGREGADOS: cuentan expedientes, tareas, aprobaciones y
   * mensajes de toda la organizacion. Sobre `org-e2e` no se podria afirmar
   * ninguna cifra exacta, porque cualquier prueba de expedientes, tareas o
   * documentos que cree o cierre algo movería los contadores y romperia estas
   * por un motivo ajeno. Aqui las cantidades estan puestas a mano y NADIE mas
   * escribe en esta organizacion.
   *
   * Todas las cifras de PANEL (mas abajo) se derivan de estas listas, para que
   * las pruebas no repitan numeros magicos que despues se olvide actualizar.
   */
  panel: {
    slug: "org-e2e-panel",
    owner: "owner.panel.e2e@ejemplo.test",
    manager: "manager.panel.e2e@ejemplo.test",
    operador: "operador.panel.e2e@ejemplo.test",
    viewer: "viewer.panel.e2e@ejemplo.test",
    /** Prefijo de todos los titulos de tarea, para localizarlos. */
    prefijo: "P-E2E",
    /** Expediente principal, con plazos repartidos alrededor de hoy. */
    caseRef: "EXP-2026-8000",
    /** Segundo expediente, para que «Expedientes recientes» tenga orden. */
    caseRef2: "EXP-2026-8001",
    /** Expediente ya cerrado ESTE MES: alimenta el KPI «Cerrados este mes». */
    caseRefCerrado: "EXP-2026-8002",
    /** Expediente con fallecimiento hace 165 dias: ISD critico (<30 dias). */
    caseRefIsd: "EXP-2026-8003",
    causanteIsd: "Causante ISD Critico E2E",
    /** Aprobacion pendiente: alimenta el KPI y la seccion de /today. */
    accionAprobacion: "send_email",
    /** Mensaje sin leer de la familia. */
    mensajeFamilia: "Mensaje de familia sin leer E2E",
    autorMensaje: "Familiar Panel E2E",
  },
  /**
   * Organizacion vecina del panel, con datos que NUNCA deben aparecer.
   *
   * Un contador que filtre mal por `orgId` tambien es una fuga: por eso hay
   * aqui expedientes, tareas, aprobaciones y mensajes con marcas inconfundibles.
   */
  panelVecina: {
    slug: "org-e2e-panel-vecina",
    owner: "owner.vecina.e2e@ejemplo.test",
    caseRef: "EXP-2026-8900",
    causante: "NO-DEBE-VERSE-Causante-Vecino",
    tarea: "NO-DEBE-VERSE-tarea-vecina",
    mensaje: "NO-DEBE-VERSE-mensaje-vecino",
  },
  /**
   * Organizacion recien creada para el panel de primeros pasos.
   *
   * Sin expedientes, sin fecha de fallecimiento y sin marca: los cuatro pasos
   * del onboarding empiezan sin hacer, que es la unica forma de comprobar el
   * progreso y la desaparicion del panel.
   */
  panelNueva: {
    slug: "org-e2e-panel-nueva",
    owner: "owner.nueva.e2e@ejemplo.test",
  },
  /**
   * Organizacion propia de /messages, /notifications, la campana y /approvals.
   *
   * POR QUE APARTE
   * --------------
   * Igual que el panel: estas cuatro pantallas cuentan y filtran sobre TODA la
   * organizacion. Sobre `org-e2e` cualquier prueba de expedientes o del portal
   * que escriba un mensaje movería los contadores. Y aqui ademas hay que
   * marcar mensajes como leidos y aprobar cosas, que son escrituras que dejan
   * huella: mezclarlas con `org-e2e-panel` romperia las cifras que las pruebas
   * del panel afirman.
   */
  avisos: {
    slug: "org-e2e-avisos",
    owner: "owner.avisos.e2e@ejemplo.test",
    manager: "manager.avisos.e2e@ejemplo.test",
    operador: "operador.avisos.e2e@ejemplo.test",
    /** VIEWER: tiene `cases.read` pero NO `cases.update` ni `autopilot.approve`. */
    viewer: "viewer.avisos.e2e@ejemplo.test",

    /** Conversacion con 2 mensajes de familia SIN leer. */
    caseConDos: "EXP-2026-7100",
    /** Conversacion con 1 mensaje de familia SIN leer. */
    caseConUno: "EXP-2026-7101",
    /** Conversacion con todo leido: sale en «Todos», no en «Sin leer». */
    caseLeido: "EXP-2026-7102",
    /** Expediente SIN ningun mensaje: no debe salir en ninguna de las dos. */
    caseSinMensajes: "EXP-2026-7103",

    autorFamilia: "Familiar Avisos E2E",
    /** Texto reconocible del primer mensaje sin leer. */
    textoSinLeer: "Mensaje sin leer de la familia",
    textoLeido: "Mensaje ya leido de la familia",

    /** Aprobaciones pendientes que se pueden aprobar/rechazar sin miedo. */
    accionAprobar: "send_draft",
    accionRechazar: "send_email",
    /** Detalle largo, para la prueba de «Ver detalle». */
    detalleAprobacion: "Borrador para la familia:\nEstimada familia, adjuntamos el certificado.",
    /** Detalle con marcado HTML: debe verse COMO TEXTO, no interpretarse. */
    detalleConHtml: "<img src=x onerror=alert(1)> <b>negrita</b> & <script>alert(2)</script>",
  },
  /**
   * Organizacion dedicada a la PAGINACION de /approvals.
   *
   * POR QUE OTRA MAS
   * ----------------
   * La cola pagina de 30 en 30, asi que para probarla de verdad hacen falta
   * mas de 30 aprobaciones. Metiendolas en `org-e2e-avisos` reventaria todas
   * las cifras que las demas pruebas afirman alli —tres pendientes, una
   * aprobada, una rechazada—. Con organizacion propia, cada suite afirma
   * numeros exactos sin estorbarse.
   */
  aprobacionesPag: {
    slug: "org-e2e-aprobaciones-pag",
    owner: "owner.aprobpag.e2e@ejemplo.test",
    /** Prefijo de las referencias: cada aprobacion cuelga de su expediente. */
    prefijoRef: "EXP-2026-72",
  },
  /**
   * Organizacion propia de /workflow-rules, /workflow-logs y /audit.
   *
   * POR QUE APARTE
   * --------------
   * Las tres pantallas son AGREGADOS de toda la organizacion: cuentan
   * ejecuciones, calculan una tasa de exito y paginan la traza de auditoria.
   * Sobre cualquier organizacion compartida no se podria afirmar ni una cifra,
   * porque cada prueba de expedientes, tareas o usuarios escribe en la
   * auditoria y moveria los totales.
   */
  automatizaciones: {
    slug: "org-e2e-automatizaciones",
    owner: "owner.auto.e2e@ejemplo.test",
    manager: "manager.auto.e2e@ejemplo.test",
    /** OPERATOR: tiene `workflow.read` y `audit.read`, pero NO `workflow.manage`. */
    operador: "operador.auto.e2e@ejemplo.test",
    viewer: "viewer.auto.e2e@ejemplo.test",

    /** Expediente sobre el que se prueban y disparan las reglas. */
    caseRef: "EXP-2026-7300",
    causante: "Causante Automatizaciones E2E",

    /** Regla activa, con nombre reconocible para los nombres accesibles. */
    reglaActiva: "Comentar al cambiar de estado",
    /** Regla desactivada: sirve para probar la activacion. */
    reglaInactiva: "Avisar al equipo (desactivada)",
    /** Regla de usar y tirar: es la que se elimina. */
    reglaBorrable: "Regla que se puede borrar",
    /** Comentario que deja la regla activa al ejecutarse. */
    textoComentario: "Comentario puesto por la automatizacion E2E",

    /*
     * Regla de CORREO, para poder probar «Reintentar fallidas» de verdad.
     *
     * La regla de comentario no sirve: un comentario no tiene destinatarios,
     * asi que no genera entregas y no hay nada que reintentar. El reintento
     * solo tiene sentido sobre un envio, y solo se puede comprobar mirando el
     * buzon de pruebas.
     */
    reglaCorreo: "Avisar al equipo por correo",
    asuntoCorreo: "Aviso de automatizacion E2E",
    /*
     * Los destinatarios de SEND_EMAIL_TEAM no se guardan en la regla: el motor
     * los saca de las membresias OWNER y MANAGER de la organizacion. Por eso
     * las entregas sembradas llevan esas dos direcciones y no unas inventadas:
     * son las que el reintento va a reconstruir.
     */
    /** Su entrega quedo en FAILED: el reintento debe alcanzarle. */
    destinatarioFallido: "manager.auto.e2e@ejemplo.test",
    /**
     * Su entrega ya esta en SENT. El reintento NO debe volver a escribirle:
     * quien ya recibio el aviso no lo recibe otra vez porque alguien pulse el
     * boton.
     */
    destinatarioEntregado: "owner.auto.e2e@ejemplo.test",

    /*
     * Registros de auditoria con fecha puesta a proposito en los bordes del
     * dia civil espanol, para comprobar el filtro «Desde»/«Hasta».
     *
     * Con el filtro anterior (dias UTC) el de las 00:30 de hoy caia en el dia
     * de AYER —porque en Madrid, en horario de verano, la medianoche UTC son
     * las 02:00— y el de las 23:30 de ayer se colaba en HOY. Las dos mitades
     * del rango estaban desplazadas y en sentidos contrarios.
     */
    accionBorde: "portal.borde_de_dia_e2e",
    detalleHoyTemprano: "Auditoria de HOY a las 00:30 de Madrid",
    detalleAyerTarde: "Auditoria de AYER a las 23:30 de Madrid",

    /**
     * Detalle con comillas, comas y acentos: el CSV tiene que sobrevivir a los
     * tres. Sin comillas escapadas el fichero se parte en columnas de mas.
     */
    accionCsv: "portal.exportacion_csv_e2e",
    detalleCsv: 'Detalle con "comillas", coma y acentuacion: ñáéíóú',
  },
  /** Organizacion vecina de las automatizaciones: nada suyo puede filtrarse. */
  automatizacionesVecina: {
    slug: "org-e2e-automatizaciones-vecina",
    owner: "owner.autovecina.e2e@ejemplo.test",
    caseRef: "EXP-2026-7950",
    regla: "NO-DEBE-VERSE-regla-vecina",
    accionAuditoria: "NO_DEBE_VERSE.accion_vecina",
  },
  /**
   * Organizacion DEDICADA a los disparadores automaticos y a la idempotencia.
   *
   * POR QUE OTRA ORGANIZACION MAS
   * -----------------------------
   * Estas pruebas cuentan CORREOS EN EL BUZON y FILAS EN LA BASE, y las cifras
   * tienen que ser exactas: «un solo correo por destinatario», «una sola
   * ejecucion». En `org-e2e-automatizaciones` hay reglas activas sembradas que
   * se disparan con `CASE_STATUS_CHANGED`, asi que cualquier prueba que toque
   * un expediente de alli mete correos y ejecuciones de por medio.
   *
   * Aqui NO se siembra ninguna regla activa: las crean las pruebas por la
   * interfaz, que es ademas lo que exige el encargo. Lo unico sembrado son la
   * organizacion, sus cuatro roles, un expediente con contacto y unas tareas.
   */
  disparadores: {
    slug: "org-e2e-disparadores",
    /** OWNER y MANAGER son los destinatarios reales de SEND_EMAIL_TEAM. */
    owner: "owner.disp.e2e@ejemplo.test",
    manager: "manager.disp.e2e@ejemplo.test",
    /** OPERATOR y VIEWER NO deben recibir el aviso del equipo. */
    operador: "operador.disp.e2e@ejemplo.test",
    viewer: "viewer.disp.e2e@ejemplo.test",

    caseRef: "EXP-2026-7600",
    causante: "Causante Disparadores E2E",
    /** Destinatario de SEND_EMAIL_CONTACT: el contacto del expediente. */
    contacto: "familia.disp.e2e@ejemplo.test",
    contactoNombre: "Familia Disparadores E2E",
    orgNombre: "Gestoria Disparadores E2E",

    /** Tarea que las pruebas mueven de estado una y otra vez. */
    tarea: "Tarea que cambia de estado",
    /** Segunda tarea, de otra categoria, para el caso negativo de condiciones. */
    tareaOtraCategoria: "Tarea de otra categoria",

    /** Expediente aparte para el borde de ejecucion parcial. */
    caseRefParcial: "EXP-2026-7601",
  },
  /** Organizacion vecina de la anterior: nada suyo puede filtrarse. */
  avisosVecina: {
    slug: "org-e2e-avisos-vecina",
    owner: "owner.avisosvecina.e2e@ejemplo.test",
    caseRef: "EXP-2026-7900",
    mensaje: "NO-DEBE-VERSE-mensaje-de-la-vecina",
    autor: "NO-DEBE-VERSE-familiar-vecino",
  },
};

/** Cuantos registros de notificacion se siembran. */
const TOTAL_NOTIFICACIONES = 34;

/** Cuantos de ellos cumplen la condicion, con la misma regla del sembrado. */
function contarNotificaciones(cumple: (i: number) => boolean): number {
  let n = 0;
  for (let i = 0; i < TOTAL_NOTIFICACIONES; i++) if (cumple(i)) n++;
  return n;
}

/**
 * Cifras de los avisos, derivadas del sembrado de mas abajo.
 *
 * Se calculan aqui para que las pruebas no repitan numeros magicos: si alguien
 * cambia el reparto, las afirmaciones le siguen solas.
 */
export const CIFRAS_AVISOS = {
  /** Mensajes de familia sin leer en toda la organizacion (2 + 1). */
  totalSinLeer: 3,
  /** Conversaciones con al menos un mensaje sin leer. */
  conversacionesSinLeer: 2,
  /** Conversaciones con algun mensaje, leido o no. */
  conversacionesTotales: 3,
  /** Aprobaciones PENDIENTES. */
  aprobacionesPendientes: 3,
  /** Aprobaciones ya aprobadas. */
  aprobacionesAprobadas: 1,
  /** Aprobaciones ya rechazadas. */
  aprobacionesRechazadas: 1,
  /**
   * Registros de notificacion sembrados.
   *
   * Mas de 30 a proposito: `/notifications` pagina de 30 en 30 y sin pasar de
   * esa cifra el bloque de paginacion no se pinta siquiera.
   */
  notificaciones: TOTAL_NOTIFICACIONES,
  /**
   * Cuantas fallaron y cuantas van a la familia.
   *
   * Se CALCULAN con la misma regla que las siembra, no se cuentan a mano: la
   * primera version decia 8 donde habia 9 y el descuadre solo aparecio al
   * comprobarlo contra la base. Asi no puede volver a pasar.
   */
  notificacionesFallidas: contarNotificaciones((i) => i % 8 === 3),
  notificacionesFamilia: contarNotificaciones((i) => i % 4 === 1),
  /** Cuantas son de tipo «ISD 7 dias» (indice 2 de la lista de TIPOS). */
  notificacionesIsd7d: contarNotificaciones((i) => i % 5 === 2),
  /** Y de esas, cuantas ademas fallaron. */
  notificacionesIsd7dFallidas: contarNotificaciones((i) => i % 5 === 2 && i % 8 === 3),
};

/**
 * Reancla la tarea «vence hoy» al FINAL DEL DIA CIVIL DE AHORA MISMO.
 *
 * POR QUE NO BASTA CON SEMBRARLA BIEN
 * -----------------------------------
 * El plazo tiene que cumplir dos cosas a la vez cuando la prueba lo mira: que
 * siga siendo HOY, y que siga estando en el FUTURO —el bloque «Plazos
 * proximos» consulta `deadline >= ahora`—. Cualquier instante fijo elegido al
 * sembrar deja de cumplir una de las dos segun cuando corra la prueba:
 *
 *   - anclado al MEDIODIA, se quedaba en el pasado a partir de las 12:00 de
 *     Madrid: la suite fallaba TODAS LAS TARDES;
 *   - anclado al FINAL DEL DIA, sobrevive la jornada entera, pero si el
 *     sembrado ocurre a las 23:56 y la prueba corre veinte minutos despues, el
 *     dia civil ya ha cambiado y el plazo ha quedado atras. Eso es justo lo
 *     que paso en una ejecucion de CI que empezo a las 23:56 de Madrid.
 *
 * El hueco entre sembrar y comprobar es de veinte minutos, y no hay instante
 * que aguante eso cruzando la medianoche. La solucion es no depender del
 * momento del sembrado: se reancla justo antes de mirar, con lo que la ventana
 * de riesgo pasa de veinte minutos a los segundos que tarda la prueba.
 */
export async function reanclarVenceHoy(prisma: PrismaClient): Promise<void> {
  const finDeHoy = finDelDiaDeES(new Date());
  await prisma.task.updateMany({
    where: { title: `${E2E.panel.prefijo} vence hoy` },
    data: { deadline: finDeHoy },
  });
}

/** Tamano de pagina de /approvals (`PAGE_SIZE` en `approvals-queue.tsx`). */
export const APROBACIONES_POR_PAGINA = 30;

/** Tamano de pagina de /workflow-logs y /audit. */
export const REGISTROS_POR_PAGINA = 30;

/** Cuantas ejecuciones de flujo se siembran. */
const TOTAL_EJECUCIONES = 34;

function contarEjecuciones(cumple: (i: number) => boolean): number {
  let n = 0;
  for (let i = 0; i < TOTAL_EJECUCIONES; i++) if (cumple(i)) n++;
  return n;
}

/**
 * Reparto de las ejecuciones de flujo.
 *
 * Las cifras se CALCULAN con la misma regla que las siembra: contarlas a mano
 * ya me salio mal una vez en esta auditoria y el descuadre solo aparecio al
 * comprobarlo contra la base.
 */
export const CIFRAS_AUTOMATIZACIONES = {
  ejecuciones: TOTAL_EJECUCIONES,
  exitosas: contarEjecuciones((i) => i % 5 === 0 || i % 5 === 1),
  parciales: contarEjecuciones((i) => i % 5 === 2),
  fallidas: contarEjecuciones((i) => i % 5 === 3),
  omitidas: contarEjecuciones((i) => i % 5 === 4),
  /**
   * Ejecucion extra de la regla de correo, con entregas reales: es la unica
   * que ofrece «Reintentar fallidas», porque es la unica que tiene entregas
   * pendientes de verdad.
   */
  conEntregas: 1,
  /**
   * Registros de auditoria de relleno: mas de 30 para que la paginacion
   * exista. Aparte van los dos con fecha de borde y el del CSV.
   */
  auditoria: 34,
  /** Los de borde de dia (2) mas el de comillas y acentos (1). */
  auditoriaExtra: 3,
  get auditoriaTotal() {
    return this.auditoria + this.auditoriaExtra;
  },
};

/**
 * Reparto de la organizacion de paginacion.
 *
 * 35 pendientes: dos paginas (30 + 5), que es lo que se necesita para pulsar
 * «Siguiente» y «Anterior» de verdad. Las aprobadas y rechazadas sirven para
 * comprobar que cambiar de pestaña vuelve a la pagina 1 y que cada filtro
 * cuenta lo suyo.
 */
export const CIFRAS_APROBACIONES_PAG = {
  pendientes: 35,
  aprobadas: 3,
  rechazadas: 2,
  get total() {
    return this.pendientes + this.aprobadas + this.rechazadas;
  },
};

/**
 * Tareas del expediente principal del panel.
 *
 * `dias` es el desplazamiento del PLAZO respecto a hoy, contado en dias de
 * calendario espanol. Se reparten a mano para poder afirmar cifras exactas y
 * para cubrir los bordes que pide la auditoria: hoy, +7, +30 y fuera de rango.
 */
export const TAREAS_PANEL: {
  titulo: string;
  estado: "PENDING" | "IN_PROGRESS" | "BLOCKED" | "READY" | "DONE" | "SKIPPED";
  /** Responsable: `owner` es quien mira el panel en la mayoria de pruebas. */
  responsable: "owner" | "manager" | null;
  dias: number | null;
  /** Dias que lleva bloqueada (solo para las BLOCKED). */
  bloqueadaDesdeHace?: number;
  /**
   * Ancla el plazo a `ahora + dias` con un margen, en vez de al mediodia del
   * dia civil. Para los bordes de ventanas rodantes.
   */
  rodante?: boolean;
}[] = [
  // ── Vencidas del owner (alimentan «Requiere accion inmediata» y /today) ──
  { titulo: "vencida hace 3 dias", estado: "PENDING", responsable: "owner", dias: -3 },
  { titulo: "vencida hace 10 dias", estado: "IN_PROGRESS", responsable: "owner", dias: -10 },
  // ── Bordes exactos que pide la auditoria ──
  { titulo: "vence hoy", estado: "PENDING", responsable: "owner", dias: 0 },
  { titulo: "vence en 7 dias", estado: "PENDING", responsable: "owner", dias: 7 },
  /*
   * Los dos bordes del rango de 30 dias van RODANTES, no al mediodia civil.
   *
   * «Plazos proximos (30 dias)» consulta `deadline` entre `now` y
   * `now + 30x24h`: una ventana rodante, no un rango de dias de calendario.
   * Anclando estos dos al mediodia del dia civil, el de 30 dias caia dentro o
   * fuera segun la hora a la que se ejecutara la suite —fuera si era de
   * madrugada, dentro si era de tarde—. Se siembran en los mismos terminos que
   * la regla que prueban, con un margen que los deja a un lado y al otro sin
   * depender del reloj.
   */
  { titulo: "vence en 30 dias", estado: "PENDING", responsable: "owner", dias: 30, rodante: true },
  // 31 dias: queda JUSTO fuera de «Plazos proximos (30 dias)».
  { titulo: "vence en 31 dias fuera de rango", estado: "PENDING", responsable: "owner", dias: 31, rodante: true },
  { titulo: "vence en 3 dias", estado: "PENDING", responsable: "owner", dias: 3 },
  // ── Del equipo, vencida: /today la lista aparte de las mias ──
  { titulo: "vencida del manager", estado: "PENDING", responsable: "manager", dias: -6 },
  // ── Bloqueadas: los tres lados del corte de 7 dias ──
  { titulo: "bloqueada 6 dias no entra", estado: "BLOCKED", responsable: "owner", dias: 12, bloqueadaDesdeHace: 6 },
  { titulo: "bloqueada 8 dias si entra", estado: "BLOCKED", responsable: "owner", dias: 14, bloqueadaDesdeHace: 8 },
  { titulo: "bloqueada 20 dias si entra", estado: "BLOCKED", responsable: "manager", dias: 16, bloqueadaDesdeHace: 20 },
  // ── Listas y terminadas: alimentan los KPI «Listas» y la carga del equipo ──
  { titulo: "lista para accion", estado: "READY", responsable: "owner", dias: 18 },
  { titulo: "ya terminada", estado: "DONE", responsable: "manager", dias: -1 },
  { titulo: "sin asignar pendiente", estado: "PENDING", responsable: null, dias: 25 },
];

/**
 * Cifras que las pruebas afirman, calculadas AQUI a partir del reparto de
 * arriba.
 *
 * Se derivan en vez de escribirse a mano para que anadir una tarea al reparto
 * no obligue a acordarse de tocar seis numeros sueltos en dos ficheros: si
 * alguien cambia `TAREAS_PANEL`, estos valores le siguen solos.
 */
export const CIFRAS_PANEL = {
  /**
   * KPI «Tareas pendientes»: PENDING + IN_PROGRESS de TODA la organizacion.
   *
   * El `+ 1` es la tarea «desbloqueada por su prerrequisito», que vive en el
   * segundo expediente y no esta en `TAREAS_PANEL`. Se suma explicitamente en
   * vez de dejar el numero a mano para que siga cuadrando si alguien anade
   * tareas al reparto de arriba.
   */
  tareasPendientes:
    TAREAS_PANEL.filter((t) => t.estado === "PENDING" || t.estado === "IN_PROGRESS")
      .length + 1,
  /** KPI «Tareas bloqueadas». */
  tareasBloqueadas: TAREAS_PANEL.filter((t) => t.estado === "BLOCKED").length,
  /** KPI «Listas para accion». */
  tareasListas: TAREAS_PANEL.filter((t) => t.estado === "READY").length,
  /** Mis tareas vencidas (owner, plazo en el pasado, sin terminar). */
  vencidasDelOwner: TAREAS_PANEL.filter(
    (t) =>
      t.responsable === "owner" &&
      t.dias !== null &&
      t.dias < 0 &&
      t.estado !== "DONE" &&
      t.estado !== "SKIPPED",
  ).length,
  /** Bloqueadas mas de 7 dias: las que salen en el bloque «+7 dias». */
  bloqueadasCriticas: TAREAS_PANEL.filter(
    (t) => t.estado === "BLOCKED" && (t.bloqueadaDesdeHace ?? 0) > 7,
  ).length,
  /*
   * NO hay cifra para «Plazos proximos (30 dias)» a proposito.
   *
   * El bloque se comprueba por TITULOS —que el de 30 dias esta y el de 31 no—,
   * que es ademas lo que interesa: el borde del rango. Una cifra exacta
   * obligaria a mantener a mano un total que cambia cada vez que se anade una
   * tarea de apoyo a cualquier otra prueba.
   *
   * (La tarea «vence hoy» SI entra siempre desde que su plazo se ancla al
   * final de su dia civil espanol; ver `plazoDelDia`. Antes iba al mediodia y
   * desaparecia de la lista a partir de las 12:00 de Madrid.)
   */
  /** KPI «Expedientes activos»: los cuatro menos el cerrado. */
  expedientesActivos: 3,
  /** KPI «Cerrados este mes». */
  cerradosEsteMes: 1,
  /** KPI «Aprobaciones pend.» y seccion de /today. */
  aprobacionesPendientes: 2,
  /** Expedientes con al menos un mensaje de familia sin leer. */
  expedientesConMensajes: 1,
  /** Mensajes de familia sin leer (contador del panel). */
  mensajesSinLeer: 2,
};

/**
 * Tareas de prueba del modulo de tareas.
 *
 * Repartidas a mano —no al azar— para que las pruebas puedan afirmar cantidades
 * exactas. `dias` es el desplazamiento del plazo respecto a hoy: negativo =
 * vencida, `null` = sin plazo (y por tanto fuera del cronograma).
 */
const TAREAS_E2E: {
  titulo: string;
  estado: "PENDING" | "IN_PROGRESS" | "BLOCKED" | "READY" | "DONE" | "SKIPPED";
  categoria: "BANCOS" | "SEGUROS" | "SUMINISTROS" | "FISCAL" | "TELECOM" | "OTROS";
  responsable: "owner" | "operador" | null;
  dias: number | null;
}[] = [
  { titulo: "vencida del owner",        estado: "PENDING",     categoria: "BANCOS",      responsable: "owner",    dias: -5 },
  { titulo: "de esta semana",           estado: "PENDING",     categoria: "BANCOS",      responsable: "owner",    dias: 3 },
  { titulo: "de este mes",              estado: "IN_PROGRESS", categoria: "SEGUROS",     responsable: "owner",    dias: 20 },
  { titulo: "lejana",                   estado: "PENDING",     categoria: "FISCAL" ,     responsable: "owner",    dias: 100 },
  { titulo: "sin plazo",                estado: "PENDING",     categoria: "SUMINISTROS", responsable: "owner",    dias: null },
  { titulo: "bloqueada",                estado: "BLOCKED",     categoria: "BANCOS",      responsable: "owner",    dias: 15 },
  { titulo: "lista para revisar",       estado: "READY",       categoria: "SEGUROS",     responsable: "owner",    dias: 25 },
  { titulo: "ya completada",            estado: "DONE",        categoria: "BANCOS",      responsable: "owner",    dias: -2 },
  { titulo: "omitida",                  estado: "SKIPPED",     categoria: "TELECOM",     responsable: "owner",    dias: 10 },
  { titulo: "del operador vencida",     estado: "PENDING",     categoria: "SUMINISTROS", responsable: "operador", dias: -12 },
  { titulo: "del operador en curso",    estado: "IN_PROGRESS", categoria: "FISCAL" ,     responsable: "operador", dias: 8 },
  { titulo: "sin asignar pendiente",    estado: "PENDING",     categoria: "TELECOM",     responsable: null,       dias: 40 },
  { titulo: "sin asignar en curso",     estado: "IN_PROGRESS", categoria: "TELECOM",     responsable: null,       dias: 60 },
  { titulo: "para editar",              estado: "PENDING",     categoria: "OTROS"      , responsable: null,    dias: 30 },
];

/**
 * Reparto de los expedientes de relleno.
 *
 * Se fija a mano en vez de al azar para que las pruebas puedan afirmar
 * cantidades exactas: una prueba que depende de un `Math.random()` falla un
 * dia de cada tantos y nadie sabe por que.
 */
const RELLENO_ESTADOS = [
  "INTAKE", "VALIDATION", "IN_PROGRESS", "PENDING_DOCS",
  "READY_TO_SEND", "SENT", "FOLLOW_UP", "CLOSED",
] as const;

// "Málaga" lleva tilde a proposito: es lo que permite comprobar que el CSV
// exportado se descarga en UTF-8 y no llega con la tilde rota.
const RELLENO_PROVINCIAS = ["Madrid", "Barcelona", "Málaga"] as const;
const RELLENO_CATEGORIAS = ["BANCOS", "SEGUROS", "SUMINISTROS", "TELECOM"] as const;

async function main() {
  const hash = await bcrypt.hash(E2E.password, 10);

  // ── Organización activa ──
  const org = await prisma.organization.create({
    data: {
      name: "Gestoría E2E",
      slug: E2E.orgSlug,
      subscription: { create: { plan: "FIRMA", status: "active" } },
    },
  });

  const owner = await prisma.user.create({
    data: { email: E2E.owner, name: "Owner E2E", passwordHash: hash },
  });
  await prisma.membership.create({
    data: { userId: owner.id, orgId: org.id, role: "OWNER" },
  });

  const operador = await prisma.user.create({
    data: { email: E2E.operador, name: "Operador E2E", passwordHash: hash },
  });
  await prisma.membership.create({
    data: { userId: operador.id, orgId: org.id, role: "OPERATOR" },
  });

  // Este usuario se expulsa durante la prueba de revocación.
  // Los cuatro roles, para poder comprobar desde la interfaz que cada uno ve y
  // puede lo que le corresponde — y solo eso.
  const manager = await prisma.user.create({
    data: { email: E2E.manager, name: "Manager E2E", passwordHash: hash },
  });
  await prisma.membership.create({
    data: { userId: manager.id, orgId: org.id, role: "MANAGER" },
  });

  const viewer = await prisma.user.create({
    data: { email: E2E.viewer, name: "Viewer E2E", passwordHash: hash },
  });
  await prisma.membership.create({
    data: { userId: viewer.id, orgId: org.id, role: "VIEWER" },
  });

  const expulsado = await prisma.user.create({
    data: { email: E2E.expulsado, name: "Por expulsar", passwordHash: hash },
  });
  await prisma.membership.create({
    data: { userId: expulsado.id, orgId: org.id, role: "OPERATOR" },
  });

  // ── Expediente con portal, sin consentimiento todavía ──
  const caso = await prisma.case.create({
    data: {
      orgId: org.id,
      ref: E2E.caseRef,
      portalToken: E2E.portalToken,
      portalEnabled: true,
      deceased: { create: { fullName: "Causante E2E", deathDate: new Date("2026-03-01") } },
      contact: { create: { fullName: "Familiar E2E", email: "familia.e2e@ejemplo.test" } },
    },
  });

  // Documento INTERNO: no debe verse nunca en el portal.
  await prisma.document.create({
    data: {
      caseId: caso.id,
      fileName: "INFORME-INTERNO-CONFIDENCIAL.pdf",
      fileKey: "e2e/interno.pdf",
      visibleToFamily: false,
    },
  });

  // Documento compartido con la familia.
  await prisma.document.create({
    data: {
      caseId: caso.id,
      fileName: "certificado-compartido.pdf",
      fileKey: "e2e/compartido.pdf",
      visibleToFamily: true,
      isPortalUpload: true,
    },
  });

  // ── Relleno de documentos: paginacion, busqueda y filtro de origen ──
  //
  // `fileKey` apunta a objetos que NO existen en el almacenamiento, y es
  // deliberado: estas filas solo sirven para listar, buscar, filtrar y paginar,
  // que no tocan S3. Lo que se descarga y se compara byte a byte en las pruebas
  // es siempre un archivo subido de verdad desde el navegador.
  for (let i = 0; i < E2E.documentos.total; i++) {
    const deFamilia = i % 3 === 0;
    await prisma.document.create({
      data: {
        caseId: caso.id,
        fileName: `${E2E.documentos.prefijo}-relleno-${String(i + 1).padStart(2, "0")}.pdf`,
        fileKey: `e2e/relleno-${i + 1}.pdf`,
        mimeType: "application/pdf",
        fileSize: 1024 * (i + 1),
        isPortalUpload: deFamilia,
        visibleToFamily: deFamilia,
        // Hacia atras y separados, para que el orden por fecha sea estable y la
        // paginacion no baile entre ejecuciones.
        createdAt: new Date(Date.now() - (i + 2) * 60 * 60 * 1000),
      },
    });
  }

  // Uno con nombre unico, para la busqueda por nombre.
  await prisma.document.create({
    data: {
      caseId: caso.id,
      fileName: E2E.documentos.unico,
      fileKey: "e2e/unico.pdf",
      mimeType: "application/pdf",
      fileSize: 4242,
      isPortalUpload: false,
      visibleToFamily: false,
      createdAt: new Date(Date.now() - 60 * 60 * 1000),
    },
  });

  // ── Portal familiar propio de las pruebas de documentos ──
  //
  // Sin consentimiento aceptado a proposito: la prueba lo acepta desde la
  // interfaz, que es parte del flujo real que hay que cubrir.
  const casoPortalDocs = await prisma.case.create({
    data: {
      orgId: org.id,
      ref: E2E.documentos.portal.caseRef,
      portalToken: E2E.documentos.portal.token,
      portalEnabled: true,
      createdAt: new Date(Date.now() - 30 * 60 * 1000),
      deceased: { create: { fullName: "Causante Portal Docs", deathDate: new Date("2026-04-01") } },
      contact: {
        create: { fullName: "Familiar Portal Docs", email: "familia.docs.e2e@ejemplo.test" },
      },
    },
  });

  // Interno: la familia NUNCA debe verlo desde el portal.
  await prisma.document.create({
    data: {
      caseId: casoPortalDocs.id,
      fileName: E2E.documentos.portal.interno,
      fileKey: "e2e/portal-interno.pdf",
      mimeType: "application/pdf",
      fileSize: 321,
      visibleToFamily: false,
    },
  });

  // Compartido explicitamente con la familia.
  await prisma.document.create({
    data: {
      caseId: casoPortalDocs.id,
      fileName: E2E.documentos.portal.compartido,
      fileKey: "e2e/portal-compartido.pdf",
      mimeType: "application/pdf",
      fileSize: 654,
      visibleToFamily: true,
    },
  });

  // ── Organizacion ajena: para probar el aislamiento entre tenants ──
  const orgAjena = await prisma.organization.create({
    data: {
      name: "Gestoría Ajena E2E",
      slug: E2E.orgAjena.slug,
      subscription: { create: { plan: "FIRMA", status: "active" } },
    },
  });
  const ownerAjeno = await prisma.user.create({
    data: { email: E2E.orgAjena.owner, name: "Owner Ajeno E2E", passwordHash: hash },
  });
  await prisma.membership.create({
    data: { userId: ownerAjeno.id, orgId: orgAjena.id, role: "OWNER" },
  });
  const casoAjeno = await prisma.case.create({
    data: {
      orgId: orgAjena.id,
      ref: E2E.orgAjena.caseRef,
      deceased: { create: { fullName: "Causante Ajeno", deathDate: new Date("2026-02-01") } },
    },
  });
  await prisma.document.create({
    data: {
      caseId: casoAjeno.id,
      fileName: E2E.orgAjena.documento,
      fileKey: "e2e/ajeno.pdf",
      mimeType: "application/pdf",
      fileSize: 999,
      visibleToFamily: false,
    },
  });

  // ── Relleno para paginacion y filtros ──
  //
  // `createdAt` se fija hacia atras a proposito. El listado ordena por
  // `isUrgent desc, createdAt desc`, asi que si el relleno fuera mas reciente
  // que EXP-2026-9001 lo empujaria a la segunda pagina y romperia las pruebas
  // que lo esperan en el listado — por un motivo que no tiene nada que ver con
  // lo que esas pruebas comprueban.
  const ahora = Date.now();
  const dia = 24 * 60 * 60 * 1000;

  for (let i = 0; i < E2E.relleno.cuantos; i++) {
    const n = i + 1;
    const estado = RELLENO_ESTADOS[i % RELLENO_ESTADOS.length];
    // Dos urgentes, para que el filtro "Urgentes" tenga algo que reducir sin
    // desplazar medio listado.
    const urgente = i === 3 || i === 11;
    // Fechas de fallecimiento repartidas para que los presets de ISD tengan
    // expedientes dentro y fuera de cada ventana:
    //   <30 dias restantes  -> fallecio hace entre 150 y 180 dias
    //   entre 30 y 60 dias  -> fallecio hace entre 120 y 150 dias
    const haceDias = i % 3 === 0 ? 165 : i % 3 === 1 ? 135 : 20;

    await prisma.case.create({
      data: {
        orgId: org.id,
        ref: `${E2E.relleno.prefijo}${String(n).padStart(2, "0")}`,
        status: estado,
        isUrgent: urgente,
        province: RELLENO_PROVINCIAS[i % RELLENO_PROVINCIAS.length],
        categories: [RELLENO_CATEGORIAS[i % RELLENO_CATEGORIAS.length]],
        consentAccepted: true,
        consentDate: new Date(ahora - (i + 1) * dia),
        createdAt: new Date(ahora - (i + 1) * dia),
        deceased: {
          create: {
            fullName: `${E2E.relleno.apellido} Ficticio ${String(n).padStart(2, "0")}`,
            deathDate: new Date(ahora - haceDias * dia),
          },
        },
        contact: {
          create: {
            fullName: `Contacto Ficticio ${String(n).padStart(2, "0")}`,
            email: `ficticio${n}@ejemplo.test`,
          },
        },
      },
    });
  }

  // Dos expedientes con una tarea asignada al OWNER: sin esto el preset "Mis
  // expedientes" no puede demostrar que reduce nada, porque el filtro busca
  // expedientes con tareas vivas asignadas a quien mira.
  const paraMi = await prisma.case.findMany({
    where: { orgId: org.id, ref: { startsWith: E2E.relleno.prefijo } },
    orderBy: { ref: "asc" },
    take: 2,
    select: { id: true },
  });
  for (const c of paraMi) {
    await prisma.task.create({
      data: {
        caseId: c.id,
        category: "BANCOS",
        title: "Tarea asignada al owner (relleno E2E)",
        status: "PENDING",
        assigneeId: owner.id,
      },
    });
  }

  // ── Expediente y tareas del modulo de TAREAS ──
  //
  // Un expediente propio con tareas repartidas por estado, categoria,
  // responsable y plazo. Sin este reparto los filtros de /tasks no se pueden
  // probar: con todas las tareas iguales, cualquier filtro "funciona" porque
  // devuelve siempre lo mismo.
  const casoTareas = await prisma.case.create({
    data: {
      orgId: org.id,
      ref: E2E.tareas.caseRef,
      status: "IN_PROGRESS",
      province: "Madrid",
      categories: ["BANCOS", "SEGUROS"],
      consentAccepted: true,
      consentDate: new Date(),
      // Un poco por detras del expediente principal para no alterar el orden
      // que esperan las pruebas de expedientes.
      createdAt: new Date(ahora - 45 * 60 * 1000),
      deceased: { create: { fullName: "Causante de Tareas E2E", deathDate: new Date(ahora - 60 * dia) } },
      contact: { create: { fullName: "Familiar de Tareas E2E", email: "tareas.e2e@ejemplo.test" } },
    },
  });

  for (let i = 0; i < TAREAS_E2E.length; i++) {
    const t = TAREAS_E2E[i];
    await prisma.task.create({
      data: {
        caseId: casoTareas.id,
        title: `${E2E.tareas.prefijo} ${t.titulo}`,
        description: `Tarea de prueba: ${t.titulo}`,
        category: t.categoria,
        status: t.estado,
        sortOrder: i,
        deadline: t.dias === null ? null : new Date(ahora + t.dias * dia),
        assigneeId:
          t.responsable === "owner" ? owner.id
          : t.responsable === "operador" ? operador.id
          : null,
        ...(t.estado === "BLOCKED" && {
          blockReason: "A la espera del certificado de defuncion",
          blockedUntil: new Date(ahora + 7 * dia),
        }),
      },
    });
  }

  // ── Organización con la suscripción suspendida ──
  const orgSusp = await prisma.organization.create({
    data: {
      name: "Gestoría Suspendida",
      slug: E2E.orgSuspendidaSlug,
      subscription: { create: { plan: "INICIA", status: "past_due" } },
    },
  });
  const ownerSusp = await prisma.user.create({
    data: { email: E2E.ownerSuspendido, name: "Owner suspendido", passwordHash: hash },
  });
  await prisma.membership.create({
    data: { userId: ownerSusp.id, orgId: orgSusp.id, role: "OWNER" },
  });

  // ── Organizacion propia de las pruebas de /users ──
  const orgEquipo = await prisma.organization.create({
    data: {
      name: "Gestoría Equipo E2E",
      slug: E2E.equipo.slug,
      subscription: { create: { plan: "FIRMA", status: "active" } },
    },
  });

  const MIEMBROS_EQUIPO: { email: string; nombre: string; rol: "OWNER" | "MANAGER" | "OPERATOR" | "VIEWER" }[] = [
    { email: E2E.equipo.owner, nombre: "Owner Equipo", rol: "OWNER" },
    { email: E2E.equipo.owner2, nombre: "Segundo Owner", rol: "OWNER" },
    { email: E2E.equipo.manager, nombre: "Manager Equipo", rol: "MANAGER" },
    { email: E2E.equipo.operador, nombre: "Operador Equipo", rol: "OPERATOR" },
    { email: E2E.equipo.viewer, nombre: "Viewer Equipo", rol: "VIEWER" },
    { email: E2E.equipo.cambiante, nombre: "Miembro Cambiante", rol: "OPERATOR" },
    { email: E2E.equipo.expulsable, nombre: "Miembro Expulsable", rol: "OPERATOR" },
  ];

  for (const m of MIEMBROS_EQUIPO) {
    const u = await prisma.user.create({
      data: { email: m.email, name: m.nombre, passwordHash: hash },
    });
    await prisma.membership.create({
      data: { userId: u.id, orgId: orgEquipo.id, role: m.rol },
    });
  }

  // ── Organizacion de /dashboard y /today ──────────────────────────────────
  //
  // Cifras fijas y nadie mas escribiendo aqui: es la unica forma de que una
  // prueba pueda afirmar «el KPI dice 9» y que eso siga siendo cierto manana.
  const orgPanel = await prisma.organization.create({
    data: {
      name: "Gestoria Panel E2E",
      slug: E2E.panel.slug,
      subscription: { create: { plan: "FIRMA", status: "active" } },
      // El panel de primeros pasos se oculta: esta organizacion ya esta
      // configurada y el panel taparia los indicadores en las capturas.
      onboardingDismissedAt: new Date(),
    },
  });

  const usuariosPanel: Record<string, string> = {};
  for (const [clave, email, nombre, rol] of [
    ["owner", E2E.panel.owner, "Owner Panel E2E", "OWNER"],
    ["manager", E2E.panel.manager, "Manager Panel E2E", "MANAGER"],
    ["operador", E2E.panel.operador, "Operador Panel E2E", "OPERATOR"],
    ["viewer", E2E.panel.viewer, "Viewer Panel E2E", "VIEWER"],
  ] as const) {
    const u = await prisma.user.create({
      data: { email, name: nombre, passwordHash: hash },
    });
    await prisma.membership.create({
      data: { userId: u.id, orgId: orgPanel.id, role: rol },
    });
    usuariosPanel[clave] = u.id;
  }

  const ahoraPanel = Date.now();
  const DIA = 24 * 60 * 60 * 1000;

  // Expediente principal: cuelgan de el todas las tareas con plazo.
  const casoPanel = await prisma.case.create({
    data: {
      orgId: orgPanel.id,
      ref: E2E.panel.caseRef,
      status: "IN_PROGRESS",
      deceased: { create: { fullName: "Causante Panel E2E", deathDate: new Date("2026-06-01") } },
      contact: { create: { fullName: "Solicitante Panel E2E" } },
      createdAt: new Date(ahoraPanel - 3 * DIA),
    },
  });

  // Segundo expediente, mas reciente: debe salir el PRIMERO en «Expedientes
  // recientes», que ordena por fecha de creacion descendente.
  const casoPanel2 = await prisma.case.create({
    data: {
      orgId: orgPanel.id,
      ref: E2E.panel.caseRef2,
      status: "INTAKE",
      deceased: { create: { fullName: "Segundo Causante Panel E2E" } },
      contact: { create: { fullName: "Segundo Solicitante Panel E2E" } },
      createdAt: new Date(ahoraPanel - 1 * DIA),
    },
  });

  // Cerrado ESTE MES: alimenta el KPI «Cerrados este mes». `closedAt` se pone
  // a hoy para que caiga dentro del mes en curso cualquiera que sea el dia.
  await prisma.case.create({
    data: {
      orgId: orgPanel.id,
      ref: E2E.panel.caseRefCerrado,
      status: "CLOSED",
      closedAt: new Date(ahoraPanel - 1 * 60 * 60 * 1000),
      deceased: { create: { fullName: "Causante Cerrado Panel E2E" } },
      createdAt: new Date(ahoraPanel - 10 * DIA),
    },
  });

  // ISD critico: el panel considera criticos los fallecimientos de hace entre
  // 150 y 180 dias (los 6 meses del ISD menos 30). 165 cae en mitad del rango,
  // lejos de los dos bordes, para que la prueba no dependa de la hora.
  const casoIsd = await prisma.case.create({
    data: {
      orgId: orgPanel.id,
      ref: E2E.panel.caseRefIsd,
      status: "IN_PROGRESS",
      isUrgent: true,
      deceased: {
        create: {
          fullName: E2E.panel.causanteIsd,
          deathDate: new Date(ahoraPanel - 165 * DIA),
        },
      },
      createdAt: new Date(ahoraPanel - 2 * DIA),
    },
  });

  // Tareas del expediente principal.
  //
  /**
 * Mediodia del dia civil ESPANOL que cae `dias` despues de `base`.
 *
 * EL DEFECTO QUE CORRIGE
 * ----------------------
 * Antes era `new Date(base + dias * DIA).setUTCHours(12, 0, 0, 0)`, que ancla
 * al dia civil **UTC**. Entre las 22:00 y las 24:00 UTC —es decir, entre
 * medianoche y las dos de la madrugada en Madrid— el dia UTC va uno por detras
 * del espanol, asi que todos los plazos se sembraban un dia antes de lo
 * previsto: la tarea «vence hoy» aparecia como vencida ayer y las tres pruebas
 * de /today que miran fechas fallaban. Una ventana de dos horas al dia en la
 * que la suite entera se caia, y solo se veia si tocaba ejecutarla entonces.
 *
 * `sumarDiasES` es el mismo ayudante que usa la aplicacion para agrupar por
 * dia, asi que el sembrado y la pantalla cuentan los dias igual. El mediodia
 * evita ademas los bordes de la medianoche en los dos sentidos.
 */
/**
 * Plazo para probar el borde de una ventana RODANTE de `dias` dias.
 *
 * Una hora antes del corte para los que deben entrar, y justo en el corte del
 * dia siguiente para los que deben quedarse fuera. Asi el resultado no depende
 * de la hora a la que se ejecute la suite.
 */
function plazoRodante(base: number, dias: number): Date {
  const HORA_MS = 60 * 60 * 1000;
  return new Date(base + dias * 86_400_000 - HORA_MS);
}

function mediodiaCivilES(base: number, dias: number): Date {
  const inicio = sumarDiasES(new Date(base), dias);
  return new Date(inicio.getTime() + 12 * 60 * 60 * 1000);
}

/**
 * Plazo dentro del dia civil espanol indicado.
 *
 * EL DEFECTO QUE CORRIGE
 * ----------------------
 * El de HOY se anclaba al mediodia, igual que todos los demas. Pero la
 * consulta del panel es `deadline >= ahora`, asi que a partir de las 12:00 de
 * Madrid la tarea «vence hoy» quedaba en el pasado y desaparecia del bloque
 * «Plazos proximos». Es decir: `dashboard.spec.ts` fallaba TODAS LAS TARDES,
 * y solo pasaba si la suite tocaba correr por la manana. En CI eso se traduce
 * en un rojo que va y viene sin que nadie haya cambiado nada, que es la peor
 * clase de prueba: la que ensena a no creerse el rojo.
 *
 * El de hoy se ancla al FINAL de su dia civil, asi que sigue siendo hoy y
 * sigue estando en el futuro a cualquier hora de la jornada. Los de dias
 * pasados o futuros se quedan al mediodia, que ya estaba bien: nunca cambian
 * de lado respecto a `ahora`.
 */
function plazoDelDia(base: number, dias: number): Date {
  return dias === 0 ? finDelDiaDeES(new Date(base)) : mediodiaCivilES(base, dias);
}

// El plazo se ancla al mediodia del dia civil espanol: asi el dia civil espanol
  // coincide con el dia UTC y estas tareas no dependen de a que hora corra la
  // suite. Las pruebas de zona horaria usan tareas propias, con hora extrema.
  const tareasCreadas: Record<string, string> = {};
  for (const t of TAREAS_PANEL) {
    const plazo =
      t.dias === null
        ? null
        : t.rodante
          ? plazoRodante(ahoraPanel, t.dias)
          : plazoDelDia(ahoraPanel, t.dias);
    const creada = await prisma.task.create({
      data: {
        caseId: casoPanel.id,
        title: `${E2E.panel.prefijo} ${t.titulo}`,
        status: t.estado,
        category: "OTROS",
        deadline: plazo,
        assigneeId: t.responsable ? usuariosPanel[t.responsable] : null,
        blockReason: t.estado === "BLOCKED" ? "Falta certificado de defuncion" : null,
        // `updatedAt` es lo que mide «bloqueada desde hace N dias».
        updatedAt: t.bloqueadaDesdeHace
          ? new Date(ahoraPanel - t.bloqueadaDesdeHace * DIA)
          : new Date(ahoraPanel),
      },
    });
    tareasCreadas[t.titulo] = creada.id;
  }

  // Tarea LISTA PARA CONTINUAR: depende de una que ya esta terminada.
  const prerrequisito = await prisma.task.create({
    data: {
      caseId: casoPanel2.id,
      title: `${E2E.panel.prefijo} prerrequisito ya terminado`,
      status: "DONE",
      category: "OTROS",
      assigneeId: usuariosPanel.owner,
    },
  });
  await prisma.task.create({
    data: {
      caseId: casoPanel2.id,
      title: `${E2E.panel.prefijo} desbloqueada por su prerrequisito`,
      status: "PENDING",
      category: "OTROS",
      assigneeId: usuariosPanel.owner,
      dependsOnId: prerrequisito.id,
    },
  });

  // Aprobaciones pendientes: KPI del panel y seccion de /today.
  for (let i = 0; i < CIFRAS_PANEL.aprobacionesPendientes; i++) {
    await prisma.approval.create({
      data: {
        caseId: i === 0 ? casoPanel.id : casoPanel2.id,
        action: E2E.panel.accionAprobacion,
        status: "PENDING",
        createdAt: new Date(ahoraPanel - (i + 1) * DIA),
      },
    });
  }
  // Una ya resuelta: no debe contarse en ningun sitio.
  await prisma.approval.create({
    data: { caseId: casoPanel.id, action: "mark_sent", status: "APPROVED", reviewedAt: new Date() },
  });

  // Mensajes de familia SIN LEER, los dos en el mismo expediente: el panel
  // cuenta MENSAJES y /today cuenta EXPEDIENTES, y las dos cifras difieren a
  // proposito para que una prueba no pueda pasar confundiendolas.
  for (let i = 0; i < CIFRAS_PANEL.mensajesSinLeer; i++) {
    await prisma.portalMessage.create({
      data: {
        caseId: casoPanel.id,
        fromFamily: true,
        authorName: E2E.panel.autorMensaje,
        content: `${E2E.panel.mensajeFamilia} ${i + 1}`,
        readAt: null,
        createdAt: new Date(ahoraPanel - (i + 1) * 60 * 60 * 1000),
      },
    });
  }
  // Uno ya leido y otro nuestro: ninguno debe contar.
  await prisma.portalMessage.create({
    data: { caseId: casoPanel.id, fromFamily: true, content: "ya leido", readAt: new Date() },
  });
  await prisma.portalMessage.create({
    data: { caseId: casoPanel.id, fromFamily: false, content: "respuesta del despacho", readAt: null },
  });

  // Actividad reciente.
  for (let i = 0; i < 3; i++) {
    await prisma.auditLog.create({
      data: {
        orgId: orgPanel.id,
        userId: usuariosPanel.owner,
        caseId: casoPanel.id,
        action: `panel.e2e.accion.${i + 1}`,
        details: `Actividad de prueba ${i + 1}`,
        createdAt: new Date(ahoraPanel - (i + 1) * 60 * 60 * 1000),
      },
    });
  }

  // ── Organizacion vecina del panel: nada suyo puede aparecer en la otra ──
  const orgVecina = await prisma.organization.create({
    data: {
      name: "Gestoria Vecina E2E",
      slug: E2E.panelVecina.slug,
      subscription: { create: { plan: "FIRMA", status: "active" } },
      onboardingDismissedAt: new Date(),
    },
  });
  const ownerVecino = await prisma.user.create({
    data: { email: E2E.panelVecina.owner, name: "Owner Vecino E2E", passwordHash: hash },
  });
  await prisma.membership.create({
    data: { userId: ownerVecino.id, orgId: orgVecina.id, role: "OWNER" },
  });
  const casoVecino = await prisma.case.create({
    data: {
      orgId: orgVecina.id,
      ref: E2E.panelVecina.caseRef,
      status: "IN_PROGRESS",
      isUrgent: true,
      deceased: {
        create: {
          fullName: E2E.panelVecina.causante,
          // Tambien ISD critico: si el agregado filtrara mal, se colaria.
          deathDate: new Date(ahoraPanel - 160 * DIA),
        },
      },
    },
  });
  // Tareas vencidas, bloqueadas y sin asignar, todas marcadas.
  for (const [titulo, estado, dias] of [
    [`${E2E.panelVecina.tarea} vencida`, "PENDING", -20],
    [`${E2E.panelVecina.tarea} bloqueada`, "BLOCKED", 5],
    [`${E2E.panelVecina.tarea} lista`, "READY", 9],
  ] as const) {
    await prisma.task.create({
      data: {
        caseId: casoVecino.id,
        title: titulo,
        status: estado,
        category: "OTROS",
        deadline: mediodiaCivilES(ahoraPanel, dias),
        assigneeId: ownerVecino.id,
        updatedAt: new Date(ahoraPanel - 30 * DIA),
      },
    });
  }
  await prisma.approval.create({
    data: { caseId: casoVecino.id, action: "NO_DEBE_VERSE_aprobacion", status: "PENDING" },
  });
  await prisma.portalMessage.create({
    data: {
      caseId: casoVecino.id,
      fromFamily: true,
      authorName: "NO-DEBE-VERSE-autor",
      content: E2E.panelVecina.mensaje,
      readAt: null,
    },
  });
  await prisma.auditLog.create({
    data: { orgId: orgVecina.id, action: "NO_DEBE_VERSE_actividad_vecina" },
  });

  // ── Organizacion recien creada: panel de primeros pasos sin ningun paso ──
  const orgNueva = await prisma.organization.create({
    data: {
      name: "Gestoria Nueva E2E",
      slug: E2E.panelNueva.slug,
      subscription: {
        create: {
          plan: "INICIA",
          status: "trialing",
          // La fecha de fin NO es un adorno: `isSuspended()` considera
          // suspendido un `trialing` sin `currentPeriodEnd`, porque no hay
          // forma de comprobar que el periodo siga vigente. Sin ella esta
          // organizacion no llegaba al panel, sino a la pantalla de cuenta
          // suspendida. Es la politica real y aqui se respeta.
          currentPeriodEnd: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        },
      },
    },
  });
  const ownerNuevo = await prisma.user.create({
    data: { email: E2E.panelNueva.owner, name: "Owner Nuevo E2E", passwordHash: hash },
  });
  await prisma.membership.create({
    data: { userId: ownerNuevo.id, orgId: orgNueva.id, role: "OWNER" },
  });

  /*
   * NO se siembra ningun usuario sin organizacion.
   *
   * La prueba que lo necesita TERMINA creandole una organizacion, asi que un
   * usuario sembrado solo servia la primera vez y fallaba en el reintento de
   * CI y en cualquier reejecucion local. Cada prueba se crea el suyo.
   */

  // ── Organizacion de mensajes, notificaciones y aprobaciones ──────────────
  const orgAvisos = await prisma.organization.create({
    data: {
      name: "Gestoria Avisos E2E",
      slug: E2E.avisos.slug,
      subscription: { create: { plan: "FIRMA", status: "active" } },
      onboardingDismissedAt: new Date(),
    },
  });

  const usuariosAvisos: Record<string, string> = {};
  for (const [clave, email, nombre, rol] of [
    ["owner", E2E.avisos.owner, "Owner Avisos E2E", "OWNER"],
    ["manager", E2E.avisos.manager, "Manager Avisos E2E", "MANAGER"],
    ["operador", E2E.avisos.operador, "Operador Avisos E2E", "OPERATOR"],
    ["viewer", E2E.avisos.viewer, "Viewer Avisos E2E", "VIEWER"],
  ] as const) {
    const u = await prisma.user.create({
      data: { email, name: nombre, passwordHash: hash },
    });
    await prisma.membership.create({
      data: { userId: u.id, orgId: orgAvisos.id, role: rol },
    });
    usuariosAvisos[clave] = u.id;
  }

  const ahoraAvisos = Date.now();
  const HORA = 60 * 60 * 1000;

  /**
   * Crea un expediente de la organizacion de avisos con sus mensajes.
   *
   * `sinLeer` y `leidos` son cuantos mensajes DE LA FAMILIA hay de cada clase.
   * `createdAt` va hacia atras y separado para que el orden sea estable entre
   * ejecuciones y la conversacion mas reciente sea siempre la misma.
   */
  async function expedienteConMensajes(
    ref: string,
    causante: string,
    sinLeer: number,
    leidos: number,
    antiguedadHoras: number,
  ) {
    const caso = await prisma.case.create({
      data: {
        orgId: orgAvisos.id,
        ref,
        status: "IN_PROGRESS",
        portalEnabled: true,
        deceased: { create: { fullName: causante } },
        contact: { create: { fullName: `Contacto de ${causante}` } },
        updatedAt: new Date(ahoraAvisos - antiguedadHoras * HORA),
      },
    });
    /*
     * Los LEIDOS van primero en el tiempo y los SIN LEER despues.
     *
     * La primera version numeraba al reves y el mensaje ya leido acababa
     * siendo el mas reciente, asi que la vista previa de la conversacion
     * mostraba texto leido teniendo dos sin leer debajo. Ademas de irreal
     * —la familia escribe y ESO es lo ultimo—, hacia imposible comprobar la
     * vista previa. El desfase solo se vio al ejecutar la prueba.
     */
    const guion = [
      ...Array.from({ length: leidos }, (_, i) => ({
        content: `${E2E.avisos.textoLeido} ${i + 1}`,
        readAt: new Date(ahoraAvisos - 48 * HORA),
      })),
      ...Array.from({ length: sinLeer }, (_, i) => ({
        content: `${E2E.avisos.textoSinLeer} ${i + 1}`,
        readAt: null,
      })),
    ];
    for (let i = 0; i < guion.length; i++) {
      const msg = guion[i];
      await prisma.portalMessage.create({
        data: {
          caseId: caso.id,
          fromFamily: true,
          authorName: E2E.avisos.autorFamilia,
          content: msg.content,
          readAt: msg.readAt,
          // Cuanto mas al final del guion, mas reciente.
          createdAt: new Date(
            ahoraAvisos - (antiguedadHoras + guion.length - i) * HORA,
          ),
        },
      });
    }
    return caso;
  }

  const casoDos = await expedienteConMensajes(
    E2E.avisos.caseConDos, "Causante Dos Sin Leer", 2, 1, 1,
  );
  /*
   * Consentimiento ya aceptado en ESTE expediente.
   *
   * El portal familiar tiene una barrera de consentimiento delante: sin ella
   * la familia ve el aviso de RGPD y no el hilo. La barrera ya se prueba
   * entera —desde el navegador— en `smoke` y en `documentos`; lo que aqui hace
   * falta comprobar es otra cosa: que la respuesta del gestor LLEGA a la
   * familia. Se deja aceptado para no volver a probar lo mismo dos veces.
   */
  await prisma.portalConsent.create({
    data: {
      caseId: casoDos.id,
      version: PORTAL_CONSENT_VERSION,
      textHash: PORTAL_CONSENT_HASH,
      declaredName: E2E.avisos.autorFamilia,
    },
  });
  await expedienteConMensajes(E2E.avisos.caseConUno, "Causante Uno Sin Leer", 1, 0, 3);
  await expedienteConMensajes(E2E.avisos.caseLeido, "Causante Todo Leido", 0, 2, 5);
  // Sin ningun mensaje: no debe aparecer en la lista de conversaciones, ni
  // siquiera con el filtro «Todos», porque el API exige `portalMessages.some`.
  const casoSinMensajes = await prisma.case.create({
    data: {
      orgId: orgAvisos.id,
      ref: E2E.avisos.caseSinMensajes,
      status: "INTAKE",
      deceased: { create: { fullName: "Causante Sin Mensajes" } },
    },
  });

  // ── Aprobaciones ──
  //
  // Tres pendientes: una para aprobar, otra para rechazar y una tercera que se
  // queda intacta, para que el contador nunca llegue a cero por accidente y
  // las pruebas de plural tengan con que trabajar.
  await prisma.approval.create({
    data: {
      caseId: casoDos.id,
      action: E2E.avisos.accionAprobar,
      status: "PENDING",
      details: E2E.avisos.detalleAprobacion,
      createdAt: new Date(ahoraAvisos - 3 * HORA),
    },
  });
  await prisma.approval.create({
    data: {
      caseId: casoDos.id,
      action: E2E.avisos.accionRechazar,
      status: "PENDING",
      details: E2E.avisos.detalleConHtml,
      createdAt: new Date(ahoraAvisos - 2 * HORA),
    },
  });
  await prisma.approval.create({
    data: {
      caseId: casoSinMensajes.id,
      action: "generate_checklist",
      status: "PENDING",
      // Sin `details`: el boton «Ver detalle» NO debe aparecer en esta fila.
      details: null,
      createdAt: new Date(ahoraAvisos - HORA),
    },
  });
  await prisma.approval.create({
    data: {
      caseId: casoDos.id,
      action: "mark_sent",
      status: "APPROVED",
      reviewerId: usuariosAvisos.owner,
      reviewedAt: new Date(ahoraAvisos - 24 * HORA),
      createdAt: new Date(ahoraAvisos - 25 * HORA),
    },
  });
  await prisma.approval.create({
    data: {
      caseId: casoDos.id,
      action: "send_email",
      status: "REJECTED",
      reviewerId: usuariosAvisos.manager,
      reviewedAt: new Date(ahoraAvisos - 20 * HORA),
      createdAt: new Date(ahoraAvisos - 21 * HORA),
    },
  });

  // ── Historial de notificaciones ──
  //
  // Mas de 30 para que la paginacion exista de verdad. El reparto de tipo,
  // canal y estado es fijo, no aleatorio: las pruebas afirman cuantas quedan
  // con cada filtro y un `Math.random()` las haria fallar un dia de cada
  // tantos sin que nadie supiera por que.
  const TIPOS = ["ISD_60D", "ISD_30D", "ISD_7D", "ISD_1D", "ISD_PASSED"] as const;
  for (let i = 0; i < TOTAL_NOTIFICACIONES; i++) {
    const fallida = i % 8 === 3;
    const deFamilia = i % 4 === 1;
    await prisma.notificationLog.create({
      data: {
        orgId: orgAvisos.id,
        caseId: casoDos.id,
        kind: TIPOS[i % TIPOS.length],
        channel: deFamilia ? "EMAIL_FAMILY" : "EMAIL_INTERNAL",
        recipient: `avisos-${String(i + 1).padStart(2, "0")}@ejemplo.test`,
        status: fallida ? "failed" : "sent",
        error: fallida ? "SMTP 550: buzon no encontrado" : null,
        // Separados y hacia atras: orden estable entre paginas.
        createdAt: new Date(ahoraAvisos - (i + 1) * HORA),
      },
    });
  }

  // ── Organizacion de automatizaciones y auditoria ─────────────────────────
  const orgAuto = await prisma.organization.create({
    data: {
      name: "Gestoria Automatizaciones E2E",
      slug: E2E.automatizaciones.slug,
      subscription: { create: { plan: "FIRMA", status: "active" } },
      onboardingDismissedAt: new Date(),
    },
  });
  const usuariosAuto: Record<string, string> = {};
  for (const [clave, email, nombre, rol] of [
    ["owner", E2E.automatizaciones.owner, "Owner Auto E2E", "OWNER"],
    ["manager", E2E.automatizaciones.manager, "Manager Auto E2E", "MANAGER"],
    ["operador", E2E.automatizaciones.operador, "Operador Auto E2E", "OPERATOR"],
    ["viewer", E2E.automatizaciones.viewer, "Viewer Auto E2E", "VIEWER"],
  ] as const) {
    const u = await prisma.user.create({ data: { email, name: nombre, passwordHash: hash } });
    await prisma.membership.create({ data: { userId: u.id, orgId: orgAuto.id, role: rol } });
    usuariosAuto[clave] = u.id;
  }

  const casoAuto = await prisma.case.create({
    data: {
      orgId: orgAuto.id,
      ref: E2E.automatizaciones.caseRef,
      status: "IN_PROGRESS",
      deceased: { create: { fullName: E2E.automatizaciones.causante } },
      contact: { create: { fullName: "Contacto Auto E2E", email: "contacto.auto@ejemplo.test" } },
    },
  });

  /*
   * Tres reglas con papeles distintos:
   *   - activa y con accion inofensiva (comentario), para probar la ejecucion
   *     de verdad sin mandar correo a nadie;
   *   - desactivada, para probar la activacion;
   *   - de usar y tirar, para probar el borrado sin dejar la lista vacia.
   */
  const reglaActiva = await prisma.workflowRule.create({
    data: {
      orgId: orgAuto.id,
      name: E2E.automatizaciones.reglaActiva,
      description: "Deja un comentario cuando el expediente cambia de estado",
      trigger: "CASE_STATUS_CHANGED",
      conditions: {},
      action: "ADD_CASE_COMMENT",
      actionConfig: { comment: E2E.automatizaciones.textoComentario },
      isActive: true,
    },
  });
  await prisma.workflowRule.create({
    data: {
      orgId: orgAuto.id,
      name: E2E.automatizaciones.reglaInactiva,
      trigger: "CASE_CREATED",
      conditions: {},
      action: "ADD_CASE_COMMENT",
      actionConfig: { comment: "Expediente recien creado" },
      isActive: false,
    },
  });
  await prisma.workflowRule.create({
    data: {
      orgId: orgAuto.id,
      name: E2E.automatizaciones.reglaBorrable,
      trigger: "DOCUMENT_UPLOADED",
      conditions: {},
      action: "ADD_CASE_COMMENT",
      actionConfig: { comment: "Documento recibido" },
      isActive: true,
    },
  });

  // ── Ejecuciones: reparto fijo, no aleatorio ──
  const ESTADOS_EJEC = ["SUCCESS", "SUCCESS", "PARTIAL", "FAILED", "SKIPPED"] as const;
  for (let i = 0; i < CIFRAS_AUTOMATIZACIONES.ejecuciones; i++) {
    const estado = ESTADOS_EJEC[i % 5];
    await prisma.workflowLog.create({
      data: {
        ruleId: reglaActiva.id,
        caseId: casoAuto.id,
        status: estado,
        error: estado === "FAILED" ? "SMTP 550: buzon no encontrado" : null,
        details: estado === "PARTIAL" ? { pendingDeliveries: 1 } : undefined,
        createdAt: new Date(ahoraAvisos - (i + 1) * 60_000),
      },
    });
  }

  /*
   * Regla de correo + una ejecucion FALLIDA con entregas REALES.
   *
   * POR QUE HACEN FALTA ENTREGAS DE VERDAD
   * --------------------------------------
   * El boton «Reintentar fallidas» solo aparece cuando quedan entregas
   * pendientes, y el reintento reconstruye el envio desde la regla. Con logs
   * sin filas en `WorkflowDelivery` no habria nada que reintentar y la prueba
   * comprobaria unicamente que un boton se pinta.
   *
   * Un destinatario en FAILED (debe recibirlo al reintentar) y otro en SENT
   * (NO debe recibir nada: ya lo tenia).
   */
  const reglaCorreo = await prisma.workflowRule.create({
    data: {
      orgId: orgAuto.id,
      name: E2E.automatizaciones.reglaCorreo,
      trigger: "CASE_STATUS_CHANGED",
      conditions: {},
      action: "SEND_EMAIL_TEAM",
      actionConfig: {
        subject: E2E.automatizaciones.asuntoCorreo,
        body: "El expediente {{caseRef}} ha cambiado de estado.",
      },
      isActive: true,
    },
  });
  const ejecucionConEntregas = await prisma.workflowLog.create({
    data: {
      ruleId: reglaCorreo.id,
      caseId: casoAuto.id,
      status: "FAILED",
      error: "SMTP 421: servicio no disponible",
      createdAt: new Date(ahoraAvisos - 30_000),
    },
  });
  await prisma.workflowDelivery.createMany({
    data: [
      {
        workflowLogId: ejecucionConEntregas.id,
        recipient: E2E.automatizaciones.destinatarioFallido,
        status: "FAILED",
        error: "SMTP 421: servicio no disponible",
        attempts: 1,
        lastTriedAt: new Date(ahoraAvisos - 30_000),
      },
      {
        workflowLogId: ejecucionConEntregas.id,
        recipient: E2E.automatizaciones.destinatarioEntregado,
        status: "SENT",
        attempts: 1,
        lastTriedAt: new Date(ahoraAvisos - 30_000),
        sentAt: new Date(ahoraAvisos - 30_000),
      },
    ],
  });

  // ── Auditoria: mas de 30 para que la paginacion exista de verdad ──
  const ACCIONES_AUD = ["case.created", "task.completed", "document.uploaded", "user.role_changed"];
  for (let i = 0; i < CIFRAS_AUTOMATIZACIONES.auditoria; i++) {
    await prisma.auditLog.create({
      data: {
        orgId: orgAuto.id,
        // Una de cada cinco la deja el sistema (sin usuario).
        userId: i % 5 === 0 ? null : usuariosAuto.owner,
        caseId: casoAuto.id,
        action: ACCIONES_AUD[i % ACCIONES_AUD.length],
        details: `Registro de auditoria E2E numero ${i + 1}`,
        createdAt: new Date(ahoraAvisos - (i + 1) * 60_000),
      },
    });
  }

  /*
   * Dos registros justo a los lados de la medianoche de Madrid, y uno con
   * caracteres que rompen un CSV mal escapado.
   *
   * `inicioDelDiaDeES` da la medianoche CIVIL espanola, que es la misma con la
   * que la aplicacion agrupa por dia. Sumar y restar media hora deja un
   * registro dentro de hoy y otro dentro de ayer, con menos de una hora entre
   * ambos: si el filtro se apoya en dias UTC, los coloca al reves.
   */
  const medianocheHoy = inicioDelDiaDeES(new Date(ahoraAvisos));
  await prisma.auditLog.createMany({
    data: [
      {
        orgId: orgAuto.id,
        userId: usuariosAuto.owner,
        caseId: casoAuto.id,
        action: E2E.automatizaciones.accionBorde,
        details: E2E.automatizaciones.detalleHoyTemprano,
        createdAt: new Date(medianocheHoy.getTime() + 30 * 60_000),
      },
      {
        orgId: orgAuto.id,
        userId: usuariosAuto.owner,
        caseId: casoAuto.id,
        action: E2E.automatizaciones.accionBorde,
        details: E2E.automatizaciones.detalleAyerTarde,
        createdAt: new Date(medianocheHoy.getTime() - 30 * 60_000),
      },
      {
        orgId: orgAuto.id,
        // Sin usuario: en el CSV tiene que salir «Sistema», no una celda vacia.
        userId: null,
        caseId: casoAuto.id,
        action: E2E.automatizaciones.accionCsv,
        details: E2E.automatizaciones.detalleCsv,
        createdAt: new Date(medianocheHoy.getTime() + 31 * 60_000),
      },
    ],
  });

  /*
   * ── Organizacion de DISPARADORES AUTOMATICOS e IDEMPOTENCIA ──────────────
   *
   * Sin reglas activas a proposito: las crean las pruebas por la interfaz. Asi
   * las cifras de correos y de ejecuciones son exactas y no las mueve nada
   * sembrado.
   */
  const orgDisp = await prisma.organization.create({
    data: {
      name: E2E.disparadores.orgNombre,
      slug: E2E.disparadores.slug,
      subscription: { create: { plan: "FIRMA", status: "active" } },
      onboardingDismissedAt: new Date(),
    },
  });
  for (const [email, nombre, rol] of [
    [E2E.disparadores.owner, "Owner Disparadores E2E", "OWNER"],
    [E2E.disparadores.manager, "Manager Disparadores E2E", "MANAGER"],
    [E2E.disparadores.operador, "Operador Disparadores E2E", "OPERATOR"],
    [E2E.disparadores.viewer, "Viewer Disparadores E2E", "VIEWER"],
  ] as const) {
    const u = await prisma.user.create({ data: { email, name: nombre, passwordHash: hash } });
    await prisma.membership.create({ data: { userId: u.id, orgId: orgDisp.id, role: rol } });
  }

  const casoDisp = await prisma.case.create({
    data: {
      orgId: orgDisp.id,
      ref: E2E.disparadores.caseRef,
      status: "IN_PROGRESS",
      deceased: { create: { fullName: E2E.disparadores.causante } },
      contact: {
        create: {
          fullName: E2E.disparadores.contactoNombre,
          email: E2E.disparadores.contacto,
        },
      },
    },
  });
  await prisma.task.create({
    data: {
      caseId: casoDisp.id,
      title: E2E.disparadores.tarea,
      status: "PENDING",
      category: "OTROS",
    },
  });
  await prisma.task.create({
    data: {
      caseId: casoDisp.id,
      title: E2E.disparadores.tareaOtraCategoria,
      status: "PENDING",
      // Categoria distinta: sirve para el caso NEGATIVO de las condiciones.
      category: "BANCOS",
    },
  });

  // Expediente aparte para el borde de ejecucion parcial: asi las cuentas de
  // correo de ese caso no se mezclan con las del expediente principal.
  await prisma.case.create({
    data: {
      orgId: orgDisp.id,
      ref: E2E.disparadores.caseRefParcial,
      status: "IN_PROGRESS",
      deceased: { create: { fullName: "Causante Parcial E2E" } },
      contact: { create: { fullName: "Contacto Parcial E2E", email: "parcial.disp.e2e@ejemplo.test" } },
    },
  });

  // ── Organizacion vecina: nada suyo puede filtrarse ──
  const orgAutoVecina = await prisma.organization.create({
    data: {
      name: "Gestoria Automatizaciones Vecina E2E",
      slug: E2E.automatizacionesVecina.slug,
      subscription: { create: { plan: "FIRMA", status: "active" } },
      onboardingDismissedAt: new Date(),
    },
  });
  const ownerAutoVecina = await prisma.user.create({
    data: { email: E2E.automatizacionesVecina.owner, name: "Owner Auto Vecina E2E", passwordHash: hash },
  });
  await prisma.membership.create({
    data: { userId: ownerAutoVecina.id, orgId: orgAutoVecina.id, role: "OWNER" },
  });
  const casoAutoVecino = await prisma.case.create({
    data: {
      orgId: orgAutoVecina.id,
      ref: E2E.automatizacionesVecina.caseRef,
      status: "IN_PROGRESS",
      deceased: { create: { fullName: "NO-DEBE-VERSE-Causante-Auto" } },
    },
  });
  const reglaVecina = await prisma.workflowRule.create({
    data: {
      orgId: orgAutoVecina.id,
      name: E2E.automatizacionesVecina.regla,
      trigger: "CASE_CREATED",
      conditions: {},
      action: "ADD_CASE_COMMENT",
      actionConfig: { comment: "vecina" },
      isActive: true,
    },
  });
  await prisma.workflowLog.create({
    data: { ruleId: reglaVecina.id, caseId: casoAutoVecino.id, status: "SUCCESS" },
  });
  await prisma.auditLog.create({
    data: {
      orgId: orgAutoVecina.id,
      userId: ownerAutoVecina.id,
      action: E2E.automatizacionesVecina.accionAuditoria,
      details: "NO-DEBE-VERSE-detalle-vecino",
    },
  });

  // ── Organizacion con aprobaciones suficientes para paginar ───────────────
  const orgAprobPag = await prisma.organization.create({
    data: {
      name: "Gestoria Aprobaciones Paginadas E2E",
      slug: E2E.aprobacionesPag.slug,
      subscription: { create: { plan: "FIRMA", status: "active" } },
      onboardingDismissedAt: new Date(),
    },
  });
  const ownerAprobPag = await prisma.user.create({
    data: {
      email: E2E.aprobacionesPag.owner,
      name: "Owner Aprobaciones Pag E2E",
      passwordHash: hash,
    },
  });
  await prisma.membership.create({
    data: { userId: ownerAprobPag.id, orgId: orgAprobPag.id, role: "OWNER" },
  });

  /*
   * Cada aprobacion cuelga de SU PROPIO expediente, con referencia unica.
   *
   * La referencia se pinta en la fila, asi que sirve de marca para comprobar
   * que la pagina 2 no repite lo de la pagina 1 y que entre las dos no falta
   * ninguna. Con todas colgando del mismo expediente, las filas serian
   * indistinguibles y «no hay duplicados» no se podria afirmar.
   *
   * El orden es por `createdAt` descendente: se reparten hacia atras y
   * separadas, para que la paginacion sea estable entre ejecuciones.
   */
  const repartoAprobPag = [
    ...Array.from({ length: CIFRAS_APROBACIONES_PAG.pendientes }, () => "PENDING" as const),
    ...Array.from({ length: CIFRAS_APROBACIONES_PAG.aprobadas }, () => "APPROVED" as const),
    ...Array.from({ length: CIFRAS_APROBACIONES_PAG.rechazadas }, () => "REJECTED" as const),
  ];
  for (let i = 0; i < repartoAprobPag.length; i++) {
    const estado = repartoAprobPag[i];
    const ref = `${E2E.aprobacionesPag.prefijoRef}${String(i + 1).padStart(2, "0")}`;
    const caso = await prisma.case.create({
      data: {
        orgId: orgAprobPag.id,
        ref,
        status: "IN_PROGRESS",
        deceased: { create: { fullName: `Causante Paginado ${i + 1}` } },
      },
    });
    await prisma.approval.create({
      data: {
        caseId: caso.id,
        action: "send_draft",
        status: estado,
        details: `Detalle de la aprobacion ${ref}`,
        reviewerId: estado === "PENDING" ? null : ownerAprobPag.id,
        reviewedAt: estado === "PENDING" ? null : new Date(ahoraAvisos - 30 * HORA),
        createdAt: new Date(ahoraAvisos - (i + 1) * 60_000),
      },
    });
  }

  // ── Organizacion vecina: nada suyo puede filtrarse ──
  const orgAvisosVecina = await prisma.organization.create({
    data: {
      name: "Gestoria Avisos Vecina E2E",
      slug: E2E.avisosVecina.slug,
      subscription: { create: { plan: "FIRMA", status: "active" } },
      onboardingDismissedAt: new Date(),
    },
  });
  const ownerAvisosVecina = await prisma.user.create({
    data: { email: E2E.avisosVecina.owner, name: "Owner Avisos Vecina E2E", passwordHash: hash },
  });
  await prisma.membership.create({
    data: { userId: ownerAvisosVecina.id, orgId: orgAvisosVecina.id, role: "OWNER" },
  });
  const casoAvisosVecino = await prisma.case.create({
    data: {
      orgId: orgAvisosVecina.id,
      ref: E2E.avisosVecina.caseRef,
      status: "IN_PROGRESS",
      portalEnabled: true,
      deceased: { create: { fullName: "NO-DEBE-VERSE-Causante-Avisos" } },
    },
  });
  await prisma.portalMessage.create({
    data: {
      caseId: casoAvisosVecino.id,
      fromFamily: true,
      authorName: E2E.avisosVecina.autor,
      content: E2E.avisosVecina.mensaje,
      readAt: null,
    },
  });
  await prisma.approval.create({
    data: {
      caseId: casoAvisosVecino.id,
      action: "NO_DEBE_VERSE_aprobacion_vecina",
      status: "PENDING",
    },
  });
  await prisma.notificationLog.create({
    data: {
      orgId: orgAvisosVecina.id,
      caseId: casoAvisosVecino.id,
      kind: "ISD_7D",
      channel: "EMAIL_INTERNAL",
      recipient: "NO-DEBE-VERSE-destinatario@ejemplo.test",
      status: "sent",
    },
  });

  console.log("[seed-e2e] Datos de prueba creados.");
}

/**
 * Solo siembra cuando se ejecuta como script. `smoke.spec.ts` importa este
 * fichero por las constantes E2E, y sin este guard el sembrado se repetia al
 * cargar el modulo, chocando con la restriccion unica del slug.
 */
const ejecutadoDirectamente =
  process.argv[1]?.includes("seed-e2e") ?? false;

if (ejecutadoDirectamente) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}

export { main as seedE2E };
