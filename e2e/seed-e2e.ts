/**
 * Datos de partida para los smoke tests de navegador.
 *
 * Se crean con contraseña conocida para poder iniciar sesión de verdad desde
 * el navegador, sin mockear NextAuth.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

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
}[] = [
  // ── Vencidas del owner (alimentan «Requiere accion inmediata» y /today) ──
  { titulo: "vencida hace 3 dias", estado: "PENDING", responsable: "owner", dias: -3 },
  { titulo: "vencida hace 10 dias", estado: "IN_PROGRESS", responsable: "owner", dias: -10 },
  // ── Bordes exactos que pide la auditoria ──
  { titulo: "vence hoy", estado: "PENDING", responsable: "owner", dias: 0 },
  { titulo: "vence en 7 dias", estado: "PENDING", responsable: "owner", dias: 7 },
  { titulo: "vence en 30 dias", estado: "PENDING", responsable: "owner", dias: 30 },
  // 31 dias: queda JUSTO fuera de «Plazos proximos (30 dias)».
  { titulo: "vence en 31 dias fuera de rango", estado: "PENDING", responsable: "owner", dias: 31 },
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
   * La consulta es `deadline >= ahora`, y la tarea «vence hoy» tiene el plazo
   * anclado a las 12:00 UTC: entra en la lista si la suite corre por la manana
   * y no entra si corre por la tarde. Una prueba que afirmara un total exacto
   * pasaria o fallaria segun la hora, que es justo el tipo de prueba inestable
   * que no aporta nada. El bloque se comprueba por TITULOS —que el de 30 dias
   * esta y el de 31 no—, que es ademas lo que interesa: el borde del rango.
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
  // El plazo se ancla a las 12:00 UTC a proposito: asi el dia civil espanol
  // coincide con el dia UTC y estas tareas no dependen de a que hora corra la
  // suite. Las pruebas de zona horaria usan tareas propias, con hora extrema.
  const tareasCreadas: Record<string, string> = {};
  for (const t of TAREAS_PANEL) {
    const plazo =
      t.dias === null
        ? null
        : new Date(new Date(ahoraPanel + t.dias * DIA).setUTCHours(12, 0, 0, 0));
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
        deadline: new Date(new Date(ahoraPanel + dias * DIA).setUTCHours(12, 0, 0, 0)),
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
    let n = 0;
    for (let i = 0; i < leidos; i++) {
      await prisma.portalMessage.create({
        data: {
          caseId: caso.id,
          fromFamily: true,
          authorName: E2E.avisos.autorFamilia,
          content: `${E2E.avisos.textoLeido} ${i + 1}`,
          readAt: new Date(ahoraAvisos - 48 * HORA),
          createdAt: new Date(ahoraAvisos - (antiguedadHoras + ++n) * HORA),
        },
      });
    }
    for (let i = 0; i < sinLeer; i++) {
      await prisma.portalMessage.create({
        data: {
          caseId: caso.id,
          fromFamily: true,
          authorName: E2E.avisos.autorFamilia,
          content: `${E2E.avisos.textoSinLeer} ${i + 1}`,
          readAt: null,
          createdAt: new Date(ahoraAvisos - (antiguedadHoras + ++n) * HORA),
        },
      });
    }
    return caso;
  }

  const casoDos = await expedienteConMensajes(
    E2E.avisos.caseConDos, "Causante Dos Sin Leer", 2, 1, 1,
  );
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
