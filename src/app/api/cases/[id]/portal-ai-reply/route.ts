import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { hasPermission } from "@/lib/rbac";

const HAS_AI = !!process.env.ANTHROPIC_API_KEY;
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `Eres un gestor administrativo especializado en herencias y gestión post-fallecimiento en España.
Redactas respuestas profesionales y empáticas a mensajes de familias que están pasando por el proceso de herencia.

Reglas:
- Tono cálido, profesional y tranquilizador. La familia está pasando por un momento difícil.
- Responde directamente a la pregunta o preocupación planteada.
- Sé concreto: si hay información en el contexto del expediente, úsala.
- Escribe en español de España formal pero accesible.
- No inventes información que no esté en el contexto.
- Responde solo con el texto del mensaje (sin asunto, sin formato markdown).
- Cierra con "Quedamos a su disposición" o similar.
- Máximo 200 palabras.`;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.orgId || !session.user.role) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  if (!hasPermission(session.user.role, "cases.write")) {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    include: {
      deceased: { select: { fullName: true, deathDate: true } },
      contact: { select: { fullName: true, relationship: true } },
      tasks: {
        select: { title: true, status: true, category: true },
        where: { status: { in: ["IN_PROGRESS", "BLOCKED", "DONE"] } },
        take: 8,
      },
    },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const lastMessage = String(body.lastMessage || "").trim();

  // Build case context snippet
  const parts: string[] = [];
  parts.push(`Expediente: ${c.ref}`);
  if (c.deceased) parts.push(`Fallecido: ${c.deceased.fullName}`);
  if (c.deceased?.deathDate) {
    const days = Math.floor((Date.now() - c.deceased.deathDate.getTime()) / (1000 * 60 * 60 * 24));
    parts.push(`Días desde fallecimiento: ${days}`);
    const isdDays = 180 - days;
    if (isdDays > 0) parts.push(`Plazo ISD restante: ${isdDays} días`);
  }
  if (c.contact) parts.push(`Contacto: ${c.contact.fullName}${c.contact.relationship ? `, ${c.contact.relationship}` : ""}`);
  const inProgress = c.tasks.filter((t) => t.status === "IN_PROGRESS");
  const done = c.tasks.filter((t) => t.status === "DONE");
  if (inProgress.length) parts.push(`Trámites en curso: ${inProgress.map((t) => t.title).join(", ")}`);
  if (done.length) parts.push(`Trámites completados recientemente: ${done.slice(0, 3).map((t) => t.title).join(", ")}`);

  const context = parts.join("\n");

  let reply: string;

  if (HAS_AI && lastMessage) {
    try {
      const Anthropic = (await import("@anthropic-ai/sdk")).default;
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

      const msg = await client.messages.create({
        model: MODEL,
        max_tokens: 400,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Contexto del expediente:\n${context}\n\nMensaje de la familia:\n"${lastMessage}"\n\nRedacta una respuesta profesional y empática.`,
          },
        ],
      });
      const block = msg.content[0];
      reply = block.type === "text" ? block.text.trim() : "";
    } catch {
      reply = buildHeuristicReply(c.contact?.fullName || null, inProgress.length, done.length);
    }
  } else {
    reply = buildHeuristicReply(c.contact?.fullName || null, inProgress.length, done.length);
  }

  return NextResponse.json({ reply });
}

function buildHeuristicReply(
  contactName: string | null,
  inProgressCount: number,
  doneCount: number
): string {
  const salutation = contactName ? `Estimado/a ${contactName}` : "Estimada familia";
  const progress =
    inProgressCount > 0
      ? `Actualmente tenemos ${inProgressCount} trámite${inProgressCount !== 1 ? "s" : ""} en curso${doneCount > 0 ? ` y ya hemos completado ${doneCount}` : ""}.`
      : doneCount > 0
      ? `Hemos completado ${doneCount} trámite${doneCount !== 1 ? "s" : ""} hasta el momento.`
      : "Estamos trabajando en todos los trámites pendientes.";

  return `${salutation},\n\nGracias por su mensaje. ${progress} Le mantendremos informado de cualquier novedad relevante.\n\nQuedamos a su disposición para cualquier consulta adicional.\n\nAtentamente,\nEl equipo de gestión`;
}
