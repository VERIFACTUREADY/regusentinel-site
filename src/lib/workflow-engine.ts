import { createHash } from "crypto";
import { prisma } from "./prisma";
import { sendEmail } from "./email";
import { logAudit } from "./audit";
import { z } from "zod";
import {
  CaseStatus as CaseStatusEnum,
  TaskStatus as TaskStatusEnum,
  TaskCategory as TaskCategoryEnum,
} from "@prisma/client";
import type {
  CaseStatus,
  TaskCategory,
  TaskStatus,
  WorkflowTrigger,
  WorkflowAction,
  WorkflowLogStatus,
  Prisma,
} from "@prisma/client";

export interface WorkflowEvent {
  type: WorkflowTrigger;
  orgId: string;
  caseId: string;
  userId?: string;
  fromStatus?: CaseStatus;
  toStatus?: CaseStatus;
  taskId?: string;
  taskStatus?: TaskStatus;
  taskCategory?: TaskCategory;
  /** Profundidad de encadenamiento; ver MAX_WORKFLOW_DEPTH. */
  depth?: number;
  /**
   * Identidad del hecho que ha ocurrido, para deduplicar.
   *
   * Si quien dispara el evento tiene un identificador natural (el id de la
   * transición, el del mensaje que lo provocó…) debe pasarlo aquí: dos
   * llamadas con el mismo `eventKey` son el mismo hecho y se entregan UNA vez.
   *
   * Si se omite, se usa la ventana temporal de `VENTANA_EVENTO_MS`: dos
   * disparos del mismo evento en la misma ventana se consideran duplicados;
   * una repetición legítima más tarde vuelve a entregarse.
   */
  eventKey?: string;
}

/**
 * `conditions` y `actionConfig` son columnas JSON: lo que hay dentro puede ser
 * cualquier cosa. Antes se casteaban con `as` y `newStatus` llegaba como
 * string arbitrario hasta `prisma.case.update`, que fallaba en tiempo de
 * ejecucion con un valor fuera del enum.
 */
const ruleConditionsSchema = z
  .object({
    toStatus: z.nativeEnum(CaseStatusEnum).optional(),
    fromStatus: z.nativeEnum(CaseStatusEnum).optional(),
    taskStatus: z.nativeEnum(TaskStatusEnum).optional(),
    taskCategory: z.nativeEnum(TaskCategoryEnum).optional(),
  })
  .strict();

const actionConfigSchema = z
  .object({
    subject: z.string().max(300).optional(),
    body: z.string().max(20000).optional(),
    comment: z.string().max(2000).optional(),
    newStatus: z.nativeEnum(CaseStatusEnum).optional(),
  })
  .strict();

export type RuleConditions = z.infer<typeof ruleConditionsSchema>;
export type ActionConfig = z.infer<typeof actionConfigSchema>;

export { ruleConditionsSchema, actionConfigSchema };

/**
 * Profundidad maxima de encadenamiento. Hoy `CHANGE_CASE_STATUS` escribe
 * directamente y NO vuelve a disparar workflows, asi que no hay cascada; el
 * contador esta para que, si alguna vez se anade, un par de reglas A->B / B->A
 * no pueda girar indefinidamente.
 */
const MAX_WORKFLOW_DEPTH = 3;

type CaseWithRelations = Prisma.CaseGetPayload<{
  include: { deceased: true; contact: true; org: true };
}>;

/**
 * Ventana de deduplicación cuando el evento no trae `eventKey` propio.
 *
 * Dos disparos del mismo evento dentro de la misma ventana son el mismo hecho.
 * Una repetición legítima más tarde (el expediente vuelve a cambiar de estado
 * mañana) cae en otra ventana y sí se entrega.
 */
const VENTANA_EVENTO_MS = 5 * 60 * 1000;

/** Tras esto, una reclamación en PROCESSING se considera abandonada. */
export const ENTREGA_WORKFLOW_COLGADA_MS = 10 * 60 * 1000;

