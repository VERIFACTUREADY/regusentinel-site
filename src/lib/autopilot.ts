import { prisma } from "./prisma";
import { getChecklistForCategories } from "./checklist-rules";
import type { TaskCategory } from "@prisma/client";

interface CaseData {
  id: string;
  categories: TaskCategory[];
  deceased?: { fullName: string; deathDate?: Date | null; dni?: string | null } | null;
  contact?: { fullName: string; phone?: string | null; email?: string | null; relationship?: string | null } | null;
  province?: string | null;
  isUrgent: boolean;
  hasDeceasedInsurance: boolean;
}

const HAS_AI = !!process.env.ANTHROPIC_API_KEY;

async function callAI(prompt: string): Promise<string> {
  if (!HAS_AI) throw new Error("No AI key");
  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    messages: [{ role: "user", content: prompt }],
  });
  const block = msg.content[0];
  return block.type === "text" ? block.text : "";
}

export async function generateChecklist(
  caseData: CaseData,
  userId: string
): Promise<{ category: TaskCategory; title: string; description: string; sortOrder: number }[]> {
  const stubResult = getChecklistForCategories(caseData.categories);

  if (HAS_AI) {
    try {
      const prompt = `Eres un experto en gestión administrativa post-fallecimiento en España.
Dado un expediente con las siguientes categorías: ${caseData.categories.join(", ")}.
Fallecido: ${caseData.deceased?.fullName || "N/A"}, Provincia: ${caseData.province || "N/A"}.
${caseData.hasDeceasedInsurance ? "Tiene seguro de decesos." : ""}
${caseData.isUrgent ? "Es URGENTE." : ""}

Genera un checklist JSON de tareas necesarias. Formato:
[{"category":"BANCOS","title":"...","description":"...","sortOrder":1}]
Solo responde con el JSON array, sin explicación.`;

      const response = await callAI(prompt);
      await prisma.promptLog.create({
        data: { caseId: caseData.id, userId, action: "generate_checklist", prompt, response, model: "claude-sonnet-4-20250514" },
      });
      const parsed = JSON.parse(response);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // Fall through to stub
    }
  }

  await prisma.promptLog.create({
    data: {
      caseId: caseData.id,
      userId,
      action: "generate_checklist",
      prompt: `[STUB] categories=${caseData.categories.join(",")}`,
      response: JSON.stringify(stubResult),
      model: "stub",
    },
  });

  return stubResult;
}

export async function generateDraft(
  templateBody: string,
  caseData: CaseData,
  userId: string
): Promise<string> {
  const variables: Record<string, string> = {
    "deceased.fullName": caseData.deceased?.fullName || "[NOMBRE FALLECIDO]",
    "deceased.dni": caseData.deceased?.dni || "[DNI FALLECIDO]",
    "deceased.deathDate": caseData.deceased?.deathDate
      ? new Date(caseData.deceased.deathDate).toLocaleDateString("es-ES")
      : "[FECHA FALLECIMIENTO]",
    "contact.fullName": caseData.contact?.fullName || "[NOMBRE SOLICITANTE]",
    "contact.phone": caseData.contact?.phone || "[TELEFONO]",
    "contact.email": caseData.contact?.email || "[EMAIL]",
    "contact.relationship": caseData.contact?.relationship || "[RELACION]",
    "case.province": caseData.province || "[PROVINCIA]",
    "date.today": new Date().toLocaleDateString("es-ES"),
  };

  let rendered = templateBody;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key.replace(".", "\\.")}\\}\\}`, "g"), value);
  }

  if (HAS_AI) {
    try {
      const prompt = `Eres un asistente de gestión administrativa post-fallecimiento en España.
Revisa y mejora este borrador de comunicación manteniendo el tono formal y profesional.
NO cambies datos específicos (nombres, fechas, DNIs). Solo mejora redacción si es necesario.

Borrador:
${rendered}

Responde SOLO con el texto mejorado, sin comentarios adicionales.`;

      const response = await callAI(prompt);
      await prisma.promptLog.create({
        data: { caseId: caseData.id, userId, action: "generate_draft", prompt, response, model: "claude-sonnet-4-20250514" },
      });
      return response;
    } catch {
      // Fall through to simple render
    }
  }

  await prisma.promptLog.create({
    data: {
      caseId: caseData.id,
      userId,
      action: "generate_draft",
      prompt: `[STUB] template render`,
      response: rendered,
      model: "stub",
    },
  });

  return rendered;
}
