import { prisma } from "./prisma";

const HAS_AI = !!process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

export interface DocRequestResult {
  emailSubject: string;
  emailBody: string;
  documentList: string[];
  contactName: string | null;
  contactEmail: string | null;
  model: string;
}

const SYSTEM_PROMPT = `Eres un asistente especializado en gestión administrativa post-fallecimiento en España.
Redactas comunicaciones profesionales de gestoría a familias en proceso de gestión de herencia/sucesión.

Reglas:
- Usa un tono cálido, empático y profesional — la familia está pasando por un momento difícil.
- Escribe en español de España formal pero accesible.
- Sé específico: nombra cada documento concreto que se necesita.
- Incluye para qué sirve cada documento (una frase breve).
- No inventes documentos que no están en la lista proporcionada.
- Cierre con instrucciones claras sobre cómo enviar los documentos.
- No uses markdown, solo texto plano con saltos de línea.`;

// Documents typically needed per task category
const CATEGORY_DOC_HINTS: Record<string, string[]> = {
  BANCOS: ["certificado de saldos bancarios", "extractos de cuenta", "posiciones globales de inversión"],
  SEGUROS: ["póliza de seguro de vida", "certificado de beneficiarios"],
  FISCAL: ["última declaración de la renta", "certificado de IRPF", "número de referencia AEAT"],
  SUMINISTROS: ["últimas facturas de suministros (luz, gas, agua)", "contratos de suministro"],
  TELECOM: ["últimas facturas de telefonía/internet"],
  SUSCRIPCIONES: ["justificantes de suscripciones activas"],
  VIDA_DIGITAL: ["credenciales de acceso o documentación de cuentas digitales"],
  OTROS: ["documentación adicional requerida"],
};

// Always-needed documents for any succession case
const ALWAYS_NEEDED = [
  "certificado literal de defunción",
  "certificado de últimas voluntades",
  "DNI/NIE del fallecido (copia)",
  "DNI/NIE de los herederos (copia)",
  "libro de familia o certificado de parentesco",
  "testamento (si existe) o acta de notoriedad de herederos",
];

interface DocRequestInput {
  caseId: string;
  userId: string;
}

async function buildDocRequestContext(caseId: string): Promise<{
  text: string;
  documentList: string[];
  contactName: string | null;
  contactEmail: string | null;
}> {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    include: {
      deceased: true,
      contact: true,
      tasks: { where: { status: { in: ["PENDING", "IN_PROGRESS", "BLOCKED"] } } },
      documents: { select: { fileName: true, taskId: true } },
    },
  });

  if (!c) {
    return { text: "Expediente no disponible", documentList: [], contactName: null, contactEmail: null };
  }

  // Determine which documents are still missing
  const uploadedCount = c.documents.length;
  const pendingCategories = Array.from(new Set(c.tasks.map((t) => t.category as string)));

  const neededDocs: string[] = [...ALWAYS_NEEDED];
  for (const cat of pendingCategories) {
    const hints = CATEGORY_DOC_HINTS[cat] || [];
    neededDocs.push(...hints);
  }

  // Deduplicate
  const uniqueDocs = Array.from(new Set(neededDocs));

  const deceasedName = c.deceased?.fullName || "el/la fallecido/a";
  const contactName = c.contact?.fullName || null;

  const parts: string[] = [];
  parts.push(`Expediente: ${c.ref}`);
  parts.push(`Fallecido: ${deceasedName}`);
  if (c.deceased?.deathDate) {
    const days = Math.floor((Date.now() - c.deceased.deathDate.getTime()) / (1000 * 60 * 60 * 24));
    parts.push(`Días desde fallecimiento: ${days}`);
    const isdDays = 180 - days;
    if (isdDays > 0) parts.push(`Plazo ISD restante: ${isdDays} días`);
  }
  parts.push(`Solicitante: ${contactName || "familia"}`);
  parts.push(`Documentos ya recibidos: ${uploadedCount}`);
  parts.push(`Trámites pendientes: ${c.tasks.map((t) => `${t.category} - ${t.title}`).join("; ")}`);
  parts.push(`\nDocumentos necesarios:\n${uniqueDocs.map((d, i) => `${i + 1}. ${d}`).join("\n")}`);

  return {
    text: parts.join("\n"),
    documentList: uniqueDocs,
    contactName,
    contactEmail: c.contact?.email || null,
  };
}