/**
 * Identidad de un HECHO DE NEGOCIO, para `WorkflowEvent.eventKey`.
 *
 * EL DEFECTO QUE CORRIGE
 * ----------------------
 * `eventKey` existía en la interfaz del evento y **ningún emisor real lo
 * pasaba**. Los cuatro —`CASE_CREATED`, `CASE_STATUS_CHANGED`,
 * `TASK_STATUS_CHANGED` y `DOCUMENT_UPLOADED`— caían en la ventana temporal de
 * cinco minutos, que como identidad es a la vez demasiado y demasiado poco:
 *
 *   - **DOCUMENT_UPLOADED no llevaba NINGÚN dato del documento.** Su clave era
 *     `(org, regla, expediente, tipo, ventana)`. Subir tres documentos a un
 *     expediente en cinco minutos —lo normal cuando una familia manda la
 *     documentación de golpe— ejecutaba la automatización **una sola vez**. Los
 *     otros dos no disparaban nada y no dejaban ni rastro de por qué.
 *   - **TASK_STATUS_CHANGED no distinguía dos transiciones iguales.** Su clave
 *     era `(…, taskId, taskStatus, ventana)`: pasar una tarea a EN CURSO,
 *     devolverla a PENDIENTE y volver a ponerla EN CURSO dentro de la misma
 *     ventana se tragaba la tercera. La segunda vez el aviso no salía.
 *   - Lo mismo, con el mismo remedio, en `CASE_STATUS_CHANGED`.
 *
 * QUÉ SIRVE COMO IDENTIDAD Y QUÉ NO
 * ---------------------------------
 * La clave tiene que cumplir **las dos** condiciones a la vez:
 *
 *   1. **Estable** ante una reentrega del MISMO hecho. Un `randomUUID()` por
 *      llamada no vale: dos entregas del mismo evento darían claves distintas
 *      y el aviso saldría dos veces.
 *   2. **Distinta** para dos hechos legítimos distintos, por juntos que
 *      ocurran. La ventana de cinco minutos sola no vale: colapsa hechos que
 *      de verdad son dos.
 *
 * Por eso todas salen de datos **ya persistidos**: el id de la fila creada, o
 * su `updatedAt` después de la escritura. Se leen, no se generan.
 *
 * LÍMITE CONOCIDO
 * ---------------
 * Las claves de versión usan `updatedAt` con precisión de milisegundo. Dos
 * transiciones distintas de la misma tarea en el mismo milisegundo tendrían la
 * misma identidad. No es alcanzable desde la interfaz —hace falta una escritura
 * y una respuesta HTTP entre ambas— y, de darse, el error cae del lado
 * conservador: se ejecuta una vez, no dos.
 */
export const claveDeEvento = {
  /** Un expediente se crea una vez: su id ES el hecho. */
  expedienteCreado: (caseId: string) => `case-created:${caseId}`,

  /** La versión del expediente tras el cambio distingue una transición de otra. */
  estadoExpediente: (caseId: string, version: Date) =>
    `case-status:${caseId}:${version.toISOString()}`,

  /** Ídem para la tarea: `updatedAt` es el número de versión de esa fila. */
  estadoTarea: (taskId: string, version: Date) =>
    `task-status:${taskId}:${version.toISOString()}`,

  /**
   * Cambio en bloque: el hecho es «esta escritura sobre este expediente». La
   * versión más alta de las tareas tocadas lo identifica, y cambia en el
   * siguiente lote aunque sean las mismas tareas y el mismo estado.
   */
  estadoTareasEnLote: (caseId: string, version: Date) =>
    `task-batch:${caseId}:${version.toISOString()}`,

  /** Un documento se sube una vez: su id ES el hecho. */
  documentoSubido: (documentId: string) => `document:${documentId}`,
};

/**
 * Clave idempotente de una ejecución.
 *
 * Distingue organización, regla, expediente, evento y ventana. Es un SHA-256
 * de identificadores: NO contiene emails, nombres ni contenido del expediente,
 * porque la clave se indexa y se registra y no debe convertirse en otro sitio
 * donde vivan datos personales.
 */
export function claveEjecucion(
  event: WorkflowEvent,
  ruleId: string,
  ahora: Date = new Date(),
): string {
  const ventana =
    event.eventKey ?? `w:${Math.floor(ahora.getTime() / VENTANA_EVENTO_MS)}`;

  const partes = [
    event.orgId,
    ruleId,
    event.caseId,
    event.type,
    event.fromStatus ?? "",
    event.toStatus ?? "",
    event.taskId ?? "",
    event.taskStatus ?? "",
    ventana,
  ].join("|");

  return createHash("sha256").update(partes).digest("hex");
}

