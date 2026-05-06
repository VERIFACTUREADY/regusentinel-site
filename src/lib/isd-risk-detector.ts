/**
 * Detector deterministico de riesgos ISD para un expediente.
 *
 * A diferencia del case-analyzer (que usa IA o heuristicas genericas),
 * este modulo aplica reglas concretas sobre plazos legales del Modelo 650
 * y sobre el dataset de bonificaciones por CCAA construido en isd-calculator.
 *
 * Se llama con datos minimos (deathDate, province, valor estimado opcional)
 * y devuelve una lista de riesgos accionables.
 */

import {
  PROVINCIA_TO_CCAA,
  getCCAABonification,
  CCAA_LABELS,
  type CCAAKey,
  type ParentescoGroup,
} from "./isd-calculator";

export type RiskSeverity = "info" | "warning" | "critical";

export interface ISDRisk {
  id: string;
  severity: RiskSeverity;
  title: string;
  description: string;
  action?: string;
}

export interface RiskInput {
  deathDate: Date | null;
  province: string | null;
  /** Valor estimado de la herencia (optional, mejora la deteccion). */
  estimatedInheritanceValue?: number | null;
  /** Grupo de parentesco si se conoce. */
  group?: ParentescoGroup | null;
}

const MS_PER_DAY = 86_400_000;

export function detectISDRisks(input: RiskInput): ISDRisk[] {
  const risks: ISDRisk[] = [];

  if (!input.deathDate) {
    return risks;
  }

  const death = new Date(input.deathDate);
  const now = Date.now();
  const daysSinceDeath = Math.floor((now - death.getTime()) / MS_PER_DAY);
  const isdDeadline = new Date(death);
  isdDeadline.setMonth(isdDeadline.getMonth() + 6);
  const extensionDeadline = new Date(death);
  extensionDeadline.setMonth(extensionDeadline.getMonth() + 5);
  const daysUntilISD = Math.ceil((isdDeadline.getTime() - now) / MS_PER_DAY);
  const daysUntilExtension = Math.ceil((extensionDeadline.getTime() - now) / MS_PER_DAY);

  // ─── Riesgos de plazo ──────────────────────────────────
  if (daysUntilISD < 0) {
    risks.push({
      id: "isd_overdue",
      severity: "critical",
      title: `Plazo ISD vencido hace ${Math.abs(daysUntilISD)} dias`,
      description:
        "El Modelo 650 deberia haberse presentado. La presentacion fuera de plazo conlleva recargos del 5% al 20% mas intereses de demora.",
      action: "Presentar inmediatamente y evaluar pago del recargo correspondiente.",
    });
  } else if (daysUntilISD <= 7) {
    risks.push({
      id: "isd_critical",
      severity: "critical",
      title: `Quedan ${daysUntilISD} dias para presentar el Modelo 650`,
      description: "Plazo critico. Si la documentacion no esta lista, ya no hay margen para solicitar prorroga.",
      action: "Presentar autoliquidacion o pagar a cuenta segun la documentacion disponible.",
    });
  } else if (daysUntilISD <= 30) {
    risks.push({
      id: "isd_30d",
      severity: "warning",
      title: `Quedan ${daysUntilISD} dias para presentar el Modelo 650`,
      description: "El plazo se acerca. Revisa que toda la documentacion fiscal este completa.",
      action: "Validar tasaciones, certificados de saldos y escritura de aceptacion.",
    });
  }

  // Prorroga: solo es solicitable hasta el dia 150 (mes 5).
  if (daysUntilExtension > 0 && daysUntilExtension <= 30 && daysUntilISD > 30) {
    risks.push({
      id: "extension_window_closing",
      severity: "warning",
      title: `Quedan ${daysUntilExtension} dias para solicitar prorroga del ISD`,
      description:
        "La prorroga (6 meses adicionales) solo puede solicitarse dentro de los 5 primeros meses tras el fallecimiento. Despues no hay opcion.",
      action: "Si la documentacion no estara lista en el plazo ordinario, solicitar prorroga ya.",
    });
  }

  // ─── Riesgos de CCAA y bonificacion ────────────────────
  const ccaa = mapProvinceToCCAA(input.province);
  if (!ccaa) {
    if (input.province) {
      risks.push({
        id: "unknown_province",
        severity: "info",
        title: "Provincia sin CCAA reconocida",
        description: `No hemos podido mapear "${input.province}" a una Comunidad Autonoma. La cuota ISD depende de la CCAA de residencia fiscal del causante.`,
        action: "Verificar la provincia para aplicar la bonificacion correcta.",
      });
    } else {
      risks.push({
        id: "missing_province",
        severity: "warning",
        title: "Provincia no especificada",
        description: "Sin provincia no se puede determinar la bonificacion autonomica del ISD. Cada CCAA tiene reglas muy distintas.",
        action: "Anyadir la provincia del causante en el expediente.",
      });
    }
  } else {
    const group = input.group ?? "II";
    const baseLiquidable = input.estimatedInheritanceValue ?? 0;
    const bonification = getCCAABonification(ccaa, group, baseLiquidable);

    if (bonification.foralRegime) {
      risks.push({
        id: "foral_regime",
        severity: "info",
        title: `${CCAA_LABELS[ccaa]}: regimen foral`,
        description: bonification.note,
        action: "Verificar tributacion con la Hacienda Foral correspondiente; no aplica la tarifa estatal por defecto.",
      });
    } else if (bonification.pct === 0 && (group === "I" || group === "II")) {
      risks.push({
        id: "no_general_bonification",
        severity: "warning",
        title: `${CCAA_LABELS[ccaa]} sin bonificacion general`,
        description: `${bonification.note} Para grupo ${group} la cuota tributaria se paga integra salvo reducciones especificas.`,
        action: "Revisar reducciones autonomicas no estandar (vivienda, empresa familiar, discapacidad).",
      });
    }

    // Riesgo de cruzar tramo de bonificacion (Cataluna, Castilla-La Mancha, Cantabria, Galicia G-II)
    if (input.estimatedInheritanceValue && input.estimatedInheritanceValue > 0) {
      const thresholdRisk = detectThresholdRisk(ccaa, group, input.estimatedInheritanceValue);
      if (thresholdRisk) risks.push(thresholdRisk);
    }
  }

  return risks;
}

