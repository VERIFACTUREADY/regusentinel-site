/**
 * Agregador de riesgos ISD a nivel de organizacion.
 *
 * Recorre todos los expedientes activos, ejecuta el detector deterministico
 * y devuelve un resumen agrupado por severidad con los expedientes mas
 * criticos en primer lugar.
 *
 * Usa el detector puro (lib/isd-risk-detector.ts) sin IA, por lo que es
 * suficientemente rapido para correr en cada peticion del dashboard.
 */

import { prisma } from "./prisma";
import { detectISDRisks, type ISDRisk } from "./isd-risk-detector";

export interface CaseRiskSummary {
  caseId: string;
  caseRef: string;
  deceasedName: string | null;
  deathDate: Date | null;
  province: string | null;
  topRiskSeverity: "critical" | "warning" | "info";
  topRiskTitle: string;
  riskCount: number;
}

export interface OrgRiskOverview {
  totalCasesAnalyzed: number;
  countsBySeverity: { critical: number; warning: number; info: number };
  topCases: CaseRiskSummary[];
  totalActiveAlerts: number;
}

const SEVERITY_RANK = { critical: 0, warning: 1, info: 2 } as const;

export async function getOrgRiskOverview(orgId: string, limit = 6): Promise<OrgRiskOverview> {
  const cases = await prisma.case.findMany({
    where: {
      orgId,
      deletedAt: null,
      status: { notIn: ["CLOSED", "ARCHIVED"] },
    },
    select: {
      id: true,
      ref: true,
      province: true,
      hasUrbanProperty: true,
      propertyAcquisitionValue: true,
      propertyTransmissionValue: true,
      preexistingPatrimony: true,
      deceased: { select: { fullName: true, deathDate: true } },
    },
  });

  const summaries: CaseRiskSummary[] = [];
  const counts = { critical: 0, warning: 0, info: 0 };
  let totalAlerts = 0;

  for (const c of cases) {
    const risks = detectISDRisks({
      deathDate: c.deceased?.deathDate ?? null,
      province: c.province,
      hasUrbanProperty: c.hasUrbanProperty,
      propertyAcquisitionValue: c.propertyAcquisitionValue,
      propertyTransmissionValue: c.propertyTransmissionValue,
      preexistingPatrimony: c.preexistingPatrimony,
    });
    if (risks.length === 0) continue;

    for (const r of risks) counts[r.severity]++;
    totalAlerts += risks.length;

    const top = pickTopRisk(risks);
    summaries.push({
      caseId: c.id,
      caseRef: c.ref,
      deceasedName: c.deceased?.fullName ?? null,
      deathDate: c.deceased?.deathDate ?? null,
      province: c.province,
      topRiskSeverity: top.severity,
      topRiskTitle: top.title,
      riskCount: risks.length,
    });
  }

  summaries.sort((a, b) => {
    const sev = SEVERITY_RANK[a.topRiskSeverity] - SEVERITY_RANK[b.topRiskSeverity];
    if (sev !== 0) return sev;
    return b.riskCount - a.riskCount;
  });

  return {
    totalCasesAnalyzed: cases.length,
    countsBySeverity: counts,
    topCases: summaries.slice(0, limit),
    totalActiveAlerts: totalAlerts,
  };
}

function pickTopRisk(risks: ISDRisk[]): ISDRisk {
  return risks.reduce((acc, r) =>
    SEVERITY_RANK[r.severity] < SEVERITY_RANK[acc.severity] ? r : acc
  );
}