type ReclamoLog =
  | { estado: "reclamado"; logId: string }
  | { estado: "ya_ejecutado"; logId: string };

/**
 * Crea o recupera el `WorkflowLog` de esta ejecución **antes de llamar a
 * nadie**.
 *
 * La restricción única sobre `idempotencyKey` decide: la primera petición crea
 * la fila, la segunda choca con P2002 y recupera la existente. A partir de ahí
 * la exclusión real la hace la reclamación POR DESTINATARIO, que es la que
 * protege la llamada externa; este nivel evita además duplicar el registro.
 */
async function reclamarEjecucion(
  clave: string,
  rule: { id: string },
  event: WorkflowEvent,
  accion: WorkflowAction,
  nombreRegla: string,
): Promise<ReclamoLog> {
  const ahora = new Date();
  try {
    const creado = await prisma.workflowLog.create({
      data: {
        ruleId: rule.id,
        caseId: event.caseId,
        status: "PROCESSING",
        idempotencyKey: clave,
        startedAt: ahora,
        details: { action: accion, ruleName: nombreRegla },
      },
      select: { id: true },
    });
    return { estado: "reclamado", logId: creado.id };
  } catch (err) {
    if ((err as { code?: string })?.code !== "P2002") throw err;
  }

  const existente = await prisma.workflowLog.findUnique({
    where: { idempotencyKey: clave },
    select: { id: true },
  });
  // Carrera improbable: la fila existía al crear y ya no está. Se trata como
  // ejecutada para no reenviar a ciegas.
  if (!existente) return { estado: "ya_ejecutado", logId: "" };

  // La ejecución ya existe. NO se vuelve a planificar: las entregas
  // individuales de esa ejecución son las que deciden si falta alguien, y
  // reclamarlas es idempotente.
  return { estado: "ya_ejecutado", logId: existente.id };
}

export type ReclamoEntrega = "reclamada" | "ya_enviada" | "en_curso";

/**
 * Reclama la entrega a UN destinatario. **Sólo quien recibe `"reclamada"` puede
 * llamar al proveedor externo.**
 *
 * Dos mecanismos atómicos:
 *   1. `createMany` con `skipDuplicates` sobre la restricción única
 *      `(workflowLogId, recipient)`: sólo una transacción obtiene `count 1`.
 *   2. Si la fila ya existía, `updateMany` condicionado al estado observado:
 *      de nuevo, sólo una transacción ve `count === 1`.
 *
 * Antes el primer paso era un `create` dentro de un `try/catch` que esperaba
 * el P2002. Funcionaba, pero Prisma registra la consulta fallida a nivel
 * ERROR, así que cada reintento normal —el caso corriente, porque la fila ya
 * existe— dejaba en el log del servidor un «Invalid invocation ... Unique
 * constraint failed» que no correspondía a ningún fallo. Un log que grita en
 * la operación normal enseña a no leer el log.
 *
 * Reclamable: PENDING, FAILED y PROCESSING abandonada. Nunca SENT — un
 * destinatario que ya recibió el aviso no vuelve a recibirlo.
 */
export async function reclamarEntrega(
  workflowLogId: string,
  recipient: string,
  ahora: Date = new Date(),
): Promise<ReclamoEntrega> {
  const creada = await prisma.workflowDelivery.createMany({
    data: [
      {
        workflowLogId,
        recipient,
        status: "PROCESSING",
        attempts: 1,
        lastTriedAt: ahora,
      },
    ],
    skipDuplicates: true,
  });
  if (creada.count === 1) return "reclamada";

  const existente = await prisma.workflowDelivery.findUnique({
    where: { workflowLogId_recipient: { workflowLogId, recipient } },
    select: { status: true, lastTriedAt: true },
  });
  if (!existente) return "en_curso";

  if (existente.status === "SENT") return "ya_enviada";

  const colgada =
    existente.status === "PROCESSING" &&
    existente.lastTriedAt !== null &&
    ahora.getTime() - existente.lastTriedAt.getTime() > ENTREGA_WORKFLOW_COLGADA_MS;

  const reclamable = existente.status === "PENDING" || existente.status === "FAILED";
  if (!reclamable && !colgada) return "en_curso";

  const reclamo = await prisma.workflowDelivery.updateMany({
    where: { workflowLogId, recipient, status: existente.status },
    data: {
      status: "PROCESSING",
      lastTriedAt: ahora,
      attempts: { increment: 1 },
      error: null,
    },
  });

  return reclamo.count === 1 ? "reclamada" : "en_curso";
}

