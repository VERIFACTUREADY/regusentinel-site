/**
 * Utilidades para las pruebas de integracion con PostgreSQL real.
 *
 * Deliberadamente NO mockean nada. El cliente Prisma que devuelven habla con
 * la base de datos indicada en DATABASE_URL, que debe ser desechable.
 */
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  throw new Error(
    "Las pruebas de integracion requieren DATABASE_URL apuntando a una base de datos desechable. " +
      "Usa scripts/test-db.sh o exporta la variable manualmente.",
  );
}

export const prisma = new PrismaClient();

/**
 * Vacia las tablas respetando las dependencias. Se usa entre ficheros de
 * prueba para que cada uno parta de un estado conocido.
 */
export async function resetDatabase() {
  // TRUNCATE ... CASCADE en una sola sentencia: mas rapido y sin importar el
  // orden de las claves foraneas.
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      "AuditLog", "PromptLog", "Approval", "TaskNote", "Document", "Task",
      "PortalMessage", "CaseContact", "Deceased", "NotificationLog",
      "WorkflowLog", "WorkflowRule", "CaseTemplateTask", "CaseTemplate",
      "TemplateVersion", "Template", "Case", "UsageRecord", "Subscription",
      "Membership", "DemoRequest", "PurgeEvidence", "Organization", "User", "StripeEvent"
    RESTART IDENTITY CASCADE
  `);
}

let orgSeq = 0;

/** Crea una organizacion con un OWNER y suscripcion activa. */
export async function createOrg(options: { name?: string; plan?: "INICIA" | "DESPACHO" | "FIRMA" } = {}) {
  orgSeq++;
  const slug = `org-test-${orgSeq}-${Date.now()}`;
  const org = await prisma.organization.create({
    data: {
      name: options.name ?? `Org ${orgSeq}`,
      slug,
      subscription: {
        create: { plan: options.plan ?? "FIRMA", status: "active" },
      },
    },
  });

  const owner = await prisma.user.create({
    data: { email: `owner-${slug}@ejemplo.test`, name: "Owner" },
  });

  await prisma.membership.create({
    data: { userId: owner.id, orgId: org.id, role: "OWNER" },
  });

  return { org, owner };
}

/** Crea un expediente minimo valido en la organizacion indicada. */
export async function createCase(orgId: string, ref: string) {
  return prisma.case.create({
    data: {
      orgId,
      ref,
      deceased: { create: { fullName: "Fallecido Prueba" } },
      contact: { create: { fullName: "Contacto Prueba", email: "familia@ejemplo.test" } },
    },
  });
}
