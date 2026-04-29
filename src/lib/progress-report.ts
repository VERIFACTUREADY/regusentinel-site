import { prisma } from "./prisma";

const HAS_AI = !!process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

export interface ProgressReportResult {
  subject: string;
  body: string;
  completedItems: string[];
  pendingItems: string[];
  nextSteps: string[];
  contactName: string | null;
  contactEmail: string | null;
  model: string;
}

const SYSTEM_PROMPT = `Eres un gestor administrativo especializado en herencias y post-fallecimiento en España.
Redactas cartas de actualización para familias que están pasando por un proceso de gestión de herencia.

Reglas de redacción:
- Tono cálido, empático y profesional. La familia está pasando por un momento difícil.
- Escribe en español de España, claro y comprensible para personas sin conocimientos legales.
- Explica qué se ha completado, en qué estado está cada trámite y qué es lo siguiente.
- No uses tecnicismos sin explicarlos brevemente.
- No menciones datos internos del sistema (IDs, refs técnicas, nombres de campos).
- La carta debe tranquilizar a la familia y generar confianza.
- Responde SOLO con JSON, sin texto adicional:
{
  "subject": "Asunto del email (max 80 chars)",
  "body": "Cuerpo completo de la carta, varios párrafos, texto plano con saltos de línea",
  "completedItems": ["Lista de trámites completados (strings concisos)"],
  "pendingItems": ["Lista de trámites en curso o pendientes"],
  "nextSteps": ["Próximos 2-3 pasos concretos que se van a tomar"]
}`;

const TASK_STATUS_LABELS: Record<string, string> = {
  DONE: "completada",
  SKIPPED: "no aplicable",
  IN_PROGRESS: "en tramitación",
  PENDING: "pendiente de inicio",
  BLOCKED: "pendiente de documentación",
  READY: "lista para envío",
  APPROVED: "aprobada",
};

const CATEGORY_LABELS: Record<string, string> = {
  BANCOS: "gestión bancaria",
  SUMINISTROS: "suministros del hogar",
  TELECOM: "telecomunicaciones",
  SUSCRIPCIONES: "suscripciones y servicios",
  SEGUROS: "seguros",
  VIDA_DIGITAL: "identidad digital",
  FISCAL: "trámites fiscales (ISD, IRPF)",
  OTROS: "otros trámites",
};

async function buildReportContext(caseId: string): Promise<{
  text: string;
  completedItems: string[];
  pendingItems: string[];
  contactName: string | null;
  contactEmail: string | null;
  ref: string;
}> {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      deceased: true,
      contact: true,
      tasks: { orderBy: { sortOrder: "asc" } },
      documents: { select: { fileName: true, taskId: true } },
    },
  });
  if (!c) throw new Error("Expediente no encontrado");

  const parts: string[] = [];
  parts.push(`Expediente: ${c.ref}`);
  parts.push(`Estado actual: ${c.status}`);

  if (c.deceased) {
    parts.push(`Fallecido: ${c.deceased.fullName}`);
    if (c.deceased.deathDate) {
      const days = Math.floor((Date.now() - c.deceased.deathDate.getTime()) / (1000 * 60 * 60 * 24));
      parts.push(`Fallecimiento: hace ${days} días`);
      const isdDays = 180 - days;
      if (isdDays > 0) parts.push(`Plazo ISD: ${isdDays} días restantes`);
    }
  }
  if (c.contact) {
    parts.push(`Contacto: ${c.contact.fullName}${c.contact.relationship ? `, ${c.contact.relationship}` : ""}`);
  }
  parts.push(`Documentos recibidos: ${c.documents.length}`);

  const done = c.tasks.filter((t) => t.status === "DONE" || t.status === "SKIPPED");
  const active = c.tasks.filter((t) => t.status === "IN_PROGRESS" || t.status === "READY");
  const pending = c.tasks.filter((t) => t.status === "PENDING" || t.status === "BLOCKED");

  const completedItems = done.map((t) => `${CATEGORY_LABELS[t.category] || t.category}: ${t.title}`);
  const pendingItems = [
    ...active.map((t) => `[en curso] ${CATEGORY_LABELS[t.category] || t.category}: ${t.title}`),
    ...pending.slice(0, 6).map((t) => `[${t.status === "BLOCKED" ? "pendiente docs" : "pendiente"}] ${CATEGORY_LABELS[t.category] || t.category}: ${t.title}`),
  ];

  parts.push(`\nTrámites completados (${done.length}):`);
  done.forEach((t) => parts.push(`✓ [${CATEGORY_LABELS[t.category] || t.category}] ${t.title}`));

  parts.push(`\nTrámites en curso (${active.length}):`);
  active.forEach((t) => parts.push(`→ [${CATEGORY_LABELS[t.category] || t.category}] ${t.title}`));

  parts.push(`\nTrámites pendientes (${pending.length}):`);
  pending.slice(0, 8).forEach((t) => {
    let line = `○ [${CATEGORY_LABELS[t.category] || t.category}] ${t.title}`;
    if (t.status === "BLOCKED" && t.blockReason) line += ` (bloqueado: ${t.blockReason})`;
    parts.push(line);
  });

  if (c.notes) parts.push(`\nNotas relevantes: ${c.notes.slice(0, 300)}`);

  return {
    text: parts.join("\n"),
    completedItems,
    pendingItems,
    contactName: c.contact?.fullName || null,
    contactEmail: c.contact?.email || null,
    ref: c.ref,
  };
}

