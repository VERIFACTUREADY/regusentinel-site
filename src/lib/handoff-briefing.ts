import { prisma } from "./prisma";

const HAS_AI = !!process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

export interface HandoffBriefingResult {
  title: string;
  generatedAt: string;
  caseRef: string;
  sections: {
    heading: string;
    content: string;
  }[];
  openItems: { priority: "high" | "medium" | "low"; text: string }[];
  alerts: string[];
  model: string;
}

const SYSTEM_PROMPT = `Eres un gestor administrativo experto en herencias y trámites post-fallecimiento en España.

Redactas un "briefing de traspaso" conciso para que un colega pueda hacerse cargo de un expediente sin necesidad de hacer preguntas. El briefing debe cubrir:

1. Estado actual y resumen ejecutivo (2-3 frases)
2. Personas involucradas y sus datos clave
3. Plazos críticos (especialmente ISD)
4. Trámites completados (lo más relevante)
5. Trámites pendientes y bloqueados
6. Documentación: qué está y qué falta
7. Puntos de atención o riesgos

Responde SOLO con JSON válido:
{
  "title": "Briefing de traspaso — <Nombre fallecido> (<Ref>)",
  "sections": [
    { "heading": "<nombre sección>", "content": "<texto claro, profesional, sin markdown, máx 150 palabras por sección>" }
  ],
  "openItems": [
    { "priority": "high" | "medium" | "low", "text": "<acción pendiente concreta>" }
  ],
  "alerts": ["<alerta urgente si la hay>"]
}

Reglas:
- Máximo 5 secciones, máximo 6 openItems, máximo 3 alerts
- Español de España, claro y directo, sin emojis
- Si no hay datos suficientes para una sección, omítela
- openItems ordenados de mayor a menor prioridad`;

export async function generateHandoffBriefing(
  caseId: string,
  userId: string
): Promise<HandoffBriefingResult> {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      deceased: true,
      contact: true,
      tasks: {
        include: { assignee: { select: { name: true, email: true } } },
        orderBy: { sortOrder: "asc" },
      },
      documents: {
        select: { id: true, fileName: true, taskId: true, createdAt: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!c) throw new Error("Expediente no encontrado");

  // Get latest analysis if available
  const lastAnalysis = await prisma.promptLog.findFirst({
    where: { caseId, action: "analyze_case" },
    orderBy: { createdAt: "desc" },
    select: { response: true, createdAt: true },
  });
  let healthScore: number | null = null;
  let analysisSummary: string | null = null;
  if (lastAnalysis) {
    try {
      const r = JSON.parse(lastAnalysis.response || "{}");
      healthScore = typeof r.healthScore === "number" ? r.healthScore : null;
      analysisSummary = r.summary || null;
    } catch {
      // ignore
    }
  }

  const context = buildContext(c, healthScore, analysisSummary);

  let result: HandoffBriefingResult;

  if (HAS_AI) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 1500,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: context }],
      });
      const block = msg.content[0];
      const raw = block.type === "text" ? block.text.trim() : "";
      const jsonStr = extractJson(raw);
      const parsed = JSON.parse(jsonStr);
      result = {
        title: String(parsed.title || `Briefing — ${c.ref}`),
        generatedAt: new Date().toISOString(),
        caseRef: c.ref,
        sections: Array.isArray(parsed.sections) ? parsed.sections.slice(0, 5) : [],
        openItems: Array.isArray(parsed.openItems) ? parsed.openItems.slice(0, 6) : [],
        alerts: Array.isArray(parsed.alerts) ? parsed.alerts.slice(0, 3) : [],
        model: MODEL,
      };
    } catch {
      result = heuristicBriefing(c, healthScore);
    }
  } else {
    result = heuristicBriefing(c, healthScore);
  }

  await prisma.promptLog.create({
    data: {
      caseId,
      userId,
      action: "handoff_briefing",
      prompt: context.slice(0, 500),
      response: JSON.stringify(result),
      model: result.model,
    },
  });

  return result;
}

