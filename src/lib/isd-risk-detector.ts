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
  /**
   * Patrimonio preexistente del heredero (€). Si está cerca de un tramo del
   * coeficiente multiplicador (art. 22 Ley 29/1987), generamos alerta de
   * optimización: una donación previa o una distribución distinta del caudal
   * puede dejarlo bajo el tramo.
   */
  preexistingPatrimony?: number | null;
  /**
   * Si en el caudal hay inmueble urbano. Habilita la detección de plazos y
   * optimización de la plusvalía municipal (IIVTNU).
   */
  hasUrbanProperty?: boolean;
  /**
   * Valor de adquisición declarado en escritura previa. Si está disponible
   * junto al valor de transmisión y el primero ≥ el segundo, la operación
   * está no sujeta a IIVTNU.
   */
  propertyAcquisitionValue?: number | null;
  /** Valor declarado en la transmisión mortis causa. */
  propertyTransmissionValue?: number | null;
  /**
   * El causante cambió de residencia fiscal en los 5 años previos.
   * Activa la alerta del art. 28 Ley 22/2009: si la residencia actual no
   * acredita los 5 años, AEAT puede recalcular en la CCAA previa.
   */
  recentResidenceChange?: boolean;
  /** Provincia/CCAA de residencia previa, opcional, para concretar el mensaje. */
  previousResidenceProvince?: string | null;
  /**
   * Reducciones aplicadas con periodo de mantenimiento. El detector
   * alerta cuando el aniversario de cierre está próximo (≤30d, ≤7d)
   * o ya pasado. Pensado para vivienda habitual (5-10 años), empresa
   * familiar (10 años), etc.
   */
  appliedReductions?: AppliedReduction[];
}

export type AppliedReductionType =
  | "VIVIENDA_HABITUAL"
  | "EMPRESA_FAMILIAR"
  | "EXPLOTACION_AGRARIA"
  | "DISCAPACIDAD"
  | "OTRA";

export interface AppliedReduction {
  type: AppliedReductionType;
  /** ISO date string (YYYY-MM-DD). */
  appliedDate: string;
  /** Años de mantenimiento requeridos según la normativa aplicada. */
  maintenanceYears: number;
  note?: string;
}

const REDUCTION_LABELS: Record<AppliedReductionType, string> = {
  VIVIENDA_HABITUAL: "Reducción por vivienda habitual",
  EMPRESA_FAMILIAR: "Reducción por empresa familiar",
  EXPLOTACION_AGRARIA: "Reducción por explotación agraria",
  DISCAPACIDAD: "Reducción por discapacidad",
  OTRA: "Reducción del art. 20",
};

const VALID_REDUCTION_TYPES: ReadonlySet<AppliedReductionType> = new Set<AppliedReductionType>([
  "VIVIENDA_HABITUAL",
  "EMPRESA_FAMILIAR",
  "EXPLOTACION_AGRARIA",
  "DISCAPACIDAD",
  "OTRA",
]);

/**
 * Convierte el campo Json de Prisma a un array tipado de AppliedReduction.
 * Descarta entradas con tipo desconocido, sin fecha o sin años de
 * mantenimiento. Tolerante a JSON malformado.
 */
export function parseAppliedReductions(raw: unknown): AppliedReduction[] {
  if (!Array.isArray(raw)) return [];
  const result: AppliedReduction[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const obj = item as Record<string, unknown>;
    const type = obj.type;
    const appliedDate = obj.appliedDate;
    const maintenanceYears = obj.maintenanceYears;
    if (typeof type !== "string" || !VALID_REDUCTION_TYPES.has(type as AppliedReductionType)) continue;
    if (typeof appliedDate !== "string" || !appliedDate.trim()) continue;
    if (typeof maintenanceYears !== "number" || maintenanceYears <= 0) continue;
    result.push({
      type: type as AppliedReductionType,
      appliedDate,
      maintenanceYears,
      note: typeof obj.note === "string" ? obj.note : undefined,
    });
  }
  return result;
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

  // ─── Riesgos de patrimonio preexistente (coeficiente multiplicador) ──
  if (typeof input.preexistingPatrimony === "number" && input.preexistingPatrimony >= 0) {
    const patrimonyRisk = detectPatrimonyThresholdRisk(input.preexistingPatrimony, input.group ?? "II");
    if (patrimonyRisk) risks.push(patrimonyRisk);
  }

  // ─── Riesgos de plusvalía municipal (IIVTNU) ────────────────────────
  if (input.hasUrbanProperty) {
    risks.push(...detectPlusvaliaRisks(daysUntilISD, daysUntilExtension, input));
  }

  // ─── Mantenimiento de reducciones aplicadas (art. 20) ──────────────
  if (Array.isArray(input.appliedReductions)) {
    for (const r of input.appliedReductions) {
      const risk = detectReductionMaintenanceRisk(r);
      if (risk) risks.push(risk);
    }
  }

  // ─── Cambio de residencia (art. 28 Ley 22/2009) ─────────────────────
  if (input.recentResidenceChange) {
    const ccaa = mapProvinceToCCAA(input.province);
    const previousCCAA = mapProvinceToCCAA(input.previousResidenceProvince ?? null);
    const group = input.group ?? "II";

    // Si la CCAA actual bonifica fuerte y la previa bonificaba menos,
    // AEAT podría querer revisarlo. Es el caso típico de mudanza fiscal.
    const currentBonif = ccaa ? getCCAABonification(ccaa, group, input.estimatedInheritanceValue ?? 0).pct : 0;
    const previousBonif = previousCCAA
      ? getCCAABonification(previousCCAA, group, input.estimatedInheritanceValue ?? 0).pct
      : 0;

    if (ccaa && currentBonif >= 80) {
      const prevLabel = previousCCAA ? CCAA_LABELS[previousCCAA] : (input.previousResidenceProvince || "otra CCAA");
      const advantageSwing = previousCCAA && previousBonif < currentBonif;
      risks.push({
        id: "residence_change_5y",
        severity: advantageSwing ? "warning" : "info",
        title: advantageSwing
          ? `Riesgo de revisión por cambio de residencia: ${CCAA_LABELS[ccaa]} vs ${prevLabel}`
          : "El causante consta con residencia <5 años en la CCAA actual",
        description: advantageSwing
          ? `${CCAA_LABELS[ccaa]} bonifica el ${currentBonif}% para grupo ${group}, frente al ${previousBonif}% de ${prevLabel}. Si el cambio de residencia es de los últimos 5 años, AEAT puede aplicar la normativa de ${prevLabel} (art. 28 Ley 22/2009).`
          : `${CCAA_LABELS[ccaa]} aplica una bonificación alta. Si el cambio de residencia del causante es de los últimos 5 años, AEAT puede aplicar la normativa de la CCAA previa (art. 28 Ley 22/2009).`,
        action: "Verifica empadronamiento, IRPF y permanencia en la CCAA actual durante 5 años antes del fallecimiento.",
      });
    }
  }

  return risks;
}

