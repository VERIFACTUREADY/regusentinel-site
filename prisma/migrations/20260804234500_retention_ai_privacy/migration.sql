-- Retencion real, configuracion de IA por organizacion y PromptLog sin PII.

-- 1. Uso de IA: decision explicita del responsable del tratamiento.
--    Por defecto DESACTIVADO. Las organizaciones existentes quedan con IA
--    desactivada a proposito: nadie habia decidido activarla, y reactivarla
--    es un clic informado en Ajustes.
ALTER TABLE "Organization"
  ADD COLUMN "aiEnabled"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "aiEnabledAt" TIMESTAMP(3);

-- 2. Ciclo de retencion separado en fases.
ALTER TABLE "Case"
  ADD COLUMN "purgeScheduledAt" TIMESTAMP(3),
  ADD COLUMN "purgedAt"         TIMESTAMP(3),
  ADD COLUMN "purgeError"       TEXT,
  ADD COLUMN "purgeAttempts"    INTEGER NOT NULL DEFAULT 0;

-- Los expedientes ya soft-deleted quedan programados para purga a partir de
-- ahora. No se purgan retroactivamente sin margen: se les da el plazo de
-- retencion de su organizacion desde este momento, para que un despliegue no
-- borre datos de golpe.
UPDATE "Case" c
SET "purgeScheduledAt" = NOW() + (o."retentionDays" || ' days')::interval
FROM "Organization" o
WHERE c."orgId" = o."id" AND c."deletedAt" IS NOT NULL AND c."purgedAt" IS NULL;

CREATE INDEX "Case_purgeScheduledAt_idx" ON "Case"("purgeScheduledAt");

-- 3. PromptLog deja de almacenar el prompt integro.
--
--    La columna `prompt` contenia el contexto del expediente con nombres,
--    DNI, telefonos y emails: PII duplicada y conservada sin plazo. Se
--    sustituye por la huella del contexto, que permite correlacionar una
--    respuesta con su entrada sin guardarla.
--
--    Los prompts historicos se DESCARTAN: conservarlos seria mantener
--    exactamente el problema que esta migracion corrige.
ALTER TABLE "PromptLog" ADD COLUMN "contextHash" TEXT;
UPDATE "PromptLog" SET "contextHash" = encode(sha256("prompt"::bytea), 'hex');
ALTER TABLE "PromptLog" DROP COLUMN "prompt";

CREATE INDEX "PromptLog_createdAt_idx" ON "PromptLog"("createdAt");
