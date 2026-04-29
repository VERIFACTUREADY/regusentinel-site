import { prisma } from "./prisma";

const HAS_AI = !!process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

export interface SmartTask {
  category: string;
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  estimatedDays: number;
}

export interface SmartTasksResult {
  tasks: SmartTask[];
  summary: string;
  model: string;
  totalAdded: number;
}

const VALID_CATEGORIES = ["BANCOS", "SUMINISTROS", "TELECOM", "SUSCRIPCIONES", "SEGUROS", "VIDA_DIGITAL", "FISCAL", "OTROS"] as const;

const SYSTEM_PROMPT = `Eres un experto en gestión administrativa post-fallecimiento en España.
Tu tarea es generar una lista de tareas específicas y accionables para gestionar un expediente de herencia/sucesión.

Reglas:
- Genera exactamente las tareas necesarias según las categorías del expediente — ni más ni menos.
- Cada tarea debe ser concreta, específica y accionable (qué hacer, con quién, qué documento).
- No generes tareas genéricas o duplicadas.
- Ordena las tareas por orden lógico de ejecución (primero las que desbloquean a otras).
- Responde SOLO con un JSON válido, sin texto adicional, con esta estructura exacta:
{
  "tasks": [
    {
      "category": "BANCOS|SUMINISTROS|TELECOM|SUSCRIPCIONES|SEGUROS|VIDA_DIGITAL|FISCAL|OTROS",
      "title": "Título breve (max 80 chars)",
      "description": "Descripción concreta de qué hacer (max 300 chars)",
      "priority": "high|medium|low",
      "estimatedDays": <número entero de días estimados>
    }
  ],
  "summary": "Resumen en 1-2 frases de la situación del expediente"
}`;