export async function getLastHandoffBriefing(
  caseId: string
): Promise<HandoffBriefingResult | null> {
  const log = await prisma.promptLog.findFirst({
    where: { caseId, action: "handoff_briefing" },
    orderBy: { createdAt: "desc" },
    select: { response: true },
  });
  if (!log) return null;
  try {
    return JSON.parse(log.response) as HandoffBriefingResult;
  } catch {
    return null;
  }
}

function extractJson(raw: string): string {
  const fence = raw.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fence) return fence[1];
  const obj = raw.match(/\{[\s\S]+\}/);
  return obj ? obj[0] : raw;
}

function buildContext(c: any, healthScore: number | null, analysisSummary: string | null): string {
  const lines: string[] = [];
  lines.push(`Expediente: ${c.ref}`);
  lines.push(`Estado: ${c.status}`);
  if (c.isUrgent) lines.push("URGENTE: SI");
  lines.push(`Provincia: ${c.province || "no especificada"}`);
  lines.push(`Categorías: ${(c.categories || []).join(", ")}`);
  lines.push(`Creado: ${new Date(c.createdAt).toLocaleDateString("es-ES")}`);
  if (healthScore !== null) lines.push(`Score de salud: ${healthScore}/100`);
  if (analysisSummary) lines.push(`Última análisis IA: ${analysisSummary}`);

  if (c.deceased) {
    lines.push(`\nFALLECIDO`);
    lines.push(`Nombre: ${c.deceased.fullName}`);
    if (c.deceased.deathDate) {
      const days = Math.floor((Date.now() - new Date(c.deceased.deathDate).getTime()) / 86400000);
      const isd = 180 - days;
      lines.push(`Fecha fallecimiento: ${new Date(c.deceased.deathDate).toLocaleDateString("es-ES")} (${days} días)`);
      lines.push(`Plazo ISD restante: ${isd} días${isd <= 0 ? " *** VENCIDO ***" : isd <= 30 ? " *** CRÍTICO ***" : isd <= 60 ? " *** ATENCIÓN ***" : ""}`);
    }
    if (c.deceased.dni) lines.push(`DNI: ${c.deceased.dni}`);
  }

  if (c.contact) {
    lines.push(`\nSOLICITANTE`);
    lines.push(`Nombre: ${c.contact.fullName}`);
    if (c.contact.relationship) lines.push(`Relación: ${c.contact.relationship}`);
    if (c.contact.phone) lines.push(`Teléfono: ${c.contact.phone}`);
    if (c.contact.email) lines.push(`Email: ${c.contact.email}`);
  }

  const tasks = c.tasks || [];
  const done = tasks.filter((t: any) => t.status === "DONE");
  const inProgress = tasks.filter((t: any) => t.status === "IN_PROGRESS");
  const blocked = tasks.filter((t: any) => t.status === "BLOCKED");
  const pending = tasks.filter((t: any) => t.status === "PENDING");
  const overdue = tasks.filter((t: any) => t.deadline && new Date(t.deadline) < new Date() && !["DONE", "SKIPPED"].includes(t.status));

  lines.push(`\nTAREAS: ${tasks.length} total (${done.length} hechas, ${inProgress.length} en curso, ${blocked.length} bloqueadas, ${pending.length} pendientes, ${overdue.length} vencidas)`);
  if (inProgress.length) lines.push(`En curso: ${inProgress.map((t: any) => t.title).join("; ")}`);
  if (blocked.length) lines.push(`Bloqueadas: ${blocked.map((t: any) => `${t.title}${t.blockReason ? ` [${t.blockReason}]` : ""}`).join("; ")}`);
  if (overdue.length) lines.push(`Vencidas: ${overdue.map((t: any) => t.title).join("; ")}`);

  const docs = c.documents || [];
  lines.push(`\nDOCUMENTOS: ${docs.length} total`);
  if (docs.length) {
    const linked = docs.filter((d: any) => d.taskId).length;
    lines.push(`${linked} vinculados a tareas, ${docs.length - linked} sin vincular`);
  }

  if (c.notes) lines.push(`\nNOTAS INTERNAS:\n${c.notes}`);

  return lines.join("\n");
}