function mapProvinceToCCAA(province: string | null | undefined): CCAAKey | null {
  if (!province) return null;
  const slug = province
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "-");
  return PROVINCIA_TO_CCAA[slug] ?? null;
}

interface Threshold {
  upTo: number;
  pct: number;
  label: string;
}

const THRESHOLDS: Partial<Record<CCAAKey, Threshold[]>> = {
  CATALUNA: [
    { upTo: 100000, pct: 99, label: "100.000€" },
    { upTo: 200000, pct: 97, label: "200.000€" },
    { upTo: 500000, pct: 90, label: "500.000€" },
    { upTo: 1000000, pct: 70, label: "1.000.000€" },
  ],
  CASTILLA_LA_MANCHA: [
    { upTo: 175000, pct: 100, label: "175.000€" },
    { upTo: 225000, pct: 95, label: "225.000€" },
    { upTo: 275000, pct: 90, label: "275.000€" },
    { upTo: 300000, pct: 85, label: "300.000€" },
  ],
  CANTABRIA: [
    { upTo: 100000, pct: 100, label: "100.000€" },
  ],
  GALICIA: [
    { upTo: 1000000, pct: 99, label: "1.000.000€" },
  ],
  ARAGON: [
    { upTo: 100000, pct: 65, label: "100.000€" },
  ],
  CANARIAS: [
    { upTo: 55000, pct: 99.9, label: "55.000€" },
  ],
};

function detectThresholdRisk(ccaa: CCAAKey, group: ParentescoGroup, value: number): ISDRisk | null {
  const list = THRESHOLDS[ccaa];
  if (!list) return null;

  // Solo aplica si la CCAA bonifica al grupo en cuestion
  const baseBonif = getCCAABonification(ccaa, group, value);
  if (baseBonif.pct === 0) return null;

  // Si el valor esta entre 90% y 110% de un umbral, alertamos
  for (const t of list) {
    const ratio = value / t.upTo;
    if (ratio >= 0.9 && ratio <= 1.1) {
      const justOver = value > t.upTo;
      return {
        id: `threshold_${ccaa}_${t.upTo}`,
        severity: justOver ? "warning" : "info",
        title: justOver
          ? `Has cruzado el umbral de ${t.label} en ${CCAA_LABELS[ccaa]}`
          : `Cerca del umbral de ${t.label} en ${CCAA_LABELS[ccaa]}`,
        description: justOver
          ? `Por encima de ${t.label} la bonificacion baja del ${t.pct}% al siguiente tramo. Revisa si una distribucion distinta del caudal puede dejar la base por debajo del umbral.`
          : `Si la base liquidable supera ${t.label}, la bonificacion baja del ${t.pct}%. Conviene verificar la valoracion del caudal hereditario.`,
      };
    }
  }
  return null;
}