/** Confirma una entrega. Sólo debe llamarlo quien obtuvo la reclamación. */
async function marcarEnviada(workflowLogId: string, recipient: string, ahora = new Date()) {
  await prisma.workflowDelivery.updateMany({
    where: { workflowLogId, recipient },
    data: { status: "SENT", error: null, sentAt: ahora, lastTriedAt: ahora },
  });
}

/** Marca una entrega como fallida; queda reclamable para el siguiente intento. */
async function marcarFallida(
  workflowLogId: string,
  recipient: string,
  error: unknown,
  ahora = new Date(),
) {
  await prisma.workflowDelivery.updateMany({
    where: { workflowLogId, recipient },
    data: {
      status: "FAILED",
      error: (error instanceof Error ? error.message : String(error)).slice(0, 500),
      lastTriedAt: ahora,
    },
  });
}

/**
 * Ejecuta una entrega completa: reclamar -> enviar -> confirmar/fallar.
 *
 * Devuelve si esta llamada realizó el envío. El fallo de un destinatario no
 * interrumpe a los demás porque cada uno pasa por aquí de forma independiente.
 */
export async function entregarUnaVez(
  workflowLogId: string,
  recipient: string,
  enviar: () => Promise<unknown>,
): Promise<EntregaDestinatario> {
  const reclamo = await reclamarEntrega(workflowLogId, recipient);
  if (reclamo !== "reclamada") {
    return { recipient, ok: reclamo === "ya_enviada", omitida: true, motivo: reclamo };
  }

  try {
    await enviar();
  } catch (err) {
    await marcarFallida(workflowLogId, recipient, err);
    return {
      recipient,
      ok: false,
      error: (err instanceof Error ? err.message : String(err)).slice(0, 500),
    };
  }

  await marcarEnviada(workflowLogId, recipient);
  return { recipient, ok: true };
}