// Default task templates per category (used as heuristic fallback)
const DEFAULT_TASKS: Record<string, SmartTask[]> = {
  BANCOS: [
    { category: "BANCOS", title: "Solicitar certificado de saldos bancarios", description: "Contactar con cada entidad bancaria para solicitar certificado de posición global a fecha de fallecimiento. Necesario para declaración de herencia.", priority: "high", estimatedDays: 15 },
    { category: "BANCOS", title: "Notificar fallecimiento a entidades bancarias", description: "Presentar certificado de defunción y acta de notoriedad/testamento en cada banco para bloquear cuentas y tramitar acceso de herederos.", priority: "high", estimatedDays: 7 },
    { category: "BANCOS", title: "Gestionar cuenta de herencia", description: "Abrir cuenta de herencia si es necesario para recibir activos del causante durante el proceso de adjudicación.", priority: "medium", estimatedDays: 30 },
  ],
  SUMINISTROS: [
    { category: "SUMINISTROS", title: "Notificar fallecimiento a compañías de suministros", description: "Informar a las compañías de luz, gas y agua del fallecimiento. Decidir si dar de baja o cambiar titular según necesidades del inmueble.", priority: "medium", estimatedDays: 14 },
    { category: "SUMINISTROS", title: "Obtener facturas pendientes de suministros", description: "Solicitar últimas facturas para liquidar deudas del causante e incluirlas en el inventario de cargas.", priority: "medium", estimatedDays: 10 },
  ],
  TELECOM: [
    { category: "TELECOM", title: "Cancelar contratos de telefonía e internet", description: "Contactar con operadora para cancelar líneas y contrato de internet del fallecido. Solicitar justificante de baja.", priority: "medium", estimatedDays: 14 },
    { category: "TELECOM", title: "Reclamar saldo pendiente en líneas prepago", description: "Si el fallecido tenía líneas prepago, reclamar el saldo pendiente como parte del activo de la herencia.", priority: "low", estimatedDays: 21 },
  ],
  SUSCRIPCIONES: [
    { category: "SUSCRIPCIONES", title: "Cancelar suscripciones activas", description: "Identificar y cancelar suscripciones de servicios (streaming, prensa, gimnasio, etc.) para evitar cargos continuados a la herencia.", priority: "medium", estimatedDays: 7 },
  ],
  SEGUROS: [
    { category: "SEGUROS", title: "Verificar existencia de seguro de vida", description: "Consultar Registro de Contratos de Seguros de Cobertura de Fallecimiento (MINECO). Solicitar copia de póliza si existe.", priority: "high", estimatedDays: 5 },
    { category: "SEGUROS", title: "Reclamar prestación del seguro de vida", description: "Presentar solicitud de prestación ante la aseguradora con documentación requerida: defunción, testamento, DNI beneficiarios.", priority: "high", estimatedDays: 30 },
    { category: "SEGUROS", title: "Revisar seguros de hogar y otros", description: "Verificar si los seguros de hogar u otros siguen vigentes y decidir sobre renovación o baja según el estado del inmueble en la herencia.", priority: "low", estimatedDays: 21 },
  ],
  VIDA_DIGITAL: [
    { category: "VIDA_DIGITAL", title: "Inventariar cuentas y activos digitales", description: "Identificar cuentas de email, redes sociales, servicios cloud, criptodivisas u otros activos digitales del fallecido.", priority: "medium", estimatedDays: 14 },
    { category: "VIDA_DIGITAL", title: "Gestionar cuentas en redes sociales", description: "Contactar con plataformas para memorializacion o cierre de perfil según voluntad del fallecido o decisión familiar.", priority: "low", estimatedDays: 30 },
  ],
  FISCAL: [
    { category: "FISCAL", title: "Obtener certificado de últimas voluntades", description: "Solicitar certificado en el Ministerio de Justicia (online o presencial). Plazo: 15 días hábiles tras inscripción de defunción.", priority: "high", estimatedDays: 7 },
    { category: "FISCAL", title: "Presentar declaración ISD (Modelo 650/660)", description: "Liquidar el Impuesto sobre Sucesiones y Donaciones. Plazo: 6 meses desde fallecimiento (prorrogable 6 meses más). Verificar bonificaciones CCAA aplicables.", priority: "high", estimatedDays: 150 },
    { category: "FISCAL", title: "Declarar incremento patrimonial en IRPF herederos", description: "Los herederos deben declarar la adquisición en su IRPF del ejercicio. Consultar con asesor fiscal las implicaciones.", priority: "medium", estimatedDays: 180 },
    { category: "FISCAL", title: "Liquidar plusvalía municipal (IIVTNU)", description: "Si hay inmuebles en la herencia, liquidar la plusvalía municipal en cada ayuntamiento donde radiquen. Plazo: 6 meses.", priority: "high", estimatedDays: 160 },
  ],
  OTROS: [
    { category: "OTROS", title: "Tramitar pensión de viudedad/orfandad", description: "Solicitar pensión de viudedad o orfandad ante el INSS si corresponde por cotizaciones del fallecido.", priority: "high", estimatedDays: 30 },
    { category: "OTROS", title: "Inventariar bienes inmuebles", description: "Obtener nota simple registral de todos los inmuebles del fallecido en el Registro de la Propiedad.", priority: "high", estimatedDays: 10 },
    { category: "OTROS", title: "Gestionar vehículos del fallecido", description: "Notificar a DGT y decidir sobre transmisión o baja de vehículos incluidos en la herencia.", priority: "medium", estimatedDays: 45 },
  ],
};

async function buildCaseContext(caseId: string): Promise<string> {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      deceased: true,
      contact: true,
      tasks: { select: { category: true, title: true, status: true } },
    },
  });
  if (!c) return "Expediente no disponible";

  const parts: string[] = [];
  parts.push(`Expediente: ${c.ref}`);
  parts.push(`Categorías del expediente: ${(c.categories || []).join(", ") || "sin especificar"}`);
  parts.push(`Provincia: ${c.province || "sin especificar"}`);

  if (c.deceased) {
    parts.push(`Fallecido: ${c.deceased.fullName}`);
    if (c.deceased.deathDate) {
      const days = Math.floor((Date.now() - c.deceased.deathDate.getTime()) / (1000 * 60 * 60 * 24));
      parts.push(`Días desde fallecimiento: ${days} (plazo ISD: ${180 - days} días restantes)`);
    }
    if (c.deceased.dni) parts.push(`DNI fallecido: disponible`);
  }

  if (c.hasDeceasedInsurance) parts.push(`Tiene seguro de vida: sí`);
  if (c.isUrgent) parts.push(`Expediente URGENTE`);
  if (c.notes) parts.push(`Notas: ${c.notes.slice(0, 200)}`);

  const existingTasks = c.tasks;
  if (existingTasks.length > 0) {
    parts.push(`\nTareas ya existentes (NO repetir):\n${existingTasks.map((t) => `- [${t.category}] ${t.title}`).join("\n")}`);
  }

  return parts.join("\n");
}

