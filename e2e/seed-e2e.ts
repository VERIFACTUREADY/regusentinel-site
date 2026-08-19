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
};

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
