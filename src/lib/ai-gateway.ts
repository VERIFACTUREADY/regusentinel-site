/**
 * Puerta única de salida hacia el modelo externo.
 *
 * POR QUÉ EXISTE
 * --------------
 * La minimización de datos personales estaba implementada **sólo** en
 * `case-analyzer.ts`. Los otros siete puntos que hablan con Anthropic —chat de
 * expediente, autopilot, tareas sugeridas, respuesta al portal de la familia,
 * relevo de turno, informes de progreso y generación de peticiones de
 * documentos— construían su propio prompt y llamaban al SDK directamente, con
 * el contexto en crudo: nombre del causante, nombre y email del contacto,
 * teléfonos, DNI y el nombre del empleado asignado a cada tarea.
 *
 * Parchear siete sitios deja el problema abierto para el octavo. Este módulo es
 * el único que instancia el cliente: **todo** el texto que sale pasa por
 * `minimizeContext`, así que un módulo nuevo hereda la protección por no poder
 * evitarla. El test de barrido de `__tests__/ai-minimization-sweep.test.ts`
 * comprueba además que nadie importe el SDK por su cuenta.
 *
 * Lo que NO hace: esto no convierte el tratamiento en anónimo. Un expediente
 * sigue siendo identificable por su contexto. Elimina los identificadores
 * directos, que es lo que exige el art. 5.1.c RGPD.
 */

import { minimizeContext, type NombresConocidos } from "./ai-privacy";
import { prisma } from "./prisma";

export interface MensajeModelo {
  role: "user" | "assistant";
  content: string;
}

export interface PeticionModelo {
  model: string;
  max_tokens: number;
  temperature?: number;
  system?: string;
  messages: MensajeModelo[];
  /**
   * Expediente del que procede el contexto. La puerta lee de la base de datos
   * los nombres reales que hay que sustituir (causante, contacto y empleados
   * asignados a sus tareas).
   *
   * Se prefiere esto a que cada módulo pase la lista: la lista se olvida, y el
   * módulo que la olvide envía nombres en claro sin que nada lo impida.
   */
  caseId?: string;
  /** Nombres explícitos, para los flujos que no parten de un expediente guardado. */
  nombres?: NombresConocidos;
}

export interface RespuestaModelo {
  texto: string;
  /** Texto exacto que se envió, ya minimizado. Para auditoría y para el hash. */
  enviado: string;
}

/**
 * Minimiza y envía. Devuelve el texto de la respuesta y el payload minimizado.
 */
export async function llamarModelo(peticion: PeticionModelo): Promise<RespuestaModelo> {
  const nombres = peticion.caseId
    ? mezclar(await nombresDelExpediente(peticion.caseId), peticion.nombres)
    : (peticion.nombres ?? {});

  const { system, messages } = minimizarPeticion({ ...peticion, nombres });

  const Anthropic = (await import("@anthropic-ai/sdk")).default;
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const msg = await client.messages.create({
    model: peticion.model,
    max_tokens: peticion.max_tokens,
    ...(peticion.temperature !== undefined ? { temperature: peticion.temperature } : {}),
    ...(system ? { system } : {}),
    messages,
  });

  const texto = msg.content
    .map((bloque) => (bloque.type === "text" ? bloque.text : ""))
    .join("")
    .trim();

  return { texto, enviado: payloadEnviado({ system, messages }) };
}

/**
 * Minimiza el `system` y todos los mensajes. Expuesto aparte para que las
 * pruebas puedan comprobar el payload sin llamar a la red.
 */
export function minimizarPeticion(peticion: PeticionModelo): {
  system?: string;
  messages: MensajeModelo[];
} {
  const nombres = peticion.nombres ?? {};
  return {
    system: peticion.system ? minimizeContext(peticion.system, nombres) : undefined,
    messages: peticion.messages.map((m) => ({
      role: m.role,
      content: minimizeContext(m.content, nombres),
    })),
  };
}

function mezclar(a: NombresConocidos, b?: NombresConocidos): NombresConocidos {
  if (!b) return a;
  return {
    deceased: b.deceased ?? a.deceased,
    contact: b.contact ?? a.contact,
    assignees: [...(a.assignees ?? []), ...(b.assignees ?? [])],
    people: [...(a.people ?? []), ...(b.people ?? [])],
  };
}

/**
 * Nombres reales asociados a un expediente: causante, contacto y **todos** los
 * empleados que aparecen como responsables de sus tareas o autores de sus
 * notas. Estos últimos eran el hueco que la auditoría señaló: el contexto
 * incluía "Asignada a: Marta Ruiz" y salía tal cual.
 */
export async function nombresDelExpediente(caseId: string): Promise<NombresConocidos> {
  const c = await prisma.case.findUnique({
    where: { id: caseId },
    select: {
      deceased: { select: { fullName: true } },
      contact: { select: { fullName: true } },
      tasks: {
        select: {
          assignee: { select: { name: true, email: true } },
          notes: { select: { user: { select: { name: true, email: true } } } },
        },
      },
    },
  });

  if (!c) return {};

  const empleados = new Set<string>();
  for (const t of c.tasks) {
    if (t.assignee?.name) empleados.add(t.assignee.name);
    if (t.assignee?.email) empleados.add(t.assignee.email);
    for (const n of t.notes) {
      if (n.user?.name) empleados.add(n.user.name);
      if (n.user?.email) empleados.add(n.user.email);
    }
  }

  return {
    deceased: c.deceased?.fullName ?? null,
    contact: c.contact?.fullName ?? null,
    assignees: Array.from(empleados),
  };
}

/** Concatenación de todo lo que sale, para hash y para el barrido de PII. */
export function payloadEnviado(p: { system?: string; messages: MensajeModelo[] }): string {
  return [p.system ?? "", ...p.messages.map((m) => m.content)].join("\n");
}