/**
 * Detecta si el patrimonio preexistente del heredero está cerca de un tramo
 * del coeficiente multiplicador del art. 22 Ley 29/1987. Los tramos son
 * idénticos en todas las CCAA del régimen común; el coeficiente concreto
 * varía por grupo de parentesco.
 */
const PATRIMONY_BRACKETS = [402678.11, 2007380.43, 4020770.98];

function detectPatrimonyThresholdRisk(patrimony: number, group: ParentescoGroup): ISDRisk | null {
  for (const bracket of PATRIMONY_BRACKETS) {
    const ratio = patrimony / bracket;
    if (ratio >= 0.9 && ratio <= 1.1) {
      const justOver = patrimony > bracket;
      const formatted = bracket.toLocaleString("es-ES", { maximumFractionDigits: 0 });
      const nextCoefMessage =
        group === "III"
          ? "el coeficiente multiplicador sube del 1,5882 al 1,6676"
          : group === "IV"
            ? "el coeficiente multiplicador sube del 2,0000 al 2,1000"
            : "el coeficiente multiplicador sube del 1,0000 al 1,0500";
      return {
        id: `patrimony_bracket_${bracket}`,
        severity: justOver ? "warning" : "info",
        title: justOver
          ? `Patrimonio preexistente cruza el tramo de ${formatted} €`
          : `Patrimonio preexistente cerca del tramo de ${formatted} €`,
        description: justOver
          ? `Al superar los ${formatted} € de patrimonio preexistente del heredero, ${nextCoefMessage} (art. 22 Ley 29/1987).`
          : `Si el patrimonio preexistente del heredero supera ${formatted} €, ${nextCoefMessage}. Una reducción adicional o redistribución puede mantenerlo bajo el tramo.`,
        action: "Revisa el patrimonio del heredero y considera reducciones aplicables para no cruzar el tramo.",
      };
    }
  }
  return null;
}

/**
 * Detecta riesgos de la plusvalía municipal (IIVTNU). Asume el plazo
 * ordinario de 6 meses desde el fallecimiento, igual que el ISD; muchos
 * municipios admiten prórroga de 6 meses adicionales solicitable en los
 * primeros 5 meses.
 */
