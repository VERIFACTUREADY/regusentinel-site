-- Estados explícitos del ciclo de purga y evidencia sin datos personales.
--
-- Antes sólo había un contador `purgeAttempts`: al llegar a 5, el expediente
-- dejaba de seleccionarse para siempre y sus datos personales quedaban en la
-- base y en S3 sin que nadie se enterara. Y `Case.purgedAt` no podía observarse
-- nunca, porque la purga borra la fila entera.
--
-- Migración aditiva: no borra ni reescribe nada.

CREATE TYPE "PurgeState" AS ENUM (
  'PENDING',
  'PROCESSING',
  'RETRYABLE_FAILURE',
  'NEEDS_INTERVENTION',
  'COMPLETED'
);

ALTER TABLE "Case"
  ADD COLUMN IF NOT EXISTS "purgeState" "PurgeState" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS "purgeNextAttemptAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "purgeAlertedAt" TIMESTAMP(3);

-- Reclasificación del histórico: lo que ya venía fallando se marca según su
-- contador, para que no arranque como si nunca se hubiera intentado.
UPDATE "Case" SET "purgeState" = 'RETRYABLE_FAILURE'
  WHERE "purgeAttempts" > 0 AND "purgeAttempts" < 5 AND "purgedAt" IS NULL;
UPDATE "Case" SET "purgeState" = 'NEEDS_INTERVENTION'
  WHERE "purgeAttempts" >= 5 AND "purgedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "Case_purgeState_purgeNextAttemptAt_idx"
  ON "Case"("purgeState", "purgeNextAttemptAt");

CREATE TABLE IF NOT EXISTS "PurgeEvidence" (
  "id"               TEXT NOT NULL,
  "orgId"            TEXT NOT NULL,
  "caseRef"          TEXT NOT NULL,
  "scheduledAt"      TIMESTAMP(3),
  "purgedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "documentsDeleted" INTEGER NOT NULL DEFAULT 0,
  "attempts"         INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "PurgeEvidence_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PurgeEvidence_orgId_purgedAt_idx"
  ON "PurgeEvidence"("orgId", "purgedAt");

ALTER TABLE "PurgeEvidence"
  ADD CONSTRAINT "PurgeEvidence_orgId_fkey"
  FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
