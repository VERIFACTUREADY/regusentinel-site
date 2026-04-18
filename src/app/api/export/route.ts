import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "org.settings")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const orgId = session.user.orgId;

  const [org, members, cases, templates, auditLogs, notifications] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        createdAt: true,
        retentionDays: true,
        brandDisplayName: true,
        brandPrimaryColor: true,
        brandSupportEmail: true,
      },
    }),
    prisma.membership.findMany({
      where: { orgId },
      include: {
        user: { select: { id: true, email: true, name: true, createdAt: true } },
      },
    }),
    prisma.case.findMany({
      where: { orgId, deletedAt: null },
      include: {
        deceased: true,
        contact: true,
        tasks: { select: { id: true, title: true, status: true, category: true, deadline: true } },
        documents: { select: { id: true, fileName: true, mimeType: true, createdAt: true } },
      },
    }),
    prisma.template.findMany({
      where: { orgId },
      include: { versions: { orderBy: { version: "desc" }, take: 1 } },
    }),
    prisma.auditLog.findMany({
      where: { orgId },
      select: { action: true, details: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
    prisma.notificationLog.findMany({
      where: { orgId },
      select: { kind: true, channel: true, recipient: true, status: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 1000,
    }),
  ]);

  const exportData = {
    exportedAt: new Date().toISOString(),
    exportedBy: session.user.email,
    organization: org,
    members: members.map((m) => ({
      role: m.role,
      joinedAt: m.createdAt,
      user: m.user,
    })),
    cases: cases.map((c) => ({
      ref: c.ref,
      status: c.status,
      isUrgent: c.isUrgent,
      categories: c.categories,
      province: c.province,
      notes: c.notes,
      createdAt: c.createdAt,
      closedAt: c.closedAt,
      deceased: c.deceased,
      contact: c.contact,
      tasks: c.tasks,
      documentsCount: c.documents.length,
    })),
    templates: templates.map((t) => ({
      name: t.name,
      type: t.type,
      category: t.category,
      latestVersion: t.versions[0]?.version ?? 0,
      updatedAt: t.updatedAt,
    })),
    auditLogs,
    notifications,
  };

  await logAudit({
    orgId,
    userId: session.user.id,
    action: "org.data_exported",
    details: `Exportacion RGPD — ${cases.length} expedientes, ${members.length} miembros`,
  }).catch(console.error);

  const json = JSON.stringify(exportData, null, 2);

  return new Response(json, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="baritur-export-${org?.slug ?? orgId}-${new Date().toISOString().slice(0, 10)}.json"`,
    },
  });
}