function heuristicReport(
  ctx: Awaited<ReturnType<typeof buildReportContext>>
): ProgressReportResult {
  const { contactName, contactEmail, ref, completedItems, pendingItems } = ctx;
  const salutation = contactName ? `Estimado/a ${contactName}` : "Estimada familia";

  const completedText =
    completedItems.length > 0
      ? `\nA continuación le informamos de los trámites ya completados:\n${completedItems.map((i) => `  · ${i}`).join("\n")}\n`
      : "";

  const pendingText =
    pendingItems.length > 0
      ? `\nActualmente tenemos en proceso los siguientes trámites:\n${pendingItems.map((i) => `  · ${i}`).join("\n")}\n`
      : "";

  const body = `${salutation},

Nos ponemos en contacto con usted para informarle del estado actual de los trámites de gestión del fallecimiento (expediente ${ref}).
${completedText}${pendingText}
Continuamos trabajando para resolver todos los trámites pendientes lo antes posible. Ante cualquier duda o si necesita información adicional, no dude en contactarnos.

Quedamos a su disposición.

Atentamente,
El equipo de gestión`;

  const nextSteps =
    pendingItems.length > 0
      ? pendingItems.slice(0, 3).map((i) => i.replace(/^\[.*?\] /, ""))
      : ["Seguimiento de trámites en curso", "Revisión de documentación pendiente"];

  return {
    subject: `Actualización de gestión — Expediente ${ref}`,
    body,
    completedItems,
    pendingItems,
    nextSteps,
    contactName,
    contactEmail,
    model: "heuristic",
  };
}

export async function generateProgressReport(caseId: string, userId: string): Promise<ProgressReportResult> {
  const ctx = await buildReportContext(caseId);

  let subject: string;
  let body: string;
  let completedItems = ctx.completedItems;
  let pendingItems = ctx.pendingItems;
  let nextSteps: string[] = [];
  let modelUsed = "heuristic";

  if (HAS_AI) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Genera una carta de actualización de estado para la familia basándote en estos datos del expediente:\n\n${ctx.text}\n\nEl contacto principal es: ${ctx.contactName || "la familia"}`,
          },
        ],
      });

      const block = msg.content[0];
      const rawText = block.type === "text" ? block.text.trim() : "{}";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        subject = parsed.subject || `Actualización de gestión — Expediente ${ctx.ref}`;
        body = parsed.body || "";
        if (Array.isArray(parsed.completedItems)) completedItems = parsed.completedItems;
        if (Array.isArray(parsed.pendingItems)) pendingItems = parsed.pendingItems;
        if (Array.isArray(parsed.nextSteps)) nextSteps = parsed.nextSteps;
        modelUsed = MODEL;
      } else {
        const fallback = heuristicReport(ctx);
        ({ subject, body, nextSteps } = fallback);
      }
    } catch {
      const fallback = heuristicReport(ctx);
      ({ subject, body, completedItems, pendingItems, nextSteps } = fallback);
    }
  } else {
    const fallback = heuristicReport(ctx);
    ({ subject, body, completedItems, pendingItems, nextSteps } = fallback);
  }

  await prisma.promptLog.create({
    data: {
      caseId,
      userId,
      action: "progress_report",
      prompt: ctx.text,
      response: JSON.stringify({ subject, body, completedItems, pendingItems, nextSteps }),
      model: modelUsed,
      tokens: null,
    },
  });

  return {
    subject: subject!,
    body: body!,
    completedItems,
    pendingItems,
    nextSteps,
    contactName: ctx.contactName,
    contactEmail: ctx.contactEmail,
    model: modelUsed,
  };
}

export async function getLastProgressReport(caseId: string): Promise<ProgressReportResult | null> {
  const log = await prisma.promptLog.findFirst({
    where: { caseId, action: "progress_report" },
    orderBy: { createdAt: "desc" },
  });
  if (!log) return null;
  try {
    const parsed = JSON.parse(log.response);
    return {
      subject: parsed.subject || "",
      body: parsed.body || "",
      completedItems: parsed.completedItems || [],
      pendingItems: parsed.pendingItems || [],
      nextSteps: parsed.nextSteps || [],
      contactName: null,
      contactEmail: null,
      model: log.model || "unknown",
    };
  } catch {
    return null;
  }
}
