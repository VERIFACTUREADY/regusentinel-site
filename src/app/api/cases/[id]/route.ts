import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getCaseDeadlines } from "@/lib/deadline-engine";
import { triggerWorkflow } from "@/lib/workflow-engine";

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    include: {
      deceased: true,
      contact: true,
      tasks: {
        orderBy: { sortOrder: "asc" },
        include: {
          documents: { select: { id: true, fileName: true } },
          assignee: { select: { id: true, name: true, email: true } },
          _count: { select: { notes: true } },
          dependsOn: { select: { id: true, title: true, status: true } },
        },
      },
      documents: { include: { task: { select: { id: true, title: true, category: true } } } },
      approvals: true,
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  // Auto-unblock tasks whose blockedUntil date has passed
  const now = new Date();
  const tasksToUnblock = c.tasks.filter(
    (t) => t.status === "BLOCKED" && t.blockedUntil && new Date(t.blockedUntil) <= now
  );
  if (tasksToUnblock.length > 0) {
    await prisma.task.updateMany({
      where: { id: { in: tasksToUnblock.map((t) => t.id) } },
      data: { status: "PENDING", blockReason: null },
    });
    // Re-fetch with updated statuses
    const updated = await prisma.case.findFirst({
      where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
      include: {
        deceased: true,
        contact: true,
        tasks: {
          orderBy: { sortOrder: "asc" },
          include: {
            documents: { select: { id: true, fileName: true } },
            assignee: { select: { id: true, name: true, email: true } },
            _count: { select: { notes: true } },
            dependsOn: { select: { id: true, title: true, status: true } },
          },
        },
        documents: { include: { task: { select: { id: true, title: true, category: true } } } },
        approvals: true,
        auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true, email: true } } },
      },
      },
    });
    // Add case-level deadlines
    const deathDate = updated?.deceased?.deathDate;
    const caseDeadlines = deathDate ? getCaseDeadlines(new Date(deathDate)) : null;
    return NextResponse.json({ ...updated, caseDeadlines });
  }

  // Add case-level deadlines
  const deathDate = c.deceased?.deathDate;
  const caseDeadlines = deathDate ? getCaseDeadlines(new Date(deathDate)) : null;
  return NextResponse.json({ ...c, caseDeadlines });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.update")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const body = await req.json();
  const {
    status, notes, isUrgent, legitimationNote, consentAccepted, deceased,
    contact, province, categories, hasDeceasedInsurance, portalEnabled,
    hasUrbanProperty, propertyAcquisitionValue, propertyTransmissionValue,
    preexistingPatrimony, recentResidenceChange, previousResidenceProvince,
  } = body;

  const numericOrNull = (v: unknown): number | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  const updated = await prisma.case.update({
    where: { id: params.id },
    data: {
      ...(status && { status }),
      ...(notes !== undefined && { notes }),
      ...(isUrgent !== undefined && { isUrgent }),
      ...(status === "CLOSED" && { closedAt: new Date() }),
      ...(legitimationNote !== undefined && { legitimationNote }),
      ...(consentAccepted !== undefined && {
        consentAccepted,
        consentDate: consentAccepted ? new Date() : null,
      }),
      ...(province !== undefined && { province: province?.trim() || null }),
      ...(Array.isArray(categories) && { categories }),
      ...(hasDeceasedInsurance !== undefined && { hasDeceasedInsurance }),
      ...(portalEnabled !== undefined && { portalEnabled }),
      ...(hasUrbanProperty !== undefined && { hasUrbanProperty: Boolean(hasUrbanProperty) }),
      ...(propertyAcquisitionValue !== undefined && {
        propertyAcquisitionValue: numericOrNull(propertyAcquisitionValue),
      }),
      ...(propertyTransmissionValue !== undefined && {
        propertyTransmissionValue: numericOrNull(propertyTransmissionValue),
      }),
      ...(preexistingPatrimony !== undefined && {
        preexistingPatrimony: numericOrNull(preexistingPatrimony),
      }),
      ...(recentResidenceChange !== undefined && {
        recentResidenceChange: Boolean(recentResidenceChange),
      }),
      ...(previousResidenceProvince !== undefined && {
        previousResidenceProvince:
          typeof previousResidenceProvince === "string" && previousResidenceProvince.trim()
            ? previousResidenceProvince.trim()
            : null,
      }),
    },
    include: { deceased: true, contact: true },
  });

  // Update deceased info if provided
  if (deceased && typeof deceased === "object") {
    const deceasedData: Record<string, unknown> = {};
    if (deceased.fullName?.trim()) deceasedData.fullName = deceased.fullName.trim();
    if (deceased.deathDate !== undefined) deceasedData.deathDate = deceased.deathDate ? new Date(deceased.deathDate) : null;
    if (deceased.dni !== undefined) deceasedData.dni = deceased.dni?.trim() || null;
    if (Object.keys(deceasedData).length > 0) {
      await prisma.deceased.update({ where: { caseId: params.id }, data: deceasedData });
      await logAudit({
        orgId: session.user.orgId,
        userId: session.user.id,
        caseId: params.id,
        action: "case.deceased_updated",
        details: `Datos del fallecido actualizados`,
      });
    }
  }

  // Update contact info if provided
  if (contact && typeof contact === "object") {
    const contactData: Record<string, unknown> = {};
    if (contact.fullName?.trim()) contactData.fullName = contact.fullName.trim();
    if (contact.phone !== undefined) contactData.phone = contact.phone?.trim() || null;
    if (contact.email !== undefined) contactData.email = contact.email?.trim() || null;
    if (contact.relationship !== undefined) contactData.relationship = contact.relationship?.trim() || null;
    if (Object.keys(contactData).length > 0) {
      await prisma.caseContact.update({ where: { caseId: params.id }, data: contactData });
      await logAudit({
        orgId: session.user.orgId,
        userId: session.user.id,
        caseId: params.id,
        action: "case.contact_updated",
        details: `Datos del solicitante actualizados`,
      });
    }
  }

  if (portalEnabled !== undefined && portalEnabled !== c.portalEnabled) {
    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId: params.id,
      action: portalEnabled ? "case.portal_enabled" : "case.portal_disabled",
      details: `Acceso al portal ${portalEnabled ? "habilitado" : "deshabilitado"}`,
    });
  }

  if (status && status !== c.status) {
    await logAudit({
      orgId: session.user.orgId,
      userId: session.user.id,
      caseId: params.id,
      action: "case.status_changed",
      details: `${c.status} -> ${status}`,
    });
    // Fire-and-forget workflow triggers
    triggerWorkflow({
      type: "CASE_STATUS_CHANGED",
      orgId: session.user.orgId,
      caseId: params.id,
      userId: session.user.id,
      fromStatus: c.status,
      toStatus: status,
    }).catch(console.error);
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.delete")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  await prisma.case.update({ where: { id: params.id }, data: { deletedAt: new Date() } });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: params.id,
    action: "case.deleted",
    details: `Expediente ${c.ref} eliminado (borrado logico)`,
  });

  return NextResponse.json({ success: true });
}
