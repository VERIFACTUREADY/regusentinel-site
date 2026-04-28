import { prisma } from "./prisma";

export interface CaseAnalysisResult {
  healthScore: number; // 0-100
  status: "excellent" | "good" | "warning" | "critical";
  summary: string;
  criticalIssues: { title: string; description: string; severity: "low" | "medium" | "high" }[];
  suggestedActions: { title: string; description: string; priority: "low" | "medium" | "high" }[];
  risks: { category: string; description: string; mitigation: string }[];
  estimatedDaysToClose: number | null;
  generatedAt: string;
  model: string;
}

const HAS_AI = !!process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

interface AnalysisInput {
  caseId: string;
  userId: string;
}

function buildContext(caseData: any): string {
  const parts: string[] = [];

  parts.push(`# Expediente ${caseData.ref}`);
  parts.push(`Estado: ${caseData.status}`);
  if (caseData.isUrgent) parts.push(`URGENTE: SI`);
  parts.push(`Provincia: ${caseData.province || "no especificada"}`);
  parts.push(`Categorias: ${(caseData.categories || []).join(", ")}`);
  parts.push(`Creado: ${new Date(caseData.createdAt).toLocaleDateString("es-ES")}`);

  if (caseData.deceased) {
    parts.push(`\n## Fallecido`);
    parts.push(`Nombre: ${caseData.deceased.fullName}`);
    if (caseData.deceased.deathDate) {
      const days = Math.floor((Date.now() - new Date(caseData.deceased.deathDate).getTime()) / (1000 * 60 * 60 * 24));
      parts.push(`Fecha fallecimiento: ${new Date(caseData.deceased.deathDate).toLocaleDateString("es-ES")} (hace ${days} dias)`);
      const isdDays = 180 - days;
      parts.push(`Plazo ISD restante: ${isdDays} dias ${isdDays < 30 ? "*** CRITICO ***" : isdDays < 60 ? "*** ATENCION ***" : ""}`);
    }
  }

  if (caseData.contact) {
    parts.push(`\n## Solicitante`);
    parts.push(`Nombre: ${caseData.contact.fullName}, Relacion: ${caseData.contact.relationship || "no especificada"}`);
  }

  if (caseData.notes) {
    parts.push(`\n## Notas internas\n${caseData.notes}`);
  }

  // Tasks summary
  const tasks = caseData.tasks || [];
  const byStatus: Record<string, any[]> = {};
  for (const t of tasks) {
    (byStatus[t.status] = byStatus[t.status] || []).push(t);
  }
  parts.push(`\n## Tareas (${tasks.length} total)`);
  for (const [status, items] of Object.entries(byStatus)) {
    parts.push(`\n### ${status} (${items.length})`);
    for (const t of items) {
      let line = `- [${t.category}] ${t.title}`;
      if (t.assignee) line += ` (asignada a ${t.assignee.name || t.assignee.email})`;
      if (t.deadline) {
        const d = Math.ceil((new Date(t.deadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        line += ` [plazo: ${d}d]`;
      }
      if (t.blockReason && t.status === "BLOCKED") {
        line += ` [bloqueada: ${t.blockReason}]`;
      }
      parts.push(line);
    }
  }

  parts.push(`\n## Documentos\n${(caseData.documents || []).length} documentos subidos`);
  const linkedDocs = (caseData.documents || []).filter((d: any) => d.taskId).length;
  parts.push(`${linkedDocs} vinculados a tareas, ${(caseData.documents || []).length - linkedDocs} sin vincular`);

  if (caseData.caseDeadlines) {
    parts.push(`\n## Plazos legales calculados`);
    parts.push(`- Certificados disponibles: ${new Date(caseData.caseDeadlines.certificatesAvailable).toLocaleDateString("es-ES")}`);
    parts.push(`- Solicitud prorroga ISD: ${new Date(caseData.caseDeadlines.isdExtensionRequestDeadline).toLocaleDateString("es-ES")}`);
    parts.push(`- Limite ISD (Modelo 650): ${new Date(caseData.caseDeadlines.isdDeadline).toLocaleDateString("es-ES")}`);
  }

  return parts.join("\n");
}

const SYSTEM_PROMPT = `Eres un consultor experto en gestion administrativa post-fallecimiento en España (sucesiones, ISD, tramites bancarios, AEAT).

Analizas un expediente y devuelves un diagnostico ejecutivo en JSON estricto. Tu objetivo es ayudar al gestor a identificar:
1. Riesgos urgentes (plazos legales en peligro, tareas bloqueadas hace tiempo, documentos faltantes criticos)
2. Acciones siguientes priorizadas
3. Score de salud del expediente

Responde SOLO con un objeto JSON valido con esta estructura exacta:

{
  "healthScore": <numero 0-100>,
  "status": "excellent" | "good" | "warning" | "critical",
  "summary": "<resumen ejecutivo de 2-3 frases>",
  "criticalIssues": [
    { "title": "<titulo corto>", "description": "<explicacion>", "severity": "low" | "medium" | "high" }
  ],
  "suggestedActions": [
    { "title": "<accion concreta>", "description": "<como ejecutarla>", "priority": "low" | "medium" | "high" }
  ],
  "risks": [
    { "category": "<fiscal|legal|documental|temporal|operativo>", "description": "<riesgo>", "mitigation": "<como mitigarlo>" }
  ],
  "estimatedDaysToClose": <numero estimado o null si no hay datos suficientes>
}

Criterios de scoring:
- 90-100 (excellent): Todo en orden, plazos amplios, tareas avanzando.
- 70-89 (good): Progreso normal, sin urgencias.
- 40-69 (warning): Hay riesgos visibles que requieren atencion en proximos dias.
- 0-39 (critical): Plazos vencidos o muy cercanos, multiples bloqueos, falta documentacion clave.

Reglas estrictas:
- ISD < 30 dias = riesgo CRITICAL automatico
- Mas de 3 tareas bloqueadas hace mas de 7 dias = warning minimo
- Sin certificados base 60 dias post-fallecimiento = warning
- Maximo 4 acciones sugeridas, ordenadas por prioridad descendente
- Maximo 3 critical issues
- Lenguaje claro, en español de España, sin emojis ni markdown en los strings JSON
- No inventes datos que no estan en el contexto`;

export async function analyzeCase({ caseId, userId }: AnalysisInput): Promise<CaseAnalysisResult> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      deceased: true,
      contact: true,
      tasks: {
        include: { assignee: { select: { name: true, email: true } } },
        orderBy: { sortOrder: "asc" },
      },
      documents: { select: { id: true, fileName: true, taskId: true, createdAt: true } },
    },
  });

  if (!caseData) throw new Error("Caso no encontrado");

  // Compute case-level deadlines
  const enriched: any = { ...caseData };
  if (caseData.deceased?.deathDate) {
    const death = new Date(caseData.deceased.deathDate);
    const certificatesAvailable = new Date(death);
    certificatesAvailable.setDate(certificatesAvailable.getDate() + 22);
    const isdDeadline = new Date(death);
    isdDeadline.setMonth(isdDeadline.getMonth() + 6);
    const isdExtensionRequestDeadline = new Date(death);
    isdExtensionRequestDeadline.setMonth(isdExtensionRequestDeadline.getMonth() + 5);
    enriched.caseDeadlines = {
      certificatesAvailable: certificatesAvailable.toISOString(),
      isdExtensionRequestDeadline: isdExtensionRequestDeadline.toISOString(),
      isdDeadline: isdDeadline.toISOString(),
    };
  }

  const context = buildContext(enriched);

  if (!HAS_AI) {
    // Heuristic stub when no AI key available
    const result = heuristicAnalysis(enriched);
    await prisma.promptLog.create({
      data: {
        caseId,
        userId,
        action: "analyze_case",
        prompt: `[STUB] heuristic analysis`,
        response: JSON.stringify(result),
        model: "stub",
      },
    });
    return result;
  }

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: context }],
  });

  const block = msg.content[0];
  const raw = block.type === "text" ? block.text : "";

  // Robust JSON extraction (handle ```json fences)
  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]+?)\s*```/);
  if (fenceMatch) jsonStr = fenceMatch[1];
  const objMatch = jsonStr.match(/\{[\s\S]+\}/);
  if (objMatch) jsonStr = objMatch[0];

  let parsed: any;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    // Fallback to heuristic if AI response is malformed
    parsed = heuristicAnalysis(enriched);
  }

  const result: CaseAnalysisResult = {
    healthScore: clampScore(parsed.healthScore),
    status: validStatus(parsed.status),
    summary: String(parsed.summary || "Analisis no disponible"),
    criticalIssues: Array.isArray(parsed.criticalIssues) ? parsed.criticalIssues.slice(0, 3) : [],
    suggestedActions: Array.isArray(parsed.suggestedActions) ? parsed.suggestedActions.slice(0, 4) : [],
    risks: Array.isArray(parsed.risks) ? parsed.risks.slice(0, 5) : [],
    estimatedDaysToClose: typeof parsed.estimatedDaysToClose === "number" ? parsed.estimatedDaysToClose : null,
    generatedAt: new Date().toISOString(),
    model: MODEL,
  };

  await prisma.promptLog.create({
    data: {
      caseId,
      userId,
      action: "analyze_case",
      prompt: context,
      response: JSON.stringify(result),
      model: MODEL,
      tokens: msg.usage ? msg.usage.input_tokens + msg.usage.output_tokens : null,
    },
  });

  return result;
}

export async function getLatestAnalysis(caseId: string): Promise<CaseAnalysisResult | null> {
  const log = await prisma.promptLog.findFirst({
    where: { caseId, action: "analyze_case" },
    orderBy: { createdAt: "desc" },
  });
  if (!log) return null;
  try {
    const parsed = JSON.parse(log.response);
    return {
      ...parsed,
      generatedAt: parsed.generatedAt || log.createdAt.toISOString(),
      model: parsed.model || log.model || "stub",
    };
  } catch {
    return null;
  }
}

function clampScore(n: any): number {
  const num = Number(n);
  if (!isFinite(num)) return 50;
  return Math.max(0, Math.min(100, Math.round(num)));
}

function validStatus(s: any): CaseAnalysisResult["status"] {
  if (s === "excellent" || s === "good" || s === "warning" || s === "critical") return s;
  return "good";
}

export function heuristicAnalysis(caseData: any): CaseAnalysisResult {
  const tasks = caseData.tasks || [];
  const total = tasks.length;
  const done = tasks.filter((t: any) => t.status === "DONE" || t.status === "SKIPPED").length;
  const blocked = tasks.filter((t: any) => t.status === "BLOCKED").length;
  const overdue = tasks.filter((t: any) => t.deadline && new Date(t.deadline) < new Date() && t.status !== "DONE" && t.status !== "SKIPPED").length;

  const criticalIssues: CaseAnalysisResult["criticalIssues"] = [];
  const suggestedActions: CaseAnalysisResult["suggestedActions"] = [];
  const risks: CaseAnalysisResult["risks"] = [];

  let isdDays: number | null = null;
  if (caseData.deceased?.deathDate) {
    const days = Math.floor((Date.now() - new Date(caseData.deceased.deathDate).getTime()) / (1000 * 60 * 60 * 24));
    isdDays = 180 - days;
    if (isdDays < 30) {
      criticalIssues.push({
        title: "Plazo ISD critico",
        description: `Quedan ${isdDays} dias para presentar el Modelo 650. Considera solicitar prorroga si no esta lista la documentacion.`,
        severity: "high",
      });
      suggestedActions.push({
        title: "Solicitar prorroga ISD",
        description: "Si faltan documentos clave, presenta solicitud de prorroga inmediatamente.",
        priority: "high",
      });
      risks.push({
        category: "fiscal",
        description: "Riesgo de sancion AEAT por presentacion fuera de plazo",
        mitigation: "Solicitar prorroga de 6 meses adicionales antes del dia 150 desde el fallecimiento",
      });
    } else if (isdDays < 60) {
      criticalIssues.push({
        title: "Plazo ISD se acerca",
        description: `Quedan ${isdDays} dias. Acelera la recopilacion de documentos.`,
        severity: "medium",
      });
    }
  }

  if (blocked >= 3) {
    criticalIssues.push({
      title: `${blocked} tareas bloqueadas`,
      description: "Multiples tareas detenidas. Revisa los motivos de bloqueo y desbloqueea las que sea posible.",
      severity: "medium",
    });
    suggestedActions.push({
      title: "Revisar tareas bloqueadas",
      description: "Identifica si los bloqueos son por documentacion pendiente, terceros o errores en la planificacion.",
      priority: "medium",
    });
  }

  if (overdue > 0) {
    suggestedActions.push({
      title: `Atender ${overdue} tarea(s) vencida(s)`,
      description: "Prioriza tareas con plazo vencido para evitar mayores retrasos.",
      priority: "high",
    });
  }

  const progressPct = total > 0 ? Math.round((done / total) * 100) : 0;
  let healthScore = 100 - blocked * 5 - overdue * 8;
  if (isdDays !== null && isdDays < 30) healthScore -= 30;
  else if (isdDays !== null && isdDays < 60) healthScore -= 15;
  if (progressPct < 20 && total > 5) healthScore -= 10;
  healthScore = Math.max(0, Math.min(100, healthScore));

  const status: CaseAnalysisResult["status"] =
    healthScore >= 90 ? "excellent" :
    healthScore >= 70 ? "good" :
    healthScore >= 40 ? "warning" : "critical";

  const summary = `Expediente con ${total} tareas (${progressPct}% completadas)${blocked > 0 ? `, ${blocked} bloqueadas` : ""}${overdue > 0 ? `, ${overdue} vencidas` : ""}.${isdDays !== null ? ` Plazo ISD: ${isdDays} dias.` : ""}`;

  return {
    healthScore,
    status,
    summary,
    criticalIssues,
    suggestedActions,
    risks,
    estimatedDaysToClose: total > 0 && progressPct > 0 ? Math.round((100 - progressPct) * 1.5) : null,
    generatedAt: new Date().toISOString(),
    model: "heuristic",
  };
}
