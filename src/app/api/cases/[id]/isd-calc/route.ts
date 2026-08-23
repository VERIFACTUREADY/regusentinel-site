import { NextRequest, NextResponse } from "next/server";
import { requireOrgPermission } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { calculateISD, type ISDInputs } from "@/lib/isd-calculator";
import { logAudit } from "@/lib/audit";

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireOrgPermission("cases.read");
  if (!auth.ok) return auth.response;
  const session = auth.session;

  const c = await prisma.case.findFirst({
    where: { id: params.id, orgId: session.user.orgId, deletedAt: null },
    select: { id: true },
  });
  if (!c) return NextResponse.json({ error: "Expediente no encontrado" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const inputs: ISDInputs = {
    group: body.group,
    ageIfMinor: body.ageIfMinor ?? null,
    baseImponible: Number(body.baseImponible) || 0,
    preexistingPatrimony: Number(body.preexistingPatrimony) || 0,
    dwellingReduction: Boolean(body.dwellingReduction),
    dwellingValue: Number(body.dwellingValue) || 0,
    disability: body.disability || "none",
    lifeInsuranceAmount: Number(body.lifeInsuranceAmount) || 0,
    ccaaBonificationPct: Number(body.ccaaBonificationPct) || 0,
  };

  if (!["I", "II", "III", "IV"].includes(inputs.group)) {
    return NextResponse.json({ error: "Grupo de parentesco inválido" }, { status: 400 });
  }
  if (inputs.baseImponible <= 0) {
    return NextResponse.json({ error: "Base imponible debe ser positiva" }, { status: 400 });
  }

  const result = calculateISD(inputs);

  await logAudit({
    orgId: session.user.orgId,
    userId: session.user.id,
    caseId: params.id,
    action: "case.isd_calculated",
    details: `Cuota a pagar estimada: ${result.cuotaAPagar.toFixed(2)}€ (Grupo ${inputs.group}, base ${inputs.baseImponible.toFixed(2)}€)`,
  }).catch(() => {});

  return NextResponse.json({ result, inputs });
}
