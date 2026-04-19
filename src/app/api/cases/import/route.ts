import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";
import { logAudit } from "@/lib/audit";
import { getChecklistForCategories } from "@/lib/checklist-rules";
import { calculateTaskDeadlines } from "@/lib/deadline-engine";
import { TaskCategory } from "@prisma/client";

const VALID_CATEGORIES = new Set(Object.values(TaskCategory));
const MAX_ROWS = 200;

interface ParsedRow {
  row: number;
  deceasedName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  province: string;
  categories: TaskCategory[];
  deathDate: string;
  deceasedDni: string;
  contactRelationship: string;
  isUrgent: boolean;
  notes: string;
}

interface RowError {
  row: number;
  field: string;
  message: string;
}

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === "," || ch === ";") {
      fields.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

const EXPECTED_HEADERS = [
  "fallecido", "contacto", "email_contacto", "telefono_contacto",
  "provincia", "categorias", "fecha_fallecimiento", "dni_fallecido",
  "parentesco", "urgente", "notas",
];

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.create")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const body = await req.json();
  const csv = body.csv as string;
  if (!csv || typeof csv !== "string") {
    return NextResponse.json({ error: "CSV vacio" }, { status: 400 });
  }

  const lines = csv.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) {
    return NextResponse.json({ error: "El CSV debe tener al menos una cabecera y una fila de datos" }, { status: 400 });
  }

  const headerLine = parseCSVLine(lines[0]).map((h) =>
    h.toLowerCase().replace(/[^a-z_]/g, "")
  );

  const colIndex: Record<string, number> = {};
  for (const expected of EXPECTED_HEADERS) {
    const idx = headerLine.indexOf(expected);
    if (idx !== -1) colIndex[expected] = idx;
  }

  if (colIndex["fallecido"] === undefined || colIndex["contacto"] === undefined) {
    return NextResponse.json({
      error: "Cabeceras obligatorias no encontradas: 'fallecido' y 'contacto'. Cabeceras esperadas: " + EXPECTED_HEADERS.join(", "),
    }, { status: 400 });
  }

  const dataLines = lines.slice(1);
  if (dataLines.length > MAX_ROWS) {
    return NextResponse.json({
      error: `Maximo ${MAX_ROWS} filas por importacion. El archivo tiene ${dataLines.length}.`,
    }, { status: 400 });
  }

  const parsed: ParsedRow[] = [];
  const errors: RowError[] = [];

  for (let i = 0; i < dataLines.length; i++) {
    const rowNum = i + 2;
    const fields = parseCSVLine(dataLines[i]);
    const get = (key: string) => (colIndex[key] !== undefined ? fields[colIndex[key]] || "" : "");

    const deceasedName = get("fallecido");
    const contactName = get("contacto");
    const contactEmail = get("email_contacto");
    const contactPhone = get("telefono_contacto");

    if (!deceasedName) errors.push({ row: rowNum, field: "fallecido", message: "Nombre del fallecido obligatorio" });
    if (!contactName) errors.push({ row: rowNum, field: "contacto", message: "Nombre del contacto obligatorio" });
    if (!contactEmail && !contactPhone) {
      errors.push({ row: rowNum, field: "email_contacto", message: "Se requiere al menos email o telefono" });
    }

    const rawCategories = get("categorias");
    const categories: TaskCategory[] = [];
    if (rawCategories) {
      for (const cat of rawCategories.split(/[,;|]+/).map((c) => c.trim().toUpperCase())) {
        if (VALID_CATEGORIES.has(cat as TaskCategory)) {
          categories.push(cat as TaskCategory);
        } else if (cat) {
          errors.push({ row: rowNum, field: "categorias", message: `Categoria invalida: "${cat}". Validas: ${Array.from(VALID_CATEGORIES).join(", ")}` });
        }
      }
    }
    if (categories.length === 0) categories.push(TaskCategory.OTROS);

    const deathDate = get("fecha_fallecimiento");
    if (deathDate && isNaN(Date.parse(deathDate))) {
      errors.push({ row: rowNum, field: "fecha_fallecimiento", message: "Formato de fecha invalido" });
    }

    const urgentRaw = get("urgente").toLowerCase();
    const isUrgent = urgentRaw === "true" || urgentRaw === "si" || urgentRaw === "sí" || urgentRaw === "1";

    if (errors.filter((e) => e.row === rowNum).length === 0) {
      parsed.push({
        row: rowNum,
        deceasedName,
        contactName,
        contactEmail,
        contactPhone,
        province: get("provincia"),
        categories,
        deathDate,
        deceasedDni: get("dni_fallecido"),
        contactRelationship: get("parentesco"),
        isUrgent,
        notes: get("notas"),
      });
    }
  }

  if (body.validate) {
    return NextResponse.json({
      valid: parsed.length,
      errors,
      total: dataLines.length,
    });
  }

  if (errors.length > 0) {
    return NextResponse.json({
      error: "Errores de validacion",
      valid: parsed.length,
      errors,
      total: dataLines.length,
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
    details: `${created.length} expedientes importados por CSV`,
  });

  return NextResponse.json({
    created: created.length,
    refs: created,
  }, { status: 201 });
}
