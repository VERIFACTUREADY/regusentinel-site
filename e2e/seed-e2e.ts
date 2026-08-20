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