function heuristicTasks(categories: string[], existingTitles: Set<string>): SmartTask[] {
  const tasks: SmartTask[] = [];
  for (const cat of categories) {
    const defaults = DEFAULT_TASKS[cat] || [];
    for (const task of defaults) {
      if (!existingTitles.has(task.title.toLowerCase())) {
        tasks.push(task);
      }
    }
  }
  return tasks;
}

export async function generateSmartTasks(caseId: string, userId: string): Promise<SmartTasksResult> {
  const caseData = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      tasks: { select: { title: true, category: true } },
    },
  });
  if (!caseData) throw new Error("Expediente no encontrado");

  const categories: string[] = (caseData.categories || []).filter((c) =>
    VALID_CATEGORIES.includes(c as any)
  );
  if (categories.length === 0) {
    return { tasks: [], summary: "Sin categorías definidas en el expediente.", model: "stub", totalAdded: 0 };
  }

  const existingTitles = new Set(caseData.tasks.map((t) => t.title.toLowerCase()));
  const context = await buildCaseContext(caseId);

  let tasks: SmartTask[] = [];
  let summary = "";
  let modelUsed = "heuristic";

  if (HAS_AI) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const userPrompt = `Genera la lista de tareas para este expediente de gestión post-fallecimiento:

${context}

Genera solo tareas para estas categorías: ${categories.join(", ")}
No incluyas tareas que ya existan (listadas arriba).
Solo usa las categorías válidas: ${VALID_CATEGORIES.join(", ")}`;

      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 2000,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userPrompt }],
      });

      const block = msg.content[0];
      const rawText = block.type === "text" ? block.text.trim() : "{}";
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed.tasks)) {
          tasks = parsed.tasks.filter(
            (t: any) =>
              typeof t.title === "string" &&
              typeof t.category === "string" &&
              VALID_CATEGORIES.includes(t.category as any)
          );
          summary = parsed.summary || "";
          modelUsed = MODEL;
        }
      }
    } catch {
      tasks = heuristicTasks(categories, existingTitles);
      summary = `Tareas generadas automaticamente para ${categories.length} categoria(s).`;
      modelUsed = "heuristic";
    }
  } else {
    tasks = heuristicTasks(categories, existingTitles);
    summary = `Tareas sugeridas para las categorias: ${categories.join(", ")}.`;
  }

  // Filter out tasks that duplicate existing ones
  const newTasks = tasks.filter((t) => !existingTitles.has(t.title.toLowerCase()));

  // Create tasks in DB
  let added = 0;
  const now = new Date();
  for (const task of newTasks) {
    try {
      await prisma.task.create({
        data: {
          caseId,
          category: task.category as any,
          title: task.title.slice(0, 200),
          description: task.description?.slice(0, 500) || null,
          status: "PENDING",
          sortOrder: 100 + added,
          deadline:
            task.estimatedDays > 0
              ? new Date(now.getTime() + task.estimatedDays * 24 * 60 * 60 * 1000)
              : null,
        },
      });
      added++;
    } catch {
      // ignore individual failures
    }
  }

  await prisma.auditLog.create({
    data: {
      orgId: caseData.orgId,
      userId,
      action: "case.smart_tasks_generated",
      details: `${added} tareas generadas para expediente ${caseData.ref}`,
      caseId,
    },
  });

  return { tasks: newTasks, summary, model: modelUsed, totalAdded: added };
}