export async function triggerWorkflow(event: WorkflowEvent): Promise<void> {
  if ((event.depth ?? 0) >= MAX_WORKFLOW_DEPTH) {
    console.warn(`Workflow detenido por profundidad maxima en el caso ${event.caseId}`);
    return;
  }

  const rules = await prisma.workflowRule.findMany({
    where: { orgId: event.orgId, isActive: true, trigger: event.type },
  });
  if (rules.length === 0) return;

  // El expediente se carga filtrando por la organizacion DEL EVENTO. Antes era
  // `findUnique({ id: event.caseId })` sin mas: una regla podia actuar sobre
  // un expediente de otra organizacion si el caseId no correspondia.
  const caseData = await prisma.case.findFirst({
    where: { id: event.caseId, orgId: event.orgId, deletedAt: null },
    include: { deceased: true, contact: true, org: true },
  });
  if (!caseData) return;

  await Promise.allSettled(
    rules.map(async (rule) => {
      // Configuracion invalida: se registra el motivo en vez de fallar en
      // tiempo de ejecucion dentro del handler.
      const conditions = ruleConditionsSchema.safeParse(rule.conditions ?? {});
      const config = actionConfigSchema.safeParse(rule.actionConfig ?? {});

      if (!conditions.success || !config.success) {
        await prisma.workflowLog.create({
          data: {
            ruleId: rule.id,
            caseId: event.caseId,
            status: "SKIPPED",
            error: "Configuracion de la regla no valida",
            details: {
              reason: "invalid_config",
              conditions: conditions.success ? null : conditions.error.issues.map((i) => i.message),
              actionConfig: config.success ? null : config.error.issues.map((i) => i.message),
            },
          },
        }).catch(console.error);
        return;
      }

      if (!evaluateConditions(conditions.data, event)) {
        return;
      }

      // ── 1. PLANIFICAR SIN ENVIAR ───────────────────────────────────────
      //
      // La accion ya no envia nada: devuelve QUE habria que enviar y a quien.
      // Antes `executeAction` llamaba al proveedor y el registro se escribia
      // despues, asi que dos ejecuciones simultaneas enviaban dos veces y una
      // caida entre el envio y la escritura dejaba el correo enviado sin
      // rastro.
      let plan: PlanAccion;
      try {
        plan = await planificarAccion(rule.action, config.data, event, caseData);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await prisma.workflowLog
          .create({ data: { ruleId: rule.id, caseId: event.caseId, status: "FAILED", error } })
          .catch(console.error);
        return;
      }

      if (plan.skipped) {
        await prisma.workflowLog.create({
          data: {
            ruleId: rule.id,
            caseId: event.caseId,
            status: "SKIPPED",
            details: { action: rule.action, ruleName: rule.name, reason: plan.reason },
          },
        }).catch(console.error);
        return;
      }

      // ── 2. RECLAMAR LA EJECUCION ANTES DE TOCAR NADA EXTERNO ───────────
      const clave = claveEjecucion(event, rule.id);
      const reclamo = await reclamarEjecucion(clave, rule, event, rule.action, rule.name);

      // Otra ejecucion ya reclamo este evento. Se continua igualmente sobre SU
      // log: las reclamaciones por destinatario son idempotentes, asi que si
      // aquella termino no se reenvia nada, y si murio a medias, esta recoge
      // los destinatarios que quedaron pendientes.
      const logId = reclamo.logId;
      if (!logId) return;

      const primeraVez = reclamo.estado === "reclamado";

      try {
        // ── 3. EFECTOS SIN DESTINATARIO ──────────────────────────────────
        // Comentarios y cambios de estado no tienen entregas; su idempotencia
        // viene de la reclamacion del log: solo la primera ejecucion los aplica.
        if (plan.efecto) {
          const resultado = primeraVez ? await plan.efecto() : undefined;

          // Un efecto que no llego a aplicarse se registra como OMITIDO con su
          // motivo. Marcarlo SUCCESS diria que se hizo algo que no se hizo.
          if (resultado && resultado.aplicado === false) {
            await prisma.workflowLog.update({
              where: { id: logId },
              data: {
                status: "SKIPPED",
                details: { action: rule.action, ruleName: rule.name, reason: resultado.reason },
              },
            });
            return;
          }

          await prisma.workflowLog.update({
            where: { id: logId },
            data: { status: "SUCCESS", error: null },
          });
          if (primeraVez) {
            await prisma.workflowRule.update({
              where: { id: rule.id },
              data: { execCount: { increment: 1 }, lastRunAt: new Date() },
            });
          }
          return;
        }

        // ── 4. UNA RECLAMACION POR DESTINATARIO, LUEGO EL ENVIO ──────────
        const entregas = await Promise.all(
          (plan.entregas ?? []).map((e) => entregarUnaVez(logId, e.recipient, e.enviar)),
        );

        await recalcularEstadoLog(logId);

        if (primeraVez) {
          await prisma.workflowRule.update({
            where: { id: rule.id },
            data: { execCount: { increment: 1 }, lastRunAt: new Date() },
          });
        }

        void entregas;
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        await prisma.workflowLog
          .update({ where: { id: logId }, data: { status: "FAILED", error } })
          .catch(console.error);
      }
    })
  );
}

function evaluateConditions(conditions: RuleConditions, event: WorkflowEvent): boolean {
  if (conditions.toStatus && event.toStatus !== conditions.toStatus) return false;
  if (conditions.fromStatus && event.fromStatus !== conditions.fromStatus) return false;
  if (conditions.taskStatus && event.taskStatus !== conditions.taskStatus) return false;
  if (conditions.taskCategory && event.taskCategory !== conditions.taskCategory) return false;
  return true;
}

/** Resultado de la entrega a UN destinatario. */
export interface EntregaDestinatario {
  recipient: string;
  ok: boolean;
  error?: string;
  /** No se llamó al proveedor: otra ejecución la tenía reclamada o ya enviada. */
  omitida?: boolean;
  motivo?: ReclamoEntrega;
}

/** Una entrega planificada: a quién y cómo, pero todavía sin enviar. */
export interface EntregaPlanificada {
  recipient: string;
  enviar: () => Promise<unknown>;
}