function heuristicBriefing(c: any, healthScore: number | null): HandoffBriefingResult {
  const tasks = c.tasks || [];
  const done = tasks.filter((t: any) => t.status === "DONE");
  const inProgress = tasks.filter((t: any) => t.status === "IN_PROGRESS");
  const blocked = tasks.filter((t: any) => t.status === "BLOCKED");
  const overdue = tasks.filter((t: any) => t.deadline && new Date(t.deadline) < new Date() && !["DONE", "SKIPPED"].includes(t.status));

  const isdDays = c.deceased?.deathDate
    ? 180 - Math.floor((Date.now() - new Date(c.deceased.deathDate).getTime()) / 86400000)
    : null;

  const sections: { heading: string; content: string }[] = [
    {
      heading: "Estado actual",
      content: `Expediente ${c.ref} en estado "${c.status}". ${tasks.length} tareas registradas: ${done.length} completadas, ${inProgress.length} en curso, ${blocked.length} bloqueadas.${healthScore !== null ? ` Score de salud: ${healthScore}/100.` : ""}`,
    },
  ];

  if (c.deceased || c.contact) {
    const parts = [];
    if (c.deceased) parts.push(`Fallecido: ${c.deceased.fullName}${c.deceased.deathDate ? `, fallecido el ${new Date(c.deceased.deathDate).toLocaleDateString("es-ES")}` : ""}.`);
    if (c.contact) parts.push(`Solicitante: ${c.contact.fullName}${c.contact.relationship ? ` (${c.contact.relationship})` : ""}${c.contact.phone ? `, tel. ${c.contact.phone}` : ""}.`);
    sections.push({ heading: "Personas", content: parts.join(" ") });
  }

  if (isdDays !== null) {
    sections.push({
      heading: "Plazo ISD",
      content: isdDays <= 0
        ? `Plazo ISD VENCIDO hace ${Math.abs(isdDays)} días. Requiere atención inmediata.`
        : `Quedan ${isdDays} días para el plazo de 6 meses del ISD (Modelo 650).`,
    });
  }

  if (inProgress.length || done.length) {
    const parts = [];
    if (done.length) parts.push(`Completados: ${done.slice(0, 5).map((t: any) => t.title).join(", ")}.`);
    if (inProgress.length) parts.push(`En curso: ${inProgress.map((t: any) => t.title).join(", ")}.`);
    sections.push({ heading: "Trámites", content: parts.join(" ") });
  }

  const openItems: { priority: "high" | "medium" | "low"; text: string }[] = [];
  for (const t of overdue.slice(0, 3)) openItems.push({ priority: "high", text: `Tarea vencida: ${t.title}` });
  for (const t of blocked.slice(0, 3)) openItems.push({ priority: "medium", text: `Tarea bloqueada: ${t.title}${t.blockReason ? ` — ${t.blockReason}` : ""}` });
  for (const t of inProgress.slice(0, 2)) openItems.push({ priority: "low", text: `Continuar: ${t.title}` });

  const alerts: string[] = [];
  if (isdDays !== null && isdDays <= 0) alerts.push(`Plazo ISD vencido`);
  else if (isdDays !== null && isdDays <= 30) alerts.push(`Plazo ISD crítico: ${isdDays} días`);
  if (overdue.length) alerts.push(`${overdue.length} tarea(s) con plazo vencido`);

  return {
    title: `Briefing de traspaso — ${c.deceased?.fullName || "Expediente"} (${c.ref})`,
    generatedAt: new Date().toISOString(),
    caseRef: c.ref,
    sections,
    openItems: openItems.slice(0, 6),
    alerts: alerts.slice(0, 3),
    model: "heuristic",
  };
}
