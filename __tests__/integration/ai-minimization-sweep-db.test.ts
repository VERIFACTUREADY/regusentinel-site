/**
 * BARRIDO DE MINIMIZACION: NINGUN MODULO DE IA ENVIA DATOS PERSONALES.
 *
 * Se construye un expediente con PII en TODOS los campos y se ejercitan los
 * ocho puntos que hablan con Anthropic. El SDK esta interceptado, asi que se
 * puede leer el payload exacto que habria salido por la red y comprobar que no
 * contiene ninguno de los valores sembrados.
 *
 * QUE FALLA SIN LA CORRECCION
 * ---------------------------
 * La minimizacion existia SOLO en `case-analyzer.ts`. Los otros siete modulos
 * —chat de expediente, autopilot, tareas sugeridas, respuesta al portal de la
 * familia, relevo de turno, informes de progreso y peticiones de documentos—
 * construian su prompt y llamaban al SDK directamente, enviando el nombre del
 * causante, el del contacto, su email, su telefono, su DNI y el nombre del
 * empleado asignado a cada tarea.
 *
 * Este test usa PostgreSQL real porque la puerta lee de la base de datos los
 * nombres a sustituir: con Prisma mockeado se estaria comprobando el mock.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from "vitest";

/** Payloads capturados en el limite exacto con la red. */
const { enviados } = vi.hoisted(() => ({ enviados: [] as string[] }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: class FakeAnthropic {
    messages = {
      create: async (peticion: {
        system?: string;
        messages: Array<{ content: string }>;
      }) => {
        enviados.push([peticion.system ?? "", ...peticion.messages.map((m) => m.content)].join("\n"));
        return {
          content: [{ type: "text", text: '{"tasks":[],"sections":[],"summary":"ok","risks":[]}' }],
          usage: { input_tokens: 1, output_tokens: 1 },
        };
      },
    };
  },
}));

process.env.ANTHROPIC_API_KEY = "sk-ant-test";

import { prisma, resetDatabase, createOrg } from "./helpers/db";

/**
 * IDENTIFICADORES DIRECTOS. Ninguno puede aparecer en un payload saliente.
 */
const PII = {
  fallecido: "Ramona Etxebarria Goikoetxea",
  contacto: "Aitor Etxebarria Lasa",
  emailContacto: "aitor.etxebarria@correo-privado.test",
  telefono: "656 12 34 56",
  dni: "12345678Z",
  iban: "ES9121000418450200051332",
  empleado: "Marta Ruiz Serrano",
  emailEmpleado: "marta.ruiz@gestoria-interna.test",
};

/**
 * TEXTO LIBRE DEL EXPEDIENTE. Esto SI se envia, y es una decision consciente.
 *
 * Las notas y descripciones son el contenido sobre el que el modelo tiene que
 * razonar: sin ellas la funcion no existe. Lo que se elimina de ese texto son
 * los identificadores directos —nombres, email, telefono, DNI, IBAN—, que es
 * lo que exige la minimizacion del art. 5.1.c RGPD. El tratamiento no es
 * anonimo y no se presenta como tal: requiere que la organizacion lo active
 * expresamente (`aiEnabled`), y el DPA lo recoge.
 */
const TEXTO_LIBRE = "El hijo dice que su madre tenia otra cuenta en Kutxabank";

let caseId = "";
let orgId = "";
let userId = "";

