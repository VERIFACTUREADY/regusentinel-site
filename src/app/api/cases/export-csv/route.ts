import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { CATEGORY_LABELS } from "@/lib/constants";

function escapeCsv(value: string | null | undefined): string {
  if (!value) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const STATUS_LABELS: Record<string, string> = {
  INTAKE: "Recepcion",
  VALIDATION: "Validacion",
  IN_PROGRESS: "En curso",
  PENDING_DOCS: "Docs pendientes",
  READY_TO_SEND: "Listo para enviar",
  SENT: "Enviado",
  FOLLOW_UP: "Seguimiento",
  CLOSED: "Cerrado",
  ARCHIVED: "Archivado",
};

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.read")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const orgId = session.user.orgId;
  const url = new URL(req.url);
  const status = url.searchParams.get("status");
  const category = url.searchParams.get("category");
  const province = url.searchParams.get("province");
  const urgent = url.searchParams.get("urgent");
  const isdExpiring = url.searchParams.get("isdExpiring");
  const search = url.searchParams.get("search");

  const now = new Date();
  const conditions: Record<string, unknown>[] = [{ orgId, deletedAt: null }];
  if (status) {
    conditions.push({ status: status.includes(",") ? { in: status.split(",") } : status });
  }
  if (category) conditions.push({ categories: { has: category } });
  if (urgent === "true") conditions.push({ isUrgent: true });
  if (province) conditions.push({ province });
  if (isdExpiring) {
    const days = parseInt(isdExpiring) || 30;
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    conditions.push({ isdDeadline: { lte: cutoff, gte: now } });
  }
  if (search) {
    conditions.push({
      OR: [
        { ref: { contains: search, mode: "insensitive" } },
        { deceased: { fullName: { contains: search, mode: "insensitive" } } },
        { contact: { fullName: { contains: search, mode: "insensitive" } } },
      ],
    });
  }

  const cases = await prisma.case.findMany({
    where: { AND: conditions } as any,
    include: {
      deceased: { select: { fullName: true, deathDate: true, dni: true } },
      contact: { select: { fullName: true, phone: true, email: true, relationship: true } },
      _count: { select: { tasks: true, documents: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 5000,
  });

  const headers = [
    "Referencia",
    "Estado",
    "Urgente",
    "Categorias",
    "Provincia",
    "Fallecido",
    "DNI Fallecido",
    "Fecha fallecimiento",
    "Contacto",
    "Telefono contacto",
    "Email contacto",
    "Relacion",
    "Tareas",
    "Documentos",
    "ISD deadline",
    "Salud (%)",
    "Creado",
    "Cerrado",
  ];

  const rows = cases.map((c) => [
    escapeCsv(c.ref),
    escapeCsv(STATUS_LABELS[c.status] || c.status),
    c.isUrgent ? "Si" : "No",
    escapeCsv((c.categories as string[]).map((cat) => CATEGORY_LABELS[cat] || cat).join("; ")),
    escapeCsv(c.province),
    escapeCsv(c.deceased?.fullName),
    escapeCsv(c.deceased?.dni),
    c.deceased?.deathDate ? new Date(c.deceased.deathDate).toLocaleDateString("es-ES") : "",
    escapeCsv(c.contact?.fullName),
    escapeCsv(c.contact?.phone),
    escapeCsv(c.contact?.email),
    escapeCsv(c.contact?.relationship),
    String(c._count.tasks),
    String(c._count.documents),
    (c as any).isdDeadline ? new Date((c as any).isdDeadline).toLocaleDateString("es-ES") : "",
    (c as any).healthScore != null ? String((c as any).healthScore) : "",
    new Date(c.createdAt).toLocaleDateString("es-ES"),
    c.closedAt ? new Date(c.closedAt).toLocaleDateString("es-ES") : "",
  ]);

  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
  const bom = "\uFEFF";

  return new NextResponse(bom + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="expedientes_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