/**
 * Lo que una acción va a hacer, SIN haberlo hecho.
 *
 * Separar planificar de ejecutar es lo que permite reservar antes de llamar al
 * proveedor. Mientras `executeAction` enviaba y devolvía el resultado, no había
 * ningún punto en el que reservar: cuando la función volvía, el correo ya
 * estaba enviado.
 */
export interface PlanAccion {
  skipped?: boolean;
  reason?: string;
  /** Acciones con destinatarios externos (correo). */
  entregas?: EntregaPlanificada[];
  /**
   * Acciones sin destinatario (comentario, cambio de estado).
   *
   * Devuelve si llegó a aplicarse. Un efecto que decide no escribir —porque el
   * expediente cambió de estado mientras tanto— tiene que poder decirlo: si no,
   * la ejecución se registraría como SUCCESS sin haber hecho nada.
   */
  efecto?: () => Promise<{ aplicado: boolean; reason?: string } | void>;
}

/**
 * Resultado de una accion.
 *
 * `entregas` lo rellenan las acciones con varios destinatarios. Antes no
 * existia: una accion devolvia exito o excepcion, asi que con diez
 * destinatarios y nueve fallos el resultado era "exito" y los nueve fallos
 * quedaban invisibles.
 */
interface ActionOutcome {
  skipped?: boolean;
  reason?: string;
  entregas?: EntregaDestinatario[];
}

/**
 * Envia a cada destinatario por separado y devuelve un resultado por cada uno.
 * El fallo de uno no interrumpe a los demas.
 */
export async function entregarACadaDestinatario(
  destinatarios: string[],
  enviar: (email: string) => Promise<unknown>,
): Promise<EntregaDestinatario[]> {
  const resultados = await Promise.allSettled(destinatarios.map((email) => enviar(email)));

  return destinatarios.map((recipient, i) => {
    const r = resultados[i];
    if (r.status === "fulfilled") return { recipient, ok: true };
    const error = r.reason instanceof Error ? r.reason.message : String(r.reason);
    return { recipient, ok: false, error: error.slice(0, 500) };
  });
}

/**
 * Decide QUÉ hay que hacer, sin hacerlo.
 *
 * Ninguna rama de esta función llama al proveedor de correo. Devuelve los
 * destinatarios y una función `enviar` por cada uno; quien decide si esa
 * función llega a ejecutarse es la reclamación de la entrega, en
 * `entregarUnaVez`.
 */
async function planificarAccion(
  action: WorkflowAction,
  config: ActionConfig,
  event: WorkflowEvent,
  caseData: CaseWithRelations
): Promise<PlanAccion> {
  switch (action) {
    case "SEND_EMAIL_CONTACT": {
      const destino = caseData.contact?.email;
      if (!destino) {
        return { skipped: true, reason: "el expediente no tiene email de contacto" };
      }
      const subject = interpolate(config.subject || "Actualización de su expediente", caseData);
      const body = interpolate(config.body || "", caseData);
      const html = buildHtml(subject, body);

      // Antes esta acción enviaba directamente y NO dejaba ninguna
      // `WorkflowDelivery`: un aviso duplicado a la familia era invisible y no
      // se podía reintentar. Ahora pasa por la misma reserva que el resto.
      return {
        entregas: [{ recipient: destino, enviar: () => sendEmail({ to: destino, subject, html }) }],
      };
    }

    case "SEND_EMAIL_TEAM": {
      const members = await prisma.membership.findMany({
        where: { orgId: event.orgId, role: { in: ["OWNER", "MANAGER"] } },
        include: { user: { select: { email: true } } },
      });
      if (members.length === 0) {
        return { skipped: true, reason: "la organizacion no tiene destinatarios internos" };
      }

      const subject = interpolate(config.subject || "Actualización de expediente", caseData);
      const body = interpolate(config.body || "", caseData);
      const html = buildHtml(subject, body);

      return {
        entregas: members.map((m) => ({
          recipient: m.user.email,
          enviar: () => sendEmail({ to: m.user.email, subject, html }),
        })),
      };
    }

    case "ADD_CASE_COMMENT": {
      const comment = interpolate(config.comment || "Automatización ejecutada", caseData);
      return {
        efecto: async () => {
          await logAudit({
            orgId: event.orgId,
            caseId: event.caseId,
            action: "case.comment",
            details: `[Automatización] ${comment}`,
          });
          return { aplicado: true };
        },
      };
    }

    case "CHANGE_CASE_STATUS": {
      // `newStatus` ya viene validado contra el enum por actionConfigSchema.
      if (!config.newStatus) {
        return { skipped: true, reason: "la regla no define newStatus" };
      }
      const newStatus = config.newStatus;

      // No-op: si el expediente ya esta en ese estado no se escribe nada. Es
      // la primera barrera contra un par de reglas A->B / B->A girando entre si.
      if (caseData.status === newStatus) {
        return { skipped: true, reason: `el expediente ya esta en ${newStatus}` };
      }

      const estadoLeido = caseData.status;
      return {
        efecto: async () => {
          // Escritura condicional al estado leido: si otra ejecucion lo cambio
          // entretanto, no lo pisamos.
          const changed = await prisma.case.updateMany({
            where: { id: event.caseId, orgId: event.orgId, status: estadoLeido },
            data: { status: newStatus, ...(newStatus === "CLOSED" && { closedAt: new Date() }) },
          });
          if (changed.count === 0) {
            return {
              aplicado: false,
              reason: "el estado del expediente cambio mientras se ejecutaba",
            };
          }

          await logAudit({
            orgId: event.orgId,
            caseId: event.caseId,
            action: "case.status_changed",
            details: `[Auto] -> ${newStatus}`,
          });
          return { aplicado: true };
        },
      };
    }
  }

  return { skipped: true, reason: "accion desconocida" };
}

