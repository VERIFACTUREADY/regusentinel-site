import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getChecklistForCategories } from "@/lib/checklist-rules";
import { calculateTaskDeadlines } from "@/lib/deadline-engine";
import { PLAN_PRICING } from "@/lib/stripe";

export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.create")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const month = new Date().toISOString().slice(0, 7);

  const [original, sub, usage, caseCount] = await Promise.all([
    prisma.case.findFirst({
      where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
      include: { deceased: true, contact: true },
    }),
    prisma.subscription.findUnique({ where: { orgId: session.user.orgId } }),
    prisma.usageRecord.findUnique({
      where: { orgId_month: { orgId: session.user.orgId, month } },
    }),
    prisma.case.count({ where: { orgId: session.user.orgId } }),
  ]);

  if (!original) {
    return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  }

  const plan = (sub?.plan ?? "INICIA") as keyof typeof PLAN_PRICING;
  const limit = PLAN_PRICING[plan].includedCases;
  if (usage && usage.casesCreated >= limit) {
    return NextResponse.json(
      { error: `Limite de expedientes alcanzado para el plan ${PLAN_PRICING[plan].label} (${limit}/mes).` },
      { status: 403 }
    );
  }

  const ref = `EXP-${new Date().getFullYear()}-${String(caseCount + 1).padStart(4, "0")}`;

  const newCase = await prisma.$transaction(async (tx) => {
    const c = await tx.case.create({
      data: {
        orgId: session.user.orgId!,
        ref,
        categories: original.categories,
        province: original.province,
        isUrgent: false,
        hasDeceasedInsurance: original.hasDeceasedInsurance,
        consentAccepted: false,
        status: "INTAKE",
        deceased: original.deceased
          ? {
              create: {
                fullName: original.deceased.fullName,
                deathDate: null,
                dni: null,
              },
            }
          : undefined,
        contact: original.contact
          ? {
              create: {
                fullName: original.contact.fullName,
                phone: original.contact.phone,
                email: original.contact.email,
                relationship: original.contact.relationship,
              },
            }
          : undefined,
      },
      include: { deceased: true, contact: true },
    });

    const tasks = getChecklistForCategories(original.categories);
    const deathDate = new Date();
    for (const task of tasks) {
      const deadlines = calculateTaskDeadlines(deathDate, task.docTag, task.title);
      await tx.task.create({
        data: {
          caseId: c.id,
          category: task.category,
          title: task.title,
          description: task.description,
          sortOrder: task.sortOrder,
          docTag: task.docTag,
          blockedUntil: deadlines.blockedUntil,
          deadline: deadlines.deadline,
          blockReason: deadlines.blockReason,
          status: deadlines.blockedUntil && deadlines.blockedUntil > new Date() ? "BLOCKED" : "PENDING",
        },
      });
    }

    const month = new Date().toISOString().slice(0, 7);
    await tx.usageRecord.upsert({
      where: { orgId_month: { orgId: session.user.orgId!, month } },
      create: { orgId: session.user.orgId!, month, casesCreated: 1 },
      update: { casesCreated: { increment: 1 } },
    });

    return c;
  });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: newCase.id,
    action: "case.duplicated",
    details: `Duplicado desde ${original.ref} → ${ref}`,
  });

  return NextResponse.json({ id: newCase.id, ref }, { status: 201 });
}
