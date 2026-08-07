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
};

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
