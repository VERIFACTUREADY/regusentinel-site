import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getChecklistForCategories } from "@/lib/checklist-rules";
import { calculateTaskDeadlines } from "@/lib/deadline-engine";
import { csvToRows, xlsxToRows, parseSpreadsheet } from "@/lib/case-import";

const MAX_ROWS = 200;
const MAX_CSV_SIZE = 1_000_000;       // 1 MB raw text
const MAX_XLSX_SIZE_BASE64 = 4_000_000; // ~3 MB binary

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.create")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const csv = typeof body.csv === "string" ? body.csv : null;
  const xlsx = typeof body.xlsx === "string" ? body.xlsx : null;

  if (!csv && !xlsx) {
    return NextResponse.json({ error: "Envía 'csv' o 'xlsx'" }, { status: 400 });
  }
  if (csv && csv.length > MAX_CSV_SIZE) {
    return NextResponse.json({ error: "CSV demasiado grande (máx 1 MB)" }, { status: 400 });
  }
  if (xlsx && xlsx.length > MAX_XLSX_SIZE_BASE64) {
    return NextResponse.json({ error: "Excel demasiado grande (máx ~3 MB)" }, { status: 400 });
  }

  let rows: string[][];
  try {
    rows = xlsx ? xlsxToRows(xlsx) : csvToRows(csv!);
  } catch {
    return NextResponse.json(
      { error: xlsx ? "El archivo Excel no es válido" : "No se pudo leer el CSV" },
      { status: 400 },
    );
  }

  const result = parseSpreadsheet(rows);
  if (result.headerIssue) {
    return NextResponse.json({ error: result.headerIssue }, { status: 400 });
  }
  if (result.total > MAX_ROWS) {
    return NextResponse.json({
      error: `Máximo ${MAX_ROWS} filas por importación. El archivo tiene ${result.total}.`,
    }, { status: 400 });
  }

  const { parsed, errors, total } = result;

  if (body.validate) {
    return NextResponse.json({ valid: parsed.length, errors, total });
  }

  if (errors.length > 0) {
    return NextResponse.json({
      error: "Errores de validación",
      valid: parsed.length,
      errors,
      total,
    }, { status: 400 });
  }

  const orgId = session.user.orgId;
  const baseCount = await prisma.case.count({ where: { orgId } });
  const year = new Date().getFullYear();
  const month = new Date().toISOString().slice(0, 7);

  const created: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const row = parsed[i];
    const ref = `EXP-${year}-${String(baseCount + i + 1).padStart(4, "0")}`;

    await prisma.$transaction(async (tx) => {
      const c = await tx.case.create({
        data: {
          orgId,
          ref,
          categories: row.categories,
          province: row.province || null,
          isUrgent: row.isUrgent,
          consentAccepted: true,
          consentDate: new Date(),
          notes: row.notes || null,
          deceased: {
            create: {
              fullName: row.deceasedName,
              deathDate: row.deathDate ? new Date(row.deathDate) : null,
              dni: row.deceasedDni || null,
            },
          },
          contact: {
            create: {
              fullName: row.contactName,
              phone: row.contactPhone || null,
              email: row.contactEmail || null,
              relationship: row.contactRelationship || null,
            },
          },
        },
      });

      const tasks = getChecklistForCategories(row.categories);
      const deathDate = row.deathDate ? new Date(row.deathDate) : new Date();
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

      await tx.usageRecord.upsert({
        where: { orgId_month: { orgId, month } },
        create: { orgId, month, casesCreated: 1 },
        update: { casesCreated: { increment: 1 } },
      });

      created.push(ref);
    });
  }

  await logAudit({
    orgId,
    userId: session.user.id,
    action: "cases.imported",
    details: `${created.length} expedientes importados (${xlsx ? "Excel" : "CSV"})`,
  });

  return NextResponse.json({ created: created.length, refs: created }, { status: 201 });
}
