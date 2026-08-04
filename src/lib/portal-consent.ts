/**
 * Consentimiento del portal familiar: texto versionado y evidencia.
 *
 * ESTADO ANTERIOR
 * ---------------
 * `Case.consentAccepted` era un booleano que se sobrescribía en cada
 * aceptación. No acreditaba qué texto se aceptó, ni desde dónde, y una segunda
 * aceptación borraba la anterior. Además ningún endpoint del portal lo exigía:
 * se podían subir, descargar y enviar mensajes sin haber aceptado nada.
 */

import { createHash } from "crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "./prisma";

type Db = PrismaClient | Prisma.TransactionClient;

/**
 * Texto legal vigente del consentimiento del portal.
 *
 * Al cambiarlo hay que subir `PORTAL_CONSENT_VERSION`. Las aceptaciones
 * anteriores dejan de ser válidas y se pide una nueva: es el comportamiento
 * correcto cuando cambia aquello a lo que la persona consintió.
 */
export const PORTAL_CONSENT_VERSION = "2026-08-v1";

export const PORTAL_CONSENT_TEXT = `Autorizo a la gestoría o funeraria responsable de este expediente a tratar mis datos personales y los del familiar fallecido con la finalidad de tramitar las gestiones administrativas posteriores al fallecimiento.

Entiendo que:
- Los documentos que suba a este portal serán accesibles para el equipo que tramita el expediente.
- Puedo retirar este consentimiento en cualquier momento contactando con la entidad responsable, sin que ello afecte a la licitud del tratamiento anterior.
- Los datos se conservarán durante el plazo de retención configurado por la entidad responsable y los plazos legales aplicables.
- La entidad responsable del tratamiento es la gestoría o funeraria que gestiona el expediente, no el proveedor del software.`;

/** Hash del texto exacto que se mostró, para poder acreditarlo después. */
export function hashConsentText(text: string = PORTAL_CONSENT_TEXT): string {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

export const PORTAL_CONSENT_HASH = hashConsentText();

export interface ConsentStatus {
  /** Hay una aceptación vigente de la versión actual, sin retirar. */
  valid: boolean;
  /** Aceptó una versión anterior: hay que volver a pedirlo. */
  outdated: boolean;
  acceptedAt: Date | null;
  version: string | null;
}

/**
 * Estado del consentimiento de un expediente. Sólo cuenta una aceptación de la
 * versión vigente que no haya sido retirada.
 */
export async function getConsentStatus(
  caseId: string,
  db: Db = defaultPrisma,
): Promise<ConsentStatus> {
  const latest = await db.portalConsent.findFirst({
    where: { caseId, purpose: "PORTAL_FAMILIA", withdrawnAt: null },
    orderBy: { acceptedAt: "desc" },
    select: { version: true, acceptedAt: true, textHash: true },
  });

  if (!latest) {
    return { valid: false, outdated: false, acceptedAt: null, version: null };
  }

  // Las filas heredadas de la migración se aceptan como válidas: cortarle el
  // portal a una familia que ya había consentido sería peor que su falta de
  // evidencia detallada. Quedan marcadas y son identificables.
  const isLegacy = latest.version.startsWith("legacy-");
  const isCurrent = latest.version === PORTAL_CONSENT_VERSION;

  return {
    valid: isCurrent || isLegacy,
    outdated: !isCurrent && !isLegacy,
    acceptedAt: latest.acceptedAt,
    version: latest.version,
  };
}

/**
 * Registra una aceptación **nueva**. Nunca sobrescribe: cada aceptación es una
 * fila más, de modo que el histórico se conserva.
 */
export async function recordConsent(params: {
  caseId: string;
  declaredName?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  db?: Db;
}) {
  const db = params.db ?? defaultPrisma;

  return db.portalConsent.create({
    data: {
      caseId: params.caseId,
      version: PORTAL_CONSENT_VERSION,
      textHash: PORTAL_CONSENT_HASH,
      purpose: "PORTAL_FAMILIA",
      declaredName: params.declaredName?.trim() || null,
      ip: params.ip ?? null,
      userAgent: params.userAgent?.slice(0, 400) ?? null,
    },
  });
}

/** IP del cliente a partir de las cabeceras del proxy. */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() || null;
  return headers.get("x-real-ip");
}
