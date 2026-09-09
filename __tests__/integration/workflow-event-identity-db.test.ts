/**
 * IDENTIDAD DE LOS EVENTOS, CONTRA POSTGRESQL REAL.
 *
 * QUE PRUEBA ESTE FICHERO Y POR QUE NO BASTABA CON LO QUE HABIA
 * ------------------------------------------------------------
 * `workflow-claim-db.test.ts` ya demuestra que dos disparos del MISMO evento
 * producen una sola llamada por destinatario. Eso cubre una mitad del problema
 * —no duplicar— y deja la otra sin mirar: **no colapsar dos hechos que de
 * verdad son dos**.
 *
 * La deduplicación tiene dos formas de estar mal, y la segunda es peor porque
 * es silenciosa:
 *
 *   - **demasiado floja**: el mismo hecho se entrega dos veces y el aviso sale
 *     dos veces. Se ve, molesta y se corrige;
 *   - **demasiado agresiva**: dos hechos distintos comparten identidad y el
 *     segundo no se ejecuta. No hay error, no hay registro, no hay nada. La
 *     automatización simplemente no ocurrió, y nadie se entera.
 *
 * Y ahí es donde estaba el defecto real: **ningún emisor pasaba `eventKey`**,
 * así que la identidad de todos ellos era la ventana de cinco minutos.
 *
 *   - `DOCUMENT_UPLOADED` no llevaba ningún dato del documento: subir tres
 *     documentos al mismo expediente en cinco minutos ejecutaba la regla UNA
 *     vez;
 *   - `TASK_STATUS_CHANGED` no distinguía dos transiciones iguales: mover una
 *     tarea a EN CURSO, devolverla y volver a moverla se tragaba la segunda.
 *
 * Estas pruebas fijan las DOS direcciones a la vez. Y no cuentan solo filas:
 * cuentan también las llamadas al proveedor de correo, porque una prueba que
 * mirase únicamente `WorkflowDelivery` daría por bueno un diseño que enviara
 * dos veces y escribiera una.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

/** Proveedor de correo controlado: cuenta CADA llamada. */
const { llamadas } = vi.hoisted(() => ({ llamadas: [] as string[] }));

vi.mock("../../src/lib/email", () => ({
  sendEmail: vi.fn(async ({ to }: { to: string }) => {
    llamadas.push(to);
  }),
}));

import { prisma, resetDatabase, createOrg, createCase } from "./helpers/db";
import { triggerWorkflow, claveDeEvento, claveEjecucion } from "../../src/lib/workflow-engine";
import { logAudit } from "../../src/lib/audit";

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  llamadas.length = 0;
  vi.clearAllMocks();
});

let seq = 0;

/** Organización con dos destinatarios internos y una regla del tipo pedido. */
async function escenario(opciones: {
  trigger: "CASE_STATUS_CHANGED" | "TASK_STATUS_CHANGED" | "DOCUMENT_UPLOADED" | "CASE_CREATED";
  action?: "SEND_EMAIL_TEAM" | "ADD_CASE_COMMENT";
}) {
  seq++;
  const { org, owner } = await createOrg();
  const segundo = await prisma.user.create({
    data: { email: `equipo-${seq}-${Date.now()}@gestoria.test`, name: "Manager" },
  });
  await prisma.membership.create({
    data: { userId: segundo.id, orgId: org.id, role: "MANAGER" },
  });

  const expediente = await createCase(org.id, `EXP-2026-${String(6000 + seq)}`);
  const accion = opciones.action ?? "SEND_EMAIL_TEAM";

  const regla = await prisma.workflowRule.create({
    data: {
      orgId: org.id,
      name: "Regla de identidad",
      trigger: opciones.trigger,
      conditions: {},
      action: accion,
      actionConfig:
        accion === "SEND_EMAIL_TEAM"
          ? { subject: "Aviso", body: "El expediente {{case.ref}}" }
          : { comment: "Comentario automatico" },
      isActive: true,
    },
  });

  return { org, expediente, regla, correos: [owner.email, segundo.email].sort() };
}

async function ejecuciones(ruleId: string) {
  return prisma.workflowLog.findMany({
    where: { ruleId },
    select: { id: true, status: true, idempotencyKey: true },
    orderBy: { createdAt: "asc" },
  });
}