function interpolate(template: string, caseData: CaseWithRelations): string {
  return template
    .replace(/\{\{deceased\.fullName\}\}/g, caseData.deceased?.fullName ?? "")
    .replace(/\{\{contact\.fullName\}\}/g, caseData.contact?.fullName ?? "")
    .replace(/\{\{case\.ref\}\}/g, caseData.ref)
    .replace(/\{\{case\.status\}\}/g, caseData.status)
    .replace(/\{\{org\.name\}\}/g, caseData.org?.name ?? "");
}

function buildHtml(subject: string, body: string): string {
  return `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
      <h2 style="color:#1a1a2e;">${subject}</h2>
      <div style="color:#333;line-height:1.6;">${body.replace(/\n/g, "<br>")}</div>
      <hr style="border:none;border-top:1px solid #eee;margin-top:32px;" />
      <p style="color:#999;font-size:12px;">Heredia — Aviso automático generado por una regla de automatización.</p>
    </div>
  `;
}

/**
 * Reintenta las entregas pendientes de una ejecución concreta.
 *
 * QUÉ SE REINTENTA
 * ----------------
 * Sólo las que están en FAILED y las que quedaron colgadas en PROCESSING. Las
 * SENT no se tocan: un destinatario que ya recibió el aviso no vuelve a
 * recibirlo por mucho que alguien pulse el botón.
 *
 * DE DÓNDE SALE EL CONTENIDO
 * --------------------------
 * Se reconstruye desde la REGLA y el EXPEDIENTE, leídos de la base de datos.
 * Nada de asunto, cuerpo ni destinatario viene del cliente: si viniera, este
 * endpoint sería un relé de correo autenticado — cualquiera con permiso de
 * automatizaciones podría mandar lo que quisiera a quien quisiera desde el
 * dominio de la organización.
 *
 * CONCURRENCIA
 * ------------
 * Cada destinatario se reclama antes de enviar, igual que en la ejecución
 * normal. Dos reintentos simultáneos producen UNA sola llamada al proveedor.
 */
