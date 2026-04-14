import { PrismaClient, Role, PlanTier, CaseStatus, TaskStatus, TaskCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ── Organization ─────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: "gestoria-demo" },
    update: {},
    create: {
      name: "Gestoría Demo",
      slug: "gestoria-demo",
      retentionDays: 90,
    },
  });
  console.log(`  ✔ Organization: ${org.name} (${org.id})`);

  // ── Admin User ───────────────────────────────────────────
  const passwordHash = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@baritur.com" },
    update: {},
    create: {
      email: "admin@baritur.com",
      name: "Admin Baritur",
      passwordHash,
    },
  });
  console.log(`  ✔ User: ${admin.email} (${admin.id})`);

  // ── Membership ───────────────────────────────────────────
  const membership = await prisma.membership.upsert({
    where: {
      userId_orgId: { userId: admin.id, orgId: org.id },
    },
    update: {},
    create: {
      userId: admin.id,
      orgId: org.id,
      role: Role.OWNER,
    },
  });
  console.log(`  ✔ Membership: role ${membership.role}`);

  // ── Subscription ─────────────────────────────────────────
  const subscription = await prisma.subscription.upsert({
    where: { orgId: org.id },
    update: {},
    create: {
      orgId: org.id,
      plan: PlanTier.DESPACHO,
      status: "active",
      currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // +30 days
    },
  });
  console.log(`  ✔ Subscription: ${subscription.plan} (${subscription.status})`);

  // ── Templates ────────────────────────────────────────────

  // 1. Notificación de fallecimiento a banco
  const template1 = await prisma.template.create({
    data: {
      orgId: org.id,
      name: "Notificación de fallecimiento a banco",
      category: TaskCategory.BANCOS,
      type: "carta",
      versions: {
        create: {
          version: 1,
          subject: "Notificación de fallecimiento - {{deceased.fullName}}",
          body: `Estimados señores,

Por medio de la presente, les comunico el fallecimiento de D./Dña. {{deceased.fullName}}, con DNI {{deceased.dni}}, ocurrido en fecha {{deceased.deathDate}}, quien era titular de una o varias cuentas en su entidad.

En calidad de {{contact.relationship}} del/la fallecido/a, y como persona de contacto autorizada, les ruego procedan a:

1. Bloquear las cuentas y productos asociados al titular fallecido.
2. Emitir un certificado de posiciones (saldos, préstamos, seguros vinculados, tarjetas, etc.) a fecha de fallecimiento.
3. Informar sobre la documentación necesaria para la tramitación de la herencia.

Adjunto copia del certificado de defunción y documento acreditativo de mi identidad.

Quedo a su disposición para cualquier aclaración.

Atentamente,
{{contact.fullName}}
DNI: {{contact.dni}}
Teléfono: {{contact.phone}}
Email: {{contact.email}}`,
          variables: [
            "deceased.fullName",
            "deceased.dni",
            "deceased.deathDate",
            "contact.relationship",
            "contact.fullName",
            "contact.dni",
            "contact.phone",
            "contact.email",
          ],
          isApproved: true,
        },
      },
    },
  });
  console.log(`  ✔ Template: ${template1.name}`);

  // 2. Solicitud de baja de suministro
  const template2 = await prisma.template.create({
    data: {
      orgId: org.id,
      name: "Solicitud de baja de suministro",
      category: TaskCategory.SUMINISTROS,
      type: "carta",
      versions: {
        create: {
          version: 1,
          subject: "Solicitud de baja por fallecimiento del titular - {{deceased.fullName}}",
          body: `Estimados señores,

Me dirijo a ustedes para solicitar la baja del contrato de suministro a nombre de D./Dña. {{deceased.fullName}}, con DNI {{deceased.dni}}, correspondiente a la dirección {{deceased.address}}, motivada por el fallecimiento del titular en fecha {{deceased.deathDate}}.

Datos del contrato:
- Titular: {{deceased.fullName}}
- Número de contrato/referencia: {{contract.reference}}
- Dirección de suministro: {{deceased.address}}

Soy {{contact.fullName}}, {{contact.relationship}} del/la fallecido/a, y solicito:

1. La baja definitiva del contrato mencionado.
2. La liquidación final del suministro hasta la fecha de baja.
3. La devolución del depósito de garantía, si lo hubiere, a la cuenta indicada.

Se adjunta certificado de defunción y copia de mi DNI.

Quedo a la espera de su confirmación.

Un saludo,
{{contact.fullName}}
Teléfono: {{contact.phone}}
Email: {{contact.email}}`,
          variables: [
            "deceased.fullName",
            "deceased.dni",
            "deceased.address",
            "deceased.deathDate",
            "contract.reference",
            "contact.fullName",
            "contact.relationship",
            "contact.phone",
            "contact.email",
          ],
          isApproved: true,
        },
      },
    },
  });
  console.log(`  ✔ Template: ${template2.name}`);

  // 3. Recordatorio de documentación pendiente (email, no category)
  const template3 = await prisma.template.create({
    data: {
      orgId: org.id,
      name: "Recordatorio de documentación pendiente",
      category: null,
      type: "email",
      versions: {
        create: {
          version: 1,
          subject: "Documentación pendiente - Expediente {{case.ref}}",
          body: `Estimado/a {{contact.fullName}},

Le escribimos en relación con el expediente {{case.ref}} abierto para la gestión de los trámites derivados del fallecimiento de D./Dña. {{deceased.fullName}}.

Tras revisar el estado actual del expediente, le informamos de que aún tenemos pendiente de recibir la siguiente documentación:

{{pending.documentList}}

Le rogamos que nos haga llegar estos documentos a la mayor brevedad posible para poder continuar con la tramitación sin demora. Puede entregarlos en nuestra oficina, enviarlos por correo electrónico a esta dirección, o subirlos directamente a través del portal de seguimiento que le facilitamos al inicio del proceso.

Si tiene cualquier duda o dificultad para obtener alguno de los documentos indicados, no dude en contactarnos y le orientaremos sobre cómo proceder.

Agradecemos su colaboración.

Un cordial saludo,
{{agent.fullName}}
{{agent.title}}
{{org.name}}
Teléfono: {{org.phone}}`,
          variables: [
            "contact.fullName",
            "case.ref",
            "deceased.fullName",
            "pending.documentList",
            "agent.fullName",
            "agent.title",
            "org.name",
            "org.phone",
          ],
          isApproved: true,
        },
      },
    },
  });
  console.log(`  ✔ Template: ${template3.name}`);

  // ── Sample Case ──────────────────────────────────────────
  const sampleCase = await prisma.case.create({
    data: {
      orgId: org.id,
      ref: "EXP-2026-0001",
      status: CaseStatus.IN_PROGRESS,
      isUrgent: false,
      hasDeceasedInsurance: true,
      categories: [TaskCategory.BANCOS, TaskCategory.SUMINISTROS],
      province: "Madrid",
      notes: "Caso de ejemplo para demostración. La familia necesita gestionar cuentas bancarias y suministros.",
      consentAccepted: true,
      consentDate: new Date(),
      deceased: {
        create: {
          fullName: "María García López",
          deathDate: new Date("2026-03-15"),
          dni: "12345678A",
        },
      },
      contact: {
        create: {
          fullName: "Juan García",
          phone: "+34 612 345 678",
          email: "juan.garcia@example.com",
          relationship: "Hijo",
        },
      },
      tasks: {
        create: [
          {
            category: TaskCategory.BANCOS,
            title: "Notificar fallecimiento a Banco Santander",
            description: "Enviar carta de notificación de fallecimiento y solicitar certificado de posiciones.",
            status: TaskStatus.DONE,
            sortOrder: 1,
          },
          {
            category: TaskCategory.BANCOS,
            title: "Notificar fallecimiento a CaixaBank",
            description: "Enviar carta de notificación de fallecimiento. Pendiente de localizar número de cuenta.",
            status: TaskStatus.IN_PROGRESS,
            sortOrder: 2,
          },
          {
            category: TaskCategory.SUMINISTROS,
            title: "Solicitar baja de suministro eléctrico",
            description: "Tramitar la baja del contrato de luz con Iberdrola en el domicilio del fallecido.",
            status: TaskStatus.PENDING,
            sortOrder: 3,
          },
          {
            category: TaskCategory.SUMINISTROS,
            title: "Cambiar titularidad del gas",
            description: "Gestionar el cambio de titularidad del contrato de gas natural a nombre del heredero.",
            status: TaskStatus.PENDING,
            sortOrder: 4,
          },
        ],
      },
    },
  });
  console.log(`  ✔ Case: ${sampleCase.ref} (${sampleCase.id})`);

  console.log("\n✅ Seed complete!");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error("❌ Seed failed:", e);
    await prisma.$disconnect();
    process.exit(1);
  });