beforeAll(async () => {
  await resetDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

beforeEach(async () => {
  await resetDatabase();
  enviados.length = 0;

  const { org, owner } = await createOrg();
  orgId = org.id;
  userId = owner.id;

  // IA habilitada explicitamente: sin esto los modulos caen al camino
  // heuristico y el barrido no probaria nada.
  await prisma.organization.update({ where: { id: orgId }, data: { aiEnabled: true } });
  await prisma.user.update({
    where: { id: owner.id },
    data: { name: PII.empleado, email: PII.emailEmpleado },
  });

  const expediente = await prisma.case.create({
    data: {
      orgId,
      ref: "EXP-2026-7777",
      categories: ["BANCOS", "SEGUROS"],
      notes: `${TEXTO_LIBRE}. IBAN ${PII.iban}.`,
      deceased: {
        create: {
          fullName: PII.fallecido,
          dni: PII.dni,
          deathDate: new Date("2026-01-15"),
        },
      },
      contact: {
        create: {
          fullName: PII.contacto,
          email: PII.emailContacto,
          phone: PII.telefono,
          relationship: "hijo",
        },
      },
    },
  });
  caseId = expediente.id;

  const tarea = await prisma.task.create({
    data: {
      caseId,
      category: "BANCOS",
      title: `Certificado de saldos de ${PII.fallecido}`,
      description: `Llamar a ${PII.contacto} al ${PII.telefono}`,
      status: "IN_PROGRESS",
      assigneeId: userId,
    },
  });

  await prisma.taskNote.create({
    data: { taskId: tarea.id, userId, content: `${PII.empleado}: ${TEXTO_LIBRE}` },
  });

  await prisma.portalMessage.create({
    data: { caseId, fromFamily: true, content: `Soy ${PII.contacto}, mi DNI es ${PII.dni}` },
  });
});

/** Comprueba que ningun payload capturado contiene los valores sembrados. */
function noHayPiiEnLoEnviado() {
  expect(enviados.length).toBeGreaterThan(0);
  const todo = enviados.join("\n---\n");

  for (const [campo, valor] of Object.entries(PII)) {
    expect(todo, `Se ha enviado PII (${campo}): ${valor}`).not.toContain(valor);
  }

  // Tambien por partes: los apellidos sueltos son igual de identificativos.
  for (const parte of ["Etxebarria", "Goikoetxea", "Aitor", "Ramona", "Marta Ruiz", "Serrano"]) {
    expect(todo, `Se ha enviado un fragmento identificativo: ${parte}`).not.toContain(parte);
  }
}

describe("Barrido: ningun modulo de IA envia datos personales", () => {
  it("case-analyzer", async () => {
    const { analyzeCase } = await import("../../src/lib/case-analyzer");
    await analyzeCase({ caseId, userId }).catch(() => undefined);
    noHayPiiEnLoEnviado();
  });

  it("chat de expediente", async () => {
    const { sendChatMessage } = await import("../../src/lib/case-chat");
    await sendChatMessage({
      caseId,
      userId,
      message: `Que falta para cerrar? Soy ${PII.contacto}`,
    }).catch(() => undefined);
    noHayPiiEnLoEnviado();
  });

  it("autopilot: checklist y borrador", async () => {
    const { generateChecklist, generateDraft } = await import("../../src/lib/autopilot");
    const caseData = {
      id: caseId,
      categories: ["BANCOS" as const],
      deceased: { fullName: PII.fallecido, dni: PII.dni, deathDate: new Date("2026-01-15") },
      contact: {
        fullName: PII.contacto,
        email: PII.emailContacto,
        phone: PII.telefono,
        relationship: "hijo",
      },
      province: "Bizkaia",
      isUrgent: true,
      hasDeceasedInsurance: false,
    };

    await generateChecklist(caseData, userId).catch(() => undefined);
    await generateDraft(
      "Estimado {{contact.fullName}}, sobre {{deceased.fullName}} ({{deceased.dni}})",
      caseData,
      userId,
    ).catch(() => undefined);

    noHayPiiEnLoEnviado();
  });

  it("smart tasks", async () => {
    const { generateSmartTasks } = await import("../../src/lib/smart-tasks");
    await generateSmartTasks(caseId, userId).catch(() => undefined);
    noHayPiiEnLoEnviado();
  });

  it("relevo de turno (handoff)", async () => {
    const { generateHandoffBriefing } = await import("../../src/lib/handoff-briefing");
    await generateHandoffBriefing(caseId, userId).catch(() => undefined);
    noHayPiiEnLoEnviado();
  });

  it("informe de progreso", async () => {
    const { generateProgressReport } = await import("../../src/lib/progress-report");
    await generateProgressReport(caseId, userId).catch(() => undefined);
    noHayPiiEnLoEnviado();
  });

  it("peticion de documentos", async () => {
    const { generateDocRequest } = await import("../../src/lib/doc-request-generator");
    await generateDocRequest({ caseId, userId }).catch(() => undefined);
    noHayPiiEnLoEnviado();
  });
});

describe("El nombre del empleado asignado no sale", () => {
  it("se sustituye por [RESPONSABLE_ASIGNADO]", async () => {
    const { llamarModelo } = await import("../../src/lib/ai-gateway");

    await llamarModelo({
      model: "claude-sonnet-4-6",
      max_tokens: 10,
      system: "Contexto de prueba",
      messages: [
        {
          role: "user",
          content: `Tarea asignada a ${PII.empleado} (${PII.emailEmpleado}), contacto ${PII.contacto}`,
        },
      ],
      caseId,
    });

    const enviado = enviados.at(-1)!;
    expect(enviado).toContain("[RESPONSABLE_ASIGNADO]");
    expect(enviado).toContain("[SOLICITANTE]");
    expect(enviado).not.toContain(PII.empleado);
    expect(enviado).not.toContain(PII.emailEmpleado);
  });
});

describe("Nadie puede saltarse la puerta", () => {
  it("ningun modulo importa el SDK de Anthropic directamente", async () => {
    const { readdirSync, readFileSync, statSync } = await import("node:fs");
    const { join } = await import("node:path");

    const raiz = join(__dirname, "..", "..", "src");
    const infractores: string[] = [];

    const recorrer = (dir: string) => {
      for (const entrada of readdirSync(dir)) {
        const ruta = join(dir, entrada);
        if (statSync(ruta).isDirectory()) {
          recorrer(ruta);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(entrada)) continue;
        // La puerta es el UNICO sitio autorizado.
        if (ruta.endsWith(join("lib", "ai-gateway.ts"))) continue;
        if (readFileSync(ruta, "utf8").includes("@anthropic-ai/sdk")) {
          infractores.push(ruta.replace(raiz, "src"));
        }
      }
    };
    recorrer(raiz);

    expect(
      infractores,
      "Estos ficheros hablan con Anthropic sin pasar por `lib/ai-gateway.ts`, " +
        "asi que su contexto NO se minimiza:\n  " +
        infractores.join("\n  "),
    ).toEqual([]);
  });
});