export async function reintentarEntregasFallidas(
  workflowLogId: string,
  opciones: { enviar?: (recipient: string) => Promise<unknown> } = {},
): Promise<{
  reintentadas: number;
  recuperadas: number;
  estado: WorkflowLogStatus;
  entregas: EntregaDestinatario[];
  /**
   * Hay entregas pendientes pero NO se pueden reintentar porque ya no es
   * posible reconstruir el envío: la regla dejó de ser de correo, o el
   * expediente se borró.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Antes este caso devolvía `reintentadas: 0` igual que el caso «ya no
   * quedaba nada pendiente», y la pantalla decía «No quedaban entregas
   * pendientes de reintentar». Era falso: seguían pendientes, y quien lo leía
   * daba el aviso por resuelto.
   */
  irrecuperable: number;
}> {
  const ahora = new Date();

  // Entregas recuperables: fallidas y reclamaciones abandonadas.
  const recuperables = await prisma.workflowDelivery.findMany({
    where: {
      workflowLogId,
      OR: [
        { status: "FAILED" },
        {
          status: "PROCESSING",
          lastTriedAt: { lt: new Date(ahora.getTime() - ENTREGA_WORKFLOW_COLGADA_MS) },
        },
      ],
    },
    select: { recipient: true },
  });

  if (recuperables.length === 0) {
    return {
      reintentadas: 0,
      recuperadas: 0,
      estado: await recalcularEstadoLog(workflowLogId),
      entregas: [],
      irrecuperable: 0,
    };
  }

  // El contenido se reconstruye desde la regla y el expediente.
  const enviar = opciones.enviar ?? (await construirEmisorDesdeLog(workflowLogId));
  if (!enviar) {
    return {
      reintentadas: 0,
      recuperadas: 0,
      estado: await recalcularEstadoLog(workflowLogId),
      entregas: [],
      // Se distingue de «no quedaba nada»: quedan `recuperables.length`
      // entregas sin destinatario alcanzado y ya no hay forma de reenviarlas.
      irrecuperable: recuperables.length,
    };
  }

  const entregas = await Promise.all(
    recuperables.map((d) =>
      entregarUnaVez(workflowLogId, d.recipient, () => enviar(d.recipient)),
    ),
  );

  const estado = await recalcularEstadoLog(workflowLogId);
  return {
    reintentadas: recuperables.length,
    recuperadas: entregas.filter((e) => e.ok && !e.omitida).length,
    estado,
    entregas,
    irrecuperable: 0,
  };
}

/**
 * Reconstruye la función de envío a partir de la regla y el expediente del log.
 * Devuelve `null` si la regla o el expediente ya no existen, o si la acción no
 * es de correo.
 */
async function construirEmisorDesdeLog(
  workflowLogId: string,
): Promise<((recipient: string) => Promise<unknown>) | null> {
  const log = await prisma.workflowLog.findUnique({
    where: { id: workflowLogId },
    select: {
      caseId: true,
      rule: { select: { action: true, actionConfig: true, orgId: true } },
    },
  });
  if (!log?.rule || !log.caseId) return null;
  if (log.rule.action !== "SEND_EMAIL_TEAM" && log.rule.action !== "SEND_EMAIL_CONTACT") return null;

  const config = actionConfigSchema.safeParse(log.rule.actionConfig ?? {});
  if (!config.success) return null;

  const caseData = await prisma.case.findFirst({
    where: { id: log.caseId, orgId: log.rule.orgId, deletedAt: null },
    include: { deceased: true, contact: true, org: true },
  });
  if (!caseData) return null;

  const porDefecto =
    log.rule.action === "SEND_EMAIL_CONTACT"
      ? "Actualización de su expediente"
      : "Actualización de expediente";
  const subject = interpolate(config.data.subject || porDefecto, caseData);
  const html = buildHtml(subject, interpolate(config.data.body || "", caseData));

  return (recipient: string) => sendEmail({ to: recipient, subject, html });
}

/** Recalcula SUCCESS / PARTIAL / FAILED a partir de las entregas actuales. */
export async function recalcularEstadoLog(workflowLogId: string): Promise<WorkflowLogStatus> {
  const entregas = await prisma.workflowDelivery.findMany({
    where: { workflowLogId },
    select: { status: true },
  });

  if (entregas.length === 0) return "SUCCESS";

  // PROCESSING cuenta como pendiente: mientras haya una entrega sin resolver,
  // la ejecucion no es un exito.
  const pendientes = entregas.filter((e) => e.status !== "SENT").length;
  const enviadas = entregas.length - pendientes;
  const estado: WorkflowLogStatus =
    pendientes === 0 ? "SUCCESS" : enviadas === 0 ? "FAILED" : "PARTIAL";
  const fallidas = pendientes;

  await prisma.workflowLog.update({
    where: { id: workflowLogId },
    data: {
      status: estado,
      error: fallidas > 0 ? `${fallidas} de ${entregas.length} destinatario(s) sin entregar` : null,
    },
  });

  return estado;
}