function detectPlusvaliaRisks(daysUntilISD: number, daysUntilExtension: number, input: RiskInput): ISDRisk[] {
  const risks: ISDRisk[] = [];

  if (daysUntilISD < 0) {
    risks.push({
      id: "plusvalia_overdue",
      severity: "critical",
      title: `Plazo IIVTNU vencido hace ${Math.abs(daysUntilISD)} días`,
      description:
        "La plusvalía municipal del inmueble heredado debería haberse liquidado en los 6 meses desde el fallecimiento. La presentación extemporánea conlleva recargos del ayuntamiento e intereses de demora.",
      action: "Presentar la autoliquidación cuanto antes y valorar el recargo del ayuntamiento competente.",
    });
  } else if (daysUntilISD <= 7) {
    risks.push({
      id: "plusvalia_critical",
      severity: "critical",
      title: `Quedan ${daysUntilISD} días para liquidar la plusvalía municipal`,
      description:
        "Plazo crítico para presentar el IIVTNU del inmueble urbano heredado. Si no se solicitó prórroga, ya no hay margen.",
      action: "Calcular el IIVTNU por los dos métodos (objetivo y real) y presentar el más bajo en la oficina del ayuntamiento.",
    });
  } else if (daysUntilISD <= 30) {
    risks.push({
      id: "plusvalia_30d",
      severity: "warning",
      title: `Quedan ${daysUntilISD} días para liquidar la plusvalía municipal`,
      description:
        "La plusvalía municipal (IIVTNU) del inmueble urbano se acerca a su plazo. Verifica el valor catastral del suelo y los años de tenencia del causante.",
      action: "Preparar el cálculo por método objetivo y real. Elegir el más bajo según los datos de adquisición.",
    });
  }

  // Ventana de prórroga IIVTNU (igual que ISD: solo hasta el día 150).
  if (daysUntilExtension > 0 && daysUntilExtension <= 30 && daysUntilISD > 30) {
    risks.push({
      id: "plusvalia_extension_window",
      severity: "warning",
      title: `Quedan ${daysUntilExtension} días para solicitar prórroga de la plusvalía municipal`,
      description:
        "Muchos ayuntamientos admiten prórroga de 6 meses adicionales si se solicita dentro de los 5 primeros meses tras el fallecimiento. Verifica la ordenanza fiscal del municipio.",
      action: "Si la documentación no estará lista a tiempo, solicitar la prórroga al ayuntamiento competente.",
    });
  }

  // Detección de "no incremento" → operación no sujeta (sentencia TC + reforma 2021).
  const acq = input.propertyAcquisitionValue;
  const trans = input.propertyTransmissionValue;
  if (typeof acq === "number" && typeof trans === "number" && acq > 0 && trans > 0) {
    if (acq >= trans) {
      risks.push({
        id: "plusvalia_no_incremento",
        severity: "info",
        title: "Posible no sujeción a la plusvalía municipal",
        description:
          `El valor de adquisición declarado (${acq.toLocaleString("es-ES")} €) iguala o supera al de transmisión (${trans.toLocaleString("es-ES")} €). Tras el RDL 26/2021 y la sentencia TC 182/2021, no hay hecho imponible: la operación está no sujeta a IIVTNU.`,
        action: "Acreditar la inexistencia de incremento con las escrituras de adquisición y de la herencia.",
      });
    }
  }

  return risks;
}

/**
 * Para una reducción aplicada con periodo de mantenimiento, alerta cuando
 * el aniversario de cierre está próximo o ha pasado. El gestor debe
 * confirmar que el heredero ha cumplido los requisitos (no haber vendido
 * la vivienda, etc.).
 */
function detectReductionMaintenanceRisk(r: AppliedReduction): ISDRisk | null {
  if (!r || !r.appliedDate || !r.maintenanceYears) return null;
  const applied = new Date(r.appliedDate);
  if (Number.isNaN(applied.getTime())) return null;

  const expiry = new Date(applied);
  expiry.setFullYear(expiry.getFullYear() + r.maintenanceYears);
  const daysUntil = Math.ceil((expiry.getTime() - Date.now()) / MS_PER_DAY);
  const label = REDUCTION_LABELS[r.type] ?? REDUCTION_LABELS.OTRA;
  const expiryStr = expiry.toLocaleDateString("es-ES");

  if (daysUntil < -30) {
    // Más de un mes después del aniversario: ya no alertamos, el
    // periodo se ha cumplido (o se ha incumplido y se ha procesado).
    return null;
  }

  if (daysUntil <= 0) {
    return {
      id: `reduction_maintenance_passed_${r.type}`,
      severity: "info",
      title: `${label}: periodo de mantenimiento cumplido (${expiryStr})`,
      description: `La reducción del ${label.toLowerCase()} aplicada el ${new Date(r.appliedDate).toLocaleDateString("es-ES")} ha completado sus ${r.maintenanceYears} años de mantenimiento. Documentar el cumplimiento de los requisitos para cerrar el expediente fiscal.`,
      action: "Marcar la reducción como mantenida y archivar el expediente fiscal.",
    };
  }

  if (daysUntil <= 7) {
    return {
      id: `reduction_maintenance_7d_${r.type}`,
      severity: "warning",
      title: `${label}: el periodo de mantenimiento expira en ${daysUntil} días (${expiryStr})`,
      description: `Quedan ${daysUntil} días para que se cumplan los ${r.maintenanceYears} años. Si el heredero ha incumplido algún requisito (venta del bien, cese de la actividad...) debe regularizar antes de esta fecha.`,
      action: "Confirmar con el heredero que sigue cumpliendo los requisitos legales de la reducción.",
    };
  }

  if (daysUntil <= 30) {
    return {
      id: `reduction_maintenance_30d_${r.type}`,
      severity: "info",
      title: `${label}: aniversario crítico en ${daysUntil} días (${expiryStr})`,
      description: `Quedan ${daysUntil} días para completar el periodo de mantenimiento. Programa un recordatorio para verificar con el heredero que ha cumplido los requisitos durante los ${r.maintenanceYears} años.`,
    };
  }

  return null;
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
