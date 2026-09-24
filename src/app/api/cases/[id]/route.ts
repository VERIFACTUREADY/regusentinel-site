import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import type { AuditLog, CaseStatus } from "@prisma/client";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getCaseDeadlines } from "@/lib/deadline-engine";
import { getPresignedUrl } from "@/lib/s3";
import { triggerWorkflow, claveDeEvento } from "@/lib/workflow-engine";

/** Lo que devuelve el `case.update` del PATCH, con sus relaciones incluidas. */
type CaseConRelaciones = Prisma.CaseGetPayload<{
  include: { deceased: true; contact: true };
}>;

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    include: {
      deceased: true,
      contact: true,
      tasks: {
        orderBy: { sortOrder: "asc" },
        include: {
          documents: { select: { id: true, fileName: true } },
          assignee: { select: { id: true, name: true, email: true } },
          _count: { select: { notes: true } },
          dependsOn: { select: { id: true, title: true, status: true } },
        },
      },
      documents: { include: { task: { select: { id: true, title: true, category: true } } } },
      approvals: true,
      auditLogs: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: { user: { select: { name: true, email: true } } },
      },
    },
  });

  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  // El desbloqueo de tareas vencidas ya NO ocurre aquí. Este GET escribía en
  // la base de datos (`task.updateMany`), lo que significaba que una simple
  // lectura mutaba estado, sin auditoría y sin disparar los workflows de
  // cambio de estado. Ahora lo hace el cron `unblock-tasks`, que sí audita.
  //
  // Para que la interfaz no muestre como bloqueada una tarea cuyo plazo ya ha
  // pasado, se calcula la condición al vuelo y se expone como campo derivado,
  // sin persistir nada.
  const now = new Date();
  const tasks = c.tasks.map((t) => ({
    ...t,
    unblockDue:
      t.status === "BLOCKED" && t.blockedUntil ? new Date(t.blockedUntil) <= now : false,
  }));

  /*
   * Enlace de descarga de cada documento.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Esta respuesta no traía `downloadUrl`, y la pestaña Documentos de la ficha
   * pinta el enlace como `{doc.downloadUrl && <a …>Descargar</a>}`. Resultado:
   * el enlace NUNCA se renderizaba y desde el expediente no había forma de
   * descargar un documento — sólo desde la biblioteca `/documents`. La lista se
   * veía completa, así que el fallo pasaba por «no hay botón» en vez de por lo
   * que era: una descarga rota.
   */
  const documents = await Promise.all(
    c.documents.map(async (doc) => ({
      ...doc,
      downloadUrl: await getPresignedUrl(doc.fileKey, {
        fileName: doc.fileName,
        mimeType: doc.mimeType,
      }),
    })),
  );

  // Add case-level deadlines
  const deathDate = c.deceased?.deathDate;
  const caseDeadlines = deathDate ? getCaseDeadlines(new Date(deathDate)) : null;
  return NextResponse.json({ ...c, tasks, documents, caseDeadlines });
}

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("cases.update");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const body = await req.json();
  const {
    status, notes, isUrgent, legitimationNote, consentAccepted, deceased,
    contact, province, categories, hasDeceasedInsurance, portalEnabled,
    hasUrbanProperty, propertyAcquisitionValue, propertyTransmissionValue,
    preexistingPatrimony, recentResidenceChange, previousResidenceProvince,
    appliedReductions, referenciaCatastral,
  } = body;

  const numericOrNull = (v: unknown): number | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };

  /*
   * EL ESTADO SE ESCRIBE CON UN COMPARA-Y-INTERCAMBIA, Y SÓLO AHÍ.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Esto era un leer-comprobar-escribir sin atomicidad, igual que en las
   * tareas: `c` se leía arriba, `case.update` escribía `status` sin condición
   * ninguna, y más abajo se decidía si auditar comparando contra `c.status`,
   * que a esas alturas ya podía ser falso. Dos PATCH simultáneos con destinos
   * distintos respondían los dos 200 y **los dos afirmaban haber transicionado
   * desde OPEN cuando sólo uno lo hizo**; el estado final era el del último en
   * escribir, que no tiene por qué ser el que dejó la última auditoría.
   *
   * Ahora el `updateMany` condicionado al estado observado es la ÚNICA
   * escritura del estado. Quien pierde la reclamación no escribe nada:
   *
   *   - si pedía el mismo estado que ya hay, su intención está cumplida y se
   *     sigue con el resto de campos, pero sin auditar ni emitir por segunda
   *     vez una transición que sólo ocurrió una;
   *   - si pedía otro estado, se responde 409 con el estado real y no se
   *     escribe ningún campo, porque todos vienen de la misma lectura caduca.
   *
   * LA TRANSICIÓN Y SU AUDITORÍA SE CONFIRMAN JUNTAS
   * -----------------------------------------------
   * La reclamación, el resto de escrituras de este PATCH y las filas de
   * `AuditLog` que las acompañan van en UNA transacción. Antes eran
   * operaciones confirmadas por separado, y entre la primera y la última cabía
   * un fallo: el expediente quedaba con el estado nuevo y sin ninguna fila que
   * dijera quién lo cambió ni desde dónde. Como la identidad del evento ES esa
   * fila, tampoco habría evento ni automatización.
   *
   * Dentro de la transacción no se llama a nadie de fuera: el motor va después
   * del commit.
   */
  type Resultado =
    | { tipo: "aplicado"; expediente: CaseConRelaciones; transicion: AuditLog | null }
    | { tipo: "no_encontrado" }
    | { tipo: "conflicto"; actual: CaseStatus };

  const resultado = await prisma.$transaction(async (tx): Promise<Resultado> => {
    let ganaLaTransicion = false;

    if (status) {
      const reclamo = await tx.case.updateMany({
        where: { id: params.id, orgId: session.user.orgId, deletedAt: null, status: c.status },
        data: { status, ...(status === "CLOSED" && { closedAt: new Date() }) },
      });

      if (reclamo.count === 0) {
        const actual = await tx.case.findFirst({
          where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
          select: { status: true },
        });
        if (!actual) return { tipo: "no_encontrado" };
        if (actual.status !== status) return { tipo: "conflicto", actual: actual.status };
      } else {
        ganaLaTransicion = status !== c.status;
      }
    }

    const expediente = await tx.case.update({
      where: { id: params.id },
      data: {
      // `status` y `closedAt` NO se escriben aquí: los escribe —y sólo él— el
      // compara-y-intercambia de arriba.
      ...(notes !== undefined && { notes }),
      ...(isUrgent !== undefined && { isUrgent }),
      ...(legitimationNote !== undefined && { legitimationNote }),
      ...(consentAccepted !== undefined && {
        consentAccepted,
        consentDate: consentAccepted ? new Date() : null,
      }),
      ...(province !== undefined && { province: province?.trim() || null }),
      ...(Array.isArray(categories) && { categories }),
      ...(hasDeceasedInsurance !== undefined && { hasDeceasedInsurance }),
      ...(portalEnabled !== undefined && { portalEnabled }),
      ...(hasUrbanProperty !== undefined && { hasUrbanProperty: Boolean(hasUrbanProperty) }),
      ...(propertyAcquisitionValue !== undefined && {
        propertyAcquisitionValue: numericOrNull(propertyAcquisitionValue),
      }),
      ...(propertyTransmissionValue !== undefined && {
        propertyTransmissionValue: numericOrNull(propertyTransmissionValue),
      }),
      ...(preexistingPatrimony !== undefined && {
        preexistingPatrimony: numericOrNull(preexistingPatrimony),
      }),
      ...(recentResidenceChange !== undefined && {
        recentResidenceChange: Boolean(recentResidenceChange),
      }),
      ...(previousResidenceProvince !== undefined && {
        previousResidenceProvince:
          typeof previousResidenceProvince === "string" && previousResidenceProvince.trim()
            ? previousResidenceProvince.trim()
            : null,
      }),
      ...(appliedReductions !== undefined && {
        // Validamos en el detector con parseAppliedReductions; aquí
        // sólo aseguramos que sea array o vacío para no romper la columna JSON.
        // `Prisma.DbNull` es el NULL de la columna, que es lo que
        // `parseAppliedReductions` espera cuando no hay reducciones.
        appliedReductions: Array.isArray(appliedReductions)
          ? appliedReductions
          : Prisma.DbNull,
      }),
        ...(referenciaCatastral !== undefined && {
          // Sólo guardamos lo que parezca una RC plausible (20 caracteres
          // alfanuméricos), normalizada a mayúsculas y sin separadores.
          referenciaCatastral: (() => {
            if (typeof referenciaCatastral !== "string") return null;
            const cleaned = referenciaCatastral.toUpperCase().replace(/[\s\-]/g, "").trim();
            return /^[0-9A-Z]{20}$/.test(cleaned) ? cleaned : null;
          })(),
        }),
      },
      include: { deceased: true, contact: true },
    });

    // Update deceased info if provided
    if (deceased && typeof deceased === "object") {
      const deceasedData: Record<string, unknown> = {};
      if (deceased.fullName?.trim()) deceasedData.fullName = deceased.fullName.trim();
      if (deceased.deathDate !== undefined) deceasedData.deathDate = deceased.deathDate ? new Date(deceased.deathDate) : null;
      if (deceased.dni !== undefined) deceasedData.dni = deceased.dni?.trim() || null;
      if (Object.keys(deceasedData).length > 0) {
        await tx.deceased.update({ where: { caseId: params.id }, data: deceasedData });
        await logAudit(
          {
            orgId: session.user.orgId,
            userId: session.user.id,
            caseId: params.id,
            action: "case.deceased_updated",
            details: `Datos del fallecido actualizados`,
          },
          tx,
        );
      }
    }

    // Update contact info if provided
    if (contact && typeof contact === "object") {
      const contactData: Record<string, unknown> = {};
      if (contact.fullName?.trim()) contactData.fullName = contact.fullName.trim();
      if (contact.phone !== undefined) contactData.phone = contact.phone?.trim() || null;
      if (contact.email !== undefined) contactData.email = contact.email?.trim() || null;
      if (contact.relationship !== undefined) contactData.relationship = contact.relationship?.trim() || null;
      if (Object.keys(contactData).length > 0) {
        await tx.caseContact.update({ where: { caseId: params.id }, data: contactData });
        await logAudit(
          {
            orgId: session.user.orgId,
            userId: session.user.id,
            caseId: params.id,
            action: "case.contact_updated",
            details: `Datos del solicitante actualizados`,
          },
          tx,
        );
      }
    }

    if (portalEnabled !== undefined && portalEnabled !== c.portalEnabled) {
      await logAudit(
        {
          orgId: session.user.orgId,
          userId: session.user.id,
          caseId: params.id,
          action: portalEnabled ? "case.portal_enabled" : "case.portal_disabled",
          details: `Acceso al portal ${portalEnabled ? "habilitado" : "deshabilitado"}`,
        },
        tx,
      );
    }

    const transicion =
      status && ganaLaTransicion
        ? await logAudit(
            {
              orgId: session.user.orgId,
              userId: session.user.id,
              caseId: params.id,
              action: "case.status_changed",
              details: `${c.status} -> ${status}`,
            },
            tx,
          )
        : null;

    return { tipo: "aplicado", expediente, transicion };
  });

  if (resultado.tipo === "no_encontrado") {
    return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });
  }
  if (resultado.tipo === "conflicto") {
    return NextResponse.json(
      {
        error: `El expediente ya no está en ${c.status}: otra persona lo ha pasado a ${resultado.actual}. No se ha cambiado nada; revisa el estado actual antes de volver a intentarlo.`,
        currentStatus: resultado.actual,
      },
      { status: 409 },
    );
  }

  const updated = resultado.expediente;

  /*
   * A PARTIR DE AQUÍ, TODO ESTÁ YA CONFIRMADO EN LA BASE. El motor no puede
   * deshacer la transición, y no se le llama con la transacción abierta.
   */
  if (status && resultado.transicion) {
    // Fire-and-forget workflow triggers
    triggerWorkflow({
      type: "CASE_STATUS_CHANGED",
      orgId: session.user.orgId,
      caseId: params.id,
      userId: session.user.id,
      fromStatus: c.status,
      toStatus: status,
      /*
       * La identidad del evento es la fila de auditoría de ESTA transición:
       * existe porque la transición se ganó y se registró, y no existe si no.
       */
      eventKey: claveDeEvento.transicionAuditada(resultado.transicion.id),
    }).catch(console.error);
  }

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("cases.delete");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  await prisma.case.update({ where: { id: params.id }, data: { deletedAt: new Date() } });

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: params.id,
    action: "case.deleted",
    details: `Expediente ${c.ref} eliminado (borrado logico)`,
  });

  return NextResponse.json({ success: true });
}