function heuristicDocRequest(
  context: Awaited<ReturnType<typeof buildDocRequestContext>>,
  ref: string
): DocRequestResult {
  const { contactName, contactEmail, documentList } = context;
  const salutation = contactName ? `Estimado/a ${contactName}` : "Estimada familia";
  const docLines = documentList.map((d, i) => `  ${i + 1}. ${d.charAt(0).toUpperCase() + d.slice(1)}`).join("\n");

  const body = `${salutation},

En relación con el expediente de gestión post-fallecimiento que tenemos en trámite (ref. ${ref}), nos ponemos en contacto con usted para solicitarle la documentación necesaria para continuar con los trámites.

Para poder avanzar en la gestión, necesitamos que nos haga llegar los siguientes documentos:

${docLines}

Puede enviarnos la documentación de cualquiera de estas formas:
- Por correo electrónico como adjuntos escaneados o fotografiados
- Presencialmente en nuestra oficina en horario de atención al público
- A través del portal de clientes si dispone de acceso

Si ya nos ha enviado alguno de estos documentos, por favor indíquenoslo para actualizar nuestros registros.

Quedamos a su disposición para cualquier consulta.

Atentamente,
El equipo de gestión`;

  return {
    emailSubject: `Solicitud de documentación - Expediente ${ref}`,
    emailBody: body,
    documentList,
    contactName,
    contactEmail,
    model: "heuristic",
  };
}

export async function generateDocRequest({ caseId, userId }: DocRequestInput): Promise<DocRequestResult> {
  const ctx = await buildDocRequestContext(caseId);
  const caseRef = await prisma.case.findUnique({ where: { id: caseId }, select: { ref: true } });
  const ref = caseRef?.ref || "S/N";

  let emailSubject: string;
  let emailBody: string;
  let modelUsed = "stub";

  if (HAS_AI) {
    const Anthropic = (await import("@anthropic-ai/sdk")).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const userPrompt = `Genera un email de solicitud de documentación para la familia con los siguientes datos del expediente:

${ctx.text}

El email debe:
1. Comenzar con "Asunto: [asunto del email]" en la primera línea
2. Dejar una línea en blanco
3. Continuar con el cuerpo del email
4. Mencionar específicamente cada documento de la lista y para qué se necesita
5. Incluir instrucciones claras para enviar la documentación
6. Cerrar con despedida profesional`;

    const msg = await client.messages.create({
      model: MODEL,
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const block = msg.content[0];
    const fullText = block.type === "text" ? block.text.trim() : "";
    const lines = fullText.split("\n");
    const subjectLine = lines[0] || "";
    emailSubject = subjectLine.replace(/^[Aa]sunto:\s*/i, "").trim() || `Solicitud de documentación - ${ref}`;
    emailBody = lines.slice(2).join("\n").trim();
    modelUsed = MODEL;

    await prisma.promptLog.create({
      data: {
        caseId,
        userId,
        action: "doc_request",
        prompt: ctx.text,
        response: JSON.stringify({ emailSubject, emailBody, documentList: ctx.documentList }),
        model: modelUsed,
        tokens: msg.usage ? msg.usage.input_tokens + msg.usage.output_tokens : null,
      },
    });
  } else {
    const result = heuristicDocRequest(ctx, ref);
    emailSubject = result.emailSubject;
    emailBody = result.emailBody;
    modelUsed = "heuristic";

    await prisma.promptLog.create({
      data: {
        caseId,
        userId,
        action: "doc_request",
        prompt: ctx.text,
        response: JSON.stringify({ emailSubject, emailBody, documentList: ctx.documentList }),
        model: modelUsed,
        tokens: null,
      },
    });
  }

  return {
    emailSubject,
    emailBody,
    documentList: ctx.documentList,
    contactName: ctx.contactName,
    contactEmail: ctx.contactEmail,
    model: modelUsed,
  };
}

export async function getLastDocRequest(caseId: string): Promise<DocRequestResult | null> {
  const log = await prisma.promptLog.findFirst({
    where: { caseId, action: "doc_request" },
    orderBy: { createdAt: "desc" },
  });
  if (!log) return null;
  try {
    const parsed = JSON.parse(log.response);
    return {
      emailSubject: parsed.emailSubject || "",
      emailBody: parsed.emailBody || "",
      documentList: parsed.documentList || [],
      contactName: null,
      contactEmail: null,
      model: log.model || "unknown",
    };
  } catch {
    return null;
  }
}
