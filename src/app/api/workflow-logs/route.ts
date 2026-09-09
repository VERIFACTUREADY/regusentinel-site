import { NextRequest, NextResponse } from "next/server";
import { Prisma, WorkflowLogStatus } from "@prisma/client";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { leerPaginacion } from "@/lib/paginacion";

const ESTADOS_VALIDOS = new Set<string>(Object.values(WorkflowLogStatus));

export async function GET(req: NextRequest) {
  const auth = await requireOrgPermission("workflow.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const url = new URL(req.url);
  const { pagina, limite } = leerPaginacion(url.searchParams, {
    limitePorDefecto: 30,
    limiteMaximo: 50,
  });
  const status = url.searchParams.get("status");
  const ruleId = url.searchParams.get("ruleId");

  /*
   * El estado se valida contra el enum ANTES de tocar la base de datos. Sin
   * esta comprobación, `?status=cualquiercosa` llegaba a Prisma, que lanzaba
   * al no reconocer el valor del enum: un parámetro mal escrito devolvía un
   * 500 en vez de decir qué estaba mal.
   */
  if (status && !ESTADOS_VALIDOS.has(status)) {
    return NextResponse.json(
      { error: `Estado desconocido: ${status}` },
      { status: 400 },
    );
  }

  /*
   * TENENCIA: el filtro por regla se comprueba contra la organización de la
   * sesión. El `where` ya está acotado por `rule.orgId`, así que una regla
   * ajena nunca devolvería filas; pero devolvería una lista vacía con el
   * mensaje «no hay registros con los filtros seleccionados», que hace pensar
   * que la regla existe y no se ha ejecutado nunca. Es más honesto decir que
   * esa regla no está.
   */
  if (ruleId) {
    const regla = await prisma.workflowRule.findFirst({
      where: { id: ruleId, orgId: session.user.orgId },
      select: { id: true },
    });
    if (!regla) {
      return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });
    }
  }

  // Tipado real en vez de `as any`: si el filtro deja de encajar con el
  // esquema, falla al compilar y no en producción.
  const where: Prisma.WorkflowLogWhereInput = {
    rule: { orgId: session.user.orgId },
    ...(status ? { status: status as WorkflowLogStatus } : {}),
    ...(ruleId ? { ruleId } : {}),
  };

  /*
   * Los contadores por estado van SIEMPRE sin los filtros de la vista y
   * acompañan a cada respuesta.
   *
   * EL DEFECTO QUE CORRIGE
   * ----------------------
   * Los venía calculando el servidor de la página una única vez, al render
   * inicial, y el cliente los guardaba en una prop inmutable. Después de
   * reintentar una ejecución fallida la fila pasaba a «Exitoso» delante de tus
   * ojos mientras la tarjeta «Con error: 7» seguía marcando 7. Los dos
   * números salían de la misma pantalla y se contradecían.
   */
  const [logs, total, stats] = await Promise.all([
    prisma.workflowLog.findMany({
      where,
      include: {
        rule: { select: { id: true, name: true } },
        case: { select: { id: true, ref: true } },
        /*
         * Entregas que siguen sin llegar. El cliente ya declaraba el campo
         * `pendingDeliveries` pero nadie lo enviaba nunca, así que el botón
         * «Reintentar fallidas» aparecía en toda ejecución PARTIAL o FAILED,
         * incluidas las que ya no tenían nada pendiente porque un reintento
         * anterior las había recuperado.
         */
        _count: {
          select: {
            deliveries: { where: { status: { in: ["PENDING", "FAILED", "PROCESSING"] } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (pagina - 1) * limite,
      take: limite,
    }),
    prisma.workflowLog.count({ where }),
    prisma.workflowLog.groupBy({
      by: ["status"],
      where: { rule: { orgId: session.user.orgId } },
      _count: true,
    }),
  ]);

  const statMap: Record<string, number> = {};
  for (const s of stats) statMap[s.status] = s._count;

  return NextResponse.json({
    logs: logs.map(({ _count, ...log }) => ({
      ...log,
      pendingDeliveries: _count.deliveries,
    })),
    total,
    stats: statMap,
    page: pagina,
    limit: limite,
  });
}
