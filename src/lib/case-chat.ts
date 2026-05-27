import { prisma } from "./prisma";

const HAS_AI = !!process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";
const MAX_HISTORY_MESSAGES = 10;

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatInput {
  caseId: string;
  userId: string;
  message: string;
}

interface ChatResult {
  response: string;
  history: ChatMessage[];
  model: string;
}

const SYSTEM_PROMPT = `Eres un asistente especializado en gestión administrativa post-fallecimiento en España (sucesiones, herencias, ISD, trámites bancarios, AEAT, registros, notarías).

Estás integrado en el sistema Heredia y respondes preguntas concretas sobre un expediente específico. Te proporciono el contexto del expediente al inicio de la conversación.

Reglas:
- Responde siempre en español de España.
- Sé conciso, directo y operativo: lo que el gestor necesita saber para actuar.
- Cita datos concretos del expediente cuando sea relevante (ref, fechas, plazos).
- Si no tienes la información, dilo claramente — no inventes datos del expediente que no aparecen en el contexto.
- Cuando recomiendes una acción, sé específico: qué hacer, qué documento, qué plazo.
- Para temas legales/fiscales complejos, recuerda al gestor que la decisión final es suya y debe verificar con la normativa vigente.
- Usa formato markdown solo para listas cortas. Evita títulos largos. No uses emojis.`;

async function buildCaseContext(caseId: string): Promise<string> {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      deceased: true,
      contact: true,
      tasks: { orderBy: { sortOrder: "asc" } },
      documents: { select: { fileName: true, taskId: true, createdAt: true } },
    },
  });
  if (!c) return "Expediente no disponible";

  const parts: string[] = [];
  parts.push(`# Expediente ${c.ref}`);
  parts.push(`Estado: ${c.status}`);
  if (c.isUrgent) parts.push(`URGENTE`);
  parts.push(`Provincia: ${c.province || "no especificada"}`);
  parts.push(`Categorías: ${(c.categories || []).join(", ")}`);
  parts.push(`Creado: ${c.createdAt.toLocaleDateString("es-ES")}`);

  if (c.deceased) {
    parts.push(`\n## Fallecido`);
    parts.push(`${c.deceased.fullName}${c.deceased.dni ? ` (DNI ${c.deceased.dni})` : ""}`);
    if (c.deceased.deathDate) {
      const days = Math.floor((Date.now() - c.deceased.deathDate.getTime()) / (1000 * 60 * 60 * 24));
      parts.push(`Fallecimiento: ${c.deceased.deathDate.toLocaleDateString("es-ES")} (hace ${days} días)`);
      const isd = 180 - days;
      parts.push(`Plazo ISD restante: ${isd} días`);
    }
  }
  if (c.contact) {
    parts.push(`\n## Solicitante`);
    parts.push(`${c.contact.fullName}${c.contact.relationship ? `, ${c.contact.relationship}` : ""}${c.contact.phone ? `, tel ${c.contact.phone}` : ""}${c.contact.email ? `, email ${c.contact.email}` : ""}`);
  }
  if (c.notes) {
    parts.push(`\n## Notas internas\n${c.notes}`);
  }
  if (c.legitimationNote) {
    parts.push(`\n## Legitimación\n${c.legitimationNote}`);
  }

  parts.push(`\n## Tareas (${c.tasks.length} total)`);
  for (const t of c.tasks) {
    let line = `- [${t.status}] [${t.category}] ${t.title}`;
    if (t.deadline) {
      const d = Math.ceil((t.deadline.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      line += ` (plazo ${d}d)`;
    }
    if (t.blockReason && t.status === "BLOCKED") line += ` [bloqueada: ${t.blockReason}]`;
    parts.push(line);
  }

  parts.push(`\n## Documentos (${c.documents.length} total)`);
  for (const d of c.documents.slice(0, 20)) {
    parts.push(`- ${d.fileName}${d.taskId ? " [vinculado]" : " [sin vincular]"}`);
  }

  return parts.join("\n");
}

export async function getChatHistory(caseId: string, limit = MAX_HISTORY_MESSAGES): Promise<ChatMessage[]> {
  const logs = await prisma.promptLog.findMany({
    where: { caseId, action: "case_chat" },
    orderBy: { createdAt: "asc" },
    take: limit * 2,
  });

  const history: ChatMessage[] = [];
  for (const log of logs) {
    try {
      const parsed = JSON.parse(log.response);
      if (parsed.userMessage) history.push({ role: "user", content: parsed.userMessage });
      if (parsed.assistantMessage) history.push({ role: "assistant", content: parsed.assistantMessage });
    } catch {
      // ignore malformed entries
    }
  }
  return history;
}

export async function sendChatMessage({ caseId, userId, message }: ChatInput): Promise<ChatResult> {
  const trimmedMessage = message.trim();
  if (!trimmedMessage) throw new Error("Mensaje vacío");
  if (trimmedMessage.length > 2000) throw new Error("Mensaje demasiado largo (máx 2000 caracteres)");

  const context = await buildCaseContext(caseId);
  const history = await getChatHistory(caseId, MAX_HISTORY_MESSAGES);

  let assistantMessage: string;
  let modelUsed = "stub";
  let tokenCount: number | null = null;

  if (HAS_AI) {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const messages = [
      ...history.slice(-MAX_HISTORY_MESSAGES).map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: trimmedMessage },
    ];

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: `${SYSTEM_PROMPT}\n\n## CONTEXTO DEL EXPEDIENTE\n\n${context}`,
      messages,
    });
    const block = msg.content[0];
    assistantMessage = block.type === "text" ? block.text.trim() : "Sin respuesta";
    modelUsed = MODEL;
    tokenCount = msg.usage ? msg.usage.input_tokens + msg.usage.output_tokens : null;
  } else {
    assistantMessage = "El asistente IA no está configurado en este entorno. Contacta con el administrador para activar la clave de API.";
  }

  await prisma.promptLog.create({
    data: {
      caseId,
      userId,
      action: "case_chat",
      prompt: trimmedMessage,
      response: JSON.stringify({ userMessage: trimmedMessage, assistantMessage }),
      model: modelUsed,
      tokens: tokenCount,
    },
  });

  return {
    response: assistantMessage,
    history: [...history, { role: "user", content: trimmedMessage }, { role: "assistant", content: assistantMessage }],
    model: modelUsed,
  };
}