async function comentarios(caseId: string) {
  return prisma.auditLog.count({ where: { caseId, action: "case.comment" } });
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. LAS CLAVES QUE PRODUCEN LOS EMISORES REALES
// ═══════════════════════════════════════════════════════════════════════════

describe("5. La identidad que fabrican los emisores reales", () => {
  it("dos documentos distintos del mismo expediente son DOS hechos", () => {
    /*
     * Este era el peor caso: el evento no llevaba nada del documento, así que
     * la identidad de los tres documentos de una misma tanda era idéntica.
     */
    const a = claveDeEvento.documentoSubido("doc_1");
    const b = claveDeEvento.documentoSubido("doc_2");
    expect(a).not.toBe(b);
    // Y el mismo documento, reentregado, es el MISMO hecho.
    expect(claveDeEvento.documentoSubido("doc_1")).toBe(a);
  });

  it("dos transiciones distintas son DOS hechos, aunque sean de la misma fila", () => {
    /*
     * Cada transición escribe su propia fila en la auditoría, así que dos
     * transiciones de la misma tarea nunca comparten identidad —ni siquiera si
     * ocurren en el mismo milisegundo, que era el límite conocido de la
     * identidad anterior basada en `updatedAt`—.
     */
    expect(claveDeEvento.transicionAuditada("audit_1")).not.toBe(
      claveDeEvento.transicionAuditada("audit_2"),
    );
  });

  it("la clave es ESTABLE: se lee de lo persistido, no se genera", () => {
    /*
     * La condición que un `randomUUID()` por llamada NO cumple. Si la
     * identidad se generase en cada emisión, dos entregas del mismo hecho
     * tendrían claves distintas y el aviso saldría dos veces.
     */
    const primeraEmision = claveDeEvento.transicionAuditada("audit_1");
    const reentrega = claveDeEvento.transicionAuditada("audit_1");
    expect(reentrega).toBe(primeraEmision);
  });

  it("con eventKey la ventana de cinco minutos deja de intervenir", () => {
    /*
     * La ventana era el sustituto de una identidad que no existía. Con una
     * identidad de verdad, el reloj no participa: la misma clave da el mismo
     * hash aunque pasen horas.
     */
    const evento = {
      type: "DOCUMENT_UPLOADED" as const,
      orgId: "org1",
      caseId: "c1",
      eventKey: claveDeEvento.documentoSubido("doc_1"),
    };
    const ahora = new Date("2026-08-22T10:00:00.000Z");
    const seisHorasDespues = new Date("2026-08-22T16:00:00.000Z");
    expect(claveEjecucion(evento, "regla1", ahora)).toBe(
      claveEjecucion(evento, "regla1", seisHorasDespues),
    );

    // Y sin `eventKey` SÍ interviene: es el comportamiento antiguo, que se
    // conserva como red para cualquier emisor que no traiga identidad propia.
    const sinIdentidad = { type: "DOCUMENT_UPLOADED" as const, orgId: "org1", caseId: "c1" };
    expect(claveEjecucion(sinIdentidad, "regla1", ahora)).not.toBe(
      claveEjecucion(sinIdentidad, "regla1", seisHorasDespues),
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 6. EL MISMO HECHO, ENTREGADO DOS VECES
// ═══════════════════════════════════════════════════════════════════════════

describe("6. El mismo hecho entregado dos veces se ejecuta UNA", () => {
  it("efecto sin destinatario: un solo comentario, un solo registro", async () => {
    const { org, expediente, regla } = await escenario({
      trigger: "DOCUMENT_UPLOADED",
      action: "ADD_CASE_COMMENT",
    });
    const evento = {
      type: "DOCUMENT_UPLOADED" as const,
      orgId: org.id,
      caseId: expediente.id,
      eventKey: claveDeEvento.documentoSubido("doc_unico"),
    };

    // CONCURRENTES, no en fila: es donde de verdad se rompe.
    await Promise.all([triggerWorkflow(evento), triggerWorkflow(evento)]);

    expect(await ejecuciones(regla.id), "una sola identidad de ejecucion").toHaveLength(1);
    expect(await comentarios(expediente.id), "un solo comentario").toBe(1);

    const despues = await prisma.workflowRule.findUniqueOrThrow({
      where: { id: regla.id },
      select: { execCount: true },
    });
    expect(despues.execCount, "un solo incremento").toBe(1);
  });

  it("efecto con destinatarios: un correo por destinatario, no dos", async () => {
    const { org, expediente, regla, correos } = await escenario({
      trigger: "DOCUMENT_UPLOADED",
    });
    const evento = {
      type: "DOCUMENT_UPLOADED" as const,
      orgId: org.id,
      caseId: expediente.id,
      eventKey: claveDeEvento.documentoSubido("doc_unico"),
    };

    await Promise.all([triggerWorkflow(evento), triggerWorkflow(evento)]);

    // La evidencia dura: llamadas AL PROVEEDOR, no filas.
    expect([...llamadas].sort(), "una llamada por destinatario").toEqual(correos);

    const logs = await ejecuciones(regla.id);
    expect(logs).toHaveLength(1);
    expect(logs[0].status).toBe("SUCCESS");

    const entregas = await prisma.workflowDelivery.findMany({
      where: { workflowLogId: logs[0].id },
      select: { recipient: true, status: true, attempts: true },
    });
    expect(entregas, "una fila logica por destinatario").toHaveLength(correos.length);
    expect(entregas.every((e) => e.status === "SENT")).toBe(true);

    const despues = await prisma.workflowRule.findUniqueOrThrow({
      where: { id: regla.id },
      select: { execCount: true },
    });
    expect(despues.execCount).toBe(1);
  });

  it("deduplicar NO deja un error de restriccion unica en el log", async () => {
    /*
     * La reclamacion del log era un `create` dentro de un `try` que esperaba
     * el P2002, y Prisma registra la consulta fallida a nivel ERROR. Como el
     * choque aqui es el CAMINO NORMAL —ocurre cada vez que un evento llega
     * dos veces—, el servidor escupia un «Invalid invocation … Unique
     * constraint failed» en cada deduplicacion correcta.
     *
     * Un log que grita cuando todo va bien enseña a no leer el log, y ahi es
     * donde se pierden los errores de verdad. Se comprueba capturando lo que
     * sale por stderr durante la operacion.
     */
    const { org, expediente } = await escenario({ trigger: "DOCUMENT_UPLOADED" });
    const evento = {
      type: "DOCUMENT_UPLOADED" as const,
      orgId: org.id,
      caseId: expediente.id,
      eventKey: claveDeEvento.documentoSubido("doc_sin_ruido"),
    };

    const capturado: string[] = [];
    const escribirOriginal = process.stderr.write.bind(process.stderr);
    process.stderr.write = ((trozo: string | Uint8Array, ...resto: unknown[]) => {
      capturado.push(typeof trozo === "string" ? trozo : Buffer.from(trozo).toString());
      return (escribirOriginal as unknown as (...a: unknown[]) => boolean)(trozo, ...resto);
    }) as typeof process.stderr.write;

    try {
      await Promise.all([triggerWorkflow(evento), triggerWorkflow(evento)]);
    } finally {
      process.stderr.write = escribirOriginal;
    }

    const ruido = capturado.join("");
    expect(ruido, "deduplicar es operacion normal: no puede parecer un fallo").not.toContain(
      "Unique constraint failed",
    );
  });

  it("diez entregas concurrentes del mismo hecho siguen siendo una ejecucion", async () => {
    const { org, expediente, regla, correos } = await escenario({
      trigger: "DOCUMENT_UPLOADED",
    });
    const evento = {
      type: "DOCUMENT_UPLOADED" as const,
      orgId: org.id,
      caseId: expediente.id,
      eventKey: claveDeEvento.documentoSubido("doc_unico"),
    };

    await Promise.all(Array.from({ length: 10 }, () => triggerWorkflow(evento)));

    expect([...llamadas].sort()).toEqual(correos);
    expect(await ejecuciones(regla.id)).toHaveLength(1);
    expect(
      (
        await prisma.workflowRule.findUniqueOrThrow({
          where: { id: regla.id },
          select: { execCount: true },
        })
      ).execCount,
    ).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 7. DOS HECHOS LEGITIMOS SEGUIDOS SE EJECUTAN LOS DOS
// ═══════════════════════════════════════════════════════════════════════════

describe("7. La deduplicacion no se traga hechos legitimos", () => {
  it("DOS documentos en la misma ventana de cinco minutos: DOS ejecuciones", async () => {
    /*
     * ESTA ES LA PRUEBA QUE FALLA CON EL DISEÑO ANTERIOR.
     *
     * Sin `eventKey`, los dos eventos caían en la misma ventana y compartían
     * identidad: una ejecución, un correo por destinatario, y el segundo
     * documento sin avisar a nadie. Con la identidad del documento son dos
     * hechos, y se ejecutan los dos.
     */
    const { org, expediente, regla, correos } = await escenario({
      trigger: "DOCUMENT_UPLOADED",
    });
    const base = { type: "DOCUMENT_UPLOADED" as const, orgId: org.id, caseId: expediente.id };

    await triggerWorkflow({ ...base, eventKey: claveDeEvento.documentoSubido("doc_a") });
    await triggerWorkflow({ ...base, eventKey: claveDeEvento.documentoSubido("doc_b") });

    const logs = await ejecuciones(regla.id);
    expect(logs, "dos documentos son dos hechos").toHaveLength(2);
    expect(new Set(logs.map((l) => l.idempotencyKey)).size).toBe(2);

    // Cada destinatario recibe DOS avisos: uno por documento.
    expect(llamadas.filter((c) => c === correos[0])).toHaveLength(2);
    expect(llamadas.filter((c) => c === correos[1])).toHaveLength(2);
    expect(llamadas).toHaveLength(correos.length * 2);

    expect(
      (
        await prisma.workflowRule.findUniqueOrThrow({
          where: { id: regla.id },
          select: { execCount: true },
        })
      ).execCount,
    ).toBe(2);
  });

  it("ida y vuelta y vuelta a ir: la tercera transicion tambien se ejecuta", async () => {
    /*
     * PENDIENTE → EN CURSO, de vuelta a PENDIENTE, y otra vez EN CURSO, todo
     * en segundos. La primera y la tercera son transiciones idénticas salvo
     * por CUÁNDO ocurren.
     *
     * Con la clave antigua —`(tarea, estado, ventana)`— la tercera era
     * indistinguible de la primera y no se ejecutaba: el gestor movía la
     * tarea, veía el cambio en pantalla y el aviso no salía.
     */
    const { org, expediente, regla } = await escenario({
      trigger: "TASK_STATUS_CHANGED",
      action: "ADD_CASE_COMMENT",
    });
    const tarea = await prisma.task.create({
      data: {
        caseId: expediente.id,
        title: "Tarea que va y viene",
        status: "PENDING",
        category: "OTROS",
      },
    });

    /** Escribe la transicion y emite el evento como lo hace la ruta real. */
    async function transicion(estado: "PENDING" | "IN_PROGRESS") {
      await prisma.task.update({ where: { id: tarea.id }, data: { status: estado } });
      // Igual que la ruta real: la fila de auditoria de la transicion es su
      // identidad. Cada transicion escribe la suya, asi que tres transiciones
      // son tres identidades aunque dos de ellas sean al mismo estado.
      const registro = await logAudit({
        orgId: org.id,
        caseId: expediente.id,
        action: `task.${estado.toLowerCase()}`,
        details: `Tarea "${tarea.title}" marcada como ${estado}`,
      });
      await triggerWorkflow({
        type: "TASK_STATUS_CHANGED",
        orgId: org.id,
        caseId: expediente.id,
        taskId: tarea.id,
        taskStatus: estado,
        taskCategory: "OTROS",
        eventKey: claveDeEvento.transicionAuditada(registro.id),
      });
    }

    await transicion("IN_PROGRESS");
    await transicion("PENDING");
    await transicion("IN_PROGRESS");

    const logs = await ejecuciones(regla.id);
    expect(logs, "tres transiciones legitimas, tres ejecuciones").toHaveLength(3);
    expect(new Set(logs.map((l) => l.idempotencyKey)).size, "tres identidades").toBe(3);
    expect(await comentarios(expediente.id)).toBe(3);
  });

  it("dos altas de expediente seguidas son dos hechos", async () => {
    const { org, regla } = await escenario({
      trigger: "CASE_CREATED",
      action: "ADD_CASE_COMMENT",
    });
    const uno = await createCase(org.id, "EXP-2026-6901");
    const dos = await createCase(org.id, "EXP-2026-6902");

    for (const c of [uno, dos]) {
      await triggerWorkflow({
        type: "CASE_CREATED",
        orgId: org.id,
        caseId: c.id,
        eventKey: claveDeEvento.expedienteCreado(c.id),
      });
    }

    expect(await ejecuciones(regla.id)).toHaveLength(2);
    expect(await comentarios(uno.id)).toBe(1);
    expect(await comentarios(dos.id)).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// 8. UN HECHO REPETIDO NO REENVIA A QUIEN YA LO RECIBIO
// ═══════════════════════════════════════════════════════════════════════════

describe("8. Reentrega tardia del mismo hecho", () => {
  it("una hora despues, el mismo evento sigue sin reenviar nada", async () => {
    /*
     * Con la ventana temporal esto NO se cumplía: pasados cinco minutos la
     * misma reentrega caía en otra ventana, se consideraba un hecho nuevo y
     * todos los destinatarios recibían el aviso por segunda vez.
     */
    const { org, expediente, regla, correos } = await escenario({
      trigger: "DOCUMENT_UPLOADED",
    });
    const evento = {
      type: "DOCUMENT_UPLOADED" as const,
      orgId: org.id,
      caseId: expediente.id,
      eventKey: claveDeEvento.documentoSubido("doc_reentregado"),
    };

    await triggerWorkflow(evento);
    expect([...llamadas].sort()).toEqual(correos);

    // La reentrega, mucho despues. La identidad no depende del reloj.
    llamadas.length = 0;
    await triggerWorkflow(evento);

    expect(llamadas, "nadie recibe un segundo aviso del mismo hecho").toHaveLength(0);
    expect(await ejecuciones(regla.id)).toHaveLength(1);
    expect(
      (
        await prisma.workflowRule.findUniqueOrThrow({
          where: { id: regla.id },
          select: { execCount: true },
        })
      ).execCount,
    ).toBe(1);
  });
});
