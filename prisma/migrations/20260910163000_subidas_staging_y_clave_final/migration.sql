-- Separa la clave de PREPARACION (donde escribe el navegador, reutilizable
-- mientras la politica firmada no caduque) de la clave FINAL (a la que
-- referencia el Document, nunca alcanzable de nuevo por esa politica). Anade
-- el estado CLEANING con reclamacion CAS, la atadura del actor interno y del
-- consentimiento del portal, y la retencion acotada de filas COMPLETED.
--
-- DATA-SAFE: ningun DROP TABLE, ningun `db push`, ningun --accept-data-loss.
-- La columna "fileKey" se RENOMBRA (no se borra y recrea), asi que las filas
-- que ya existieran de d899d2d conservan su valor integro.
--
-- BACKFILL EXPLICITO DE LAS FILAS DE d899d2d
-- -------------------------------------------
-- En el diseno anterior no habia distincion staging/final: `fileKey` ERA la
-- clave que el propio Document.fileKey referenciaba, una vez COMPLETED. Si no
-- se marcara aqui, la nueva limpieza de "staging sin borrar tras confirmar"
-- intentaria borrar el objeto real de un documento ya vivo. Por eso, para las
-- filas COMPLETED heredadas:
--   * finalKey          = su antigua fileKey (es la clave que el Document ya usa)
--   * completedAt        = su createdAt (unica marca de tiempo real disponible)
--   * stagingDeletedAt    = su createdAt (para que la limpieza NUNCA la toque)
-- Las filas PENDING/FAILED heredadas no tenian objeto verificado: su
-- stagingKey sigue siendo una clave de preparacion legitima y la limpieza por
-- caducidad ya vigente las alcanza igual que antes.

-- DropForeignKey (Cascade -> Restrict: un expediente con subidas pendientes no
-- puede desaparecer sin resolver antes su almacenamiento; ver purgeCase).
ALTER TABLE "PendingUpload" DROP CONSTRAINT "PendingUpload_caseId_fkey";

-- Renombrar, no borrar: preserva el valor de cada fila existente.
ALTER TABLE "PendingUpload" RENAME COLUMN "fileKey" TO "stagingKey";

DROP INDEX "PendingUpload_fileKey_key";
CREATE UNIQUE INDEX "PendingUpload_stagingKey_key" ON "PendingUpload"("stagingKey");

-- AlterTable: columnas nuevas, todas opcionales para no romper filas existentes.
ALTER TABLE "PendingUpload"
  ADD COLUMN "finalKey" TEXT,
  ADD COLUMN "portalConsentId" TEXT,
  ADD COLUMN "claimedAt" TIMESTAMP(3),
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "stagingDeletedAt" TIMESTAMP(3);

-- Backfill de las filas heredadas de d899d2d (ver nota arriba).
UPDATE "PendingUpload"
SET "finalKey" = "stagingKey",
    "completedAt" = "createdAt",
    "stagingDeletedAt" = "createdAt"
WHERE "status" = 'COMPLETED';

CREATE UNIQUE INDEX "PendingUpload_finalKey_key" ON "PendingUpload"("finalKey");
CREATE INDEX "PendingUpload_status_completedAt_idx" ON "PendingUpload"("status", "completedAt");

-- AddForeignKey
ALTER TABLE "PendingUpload" ADD CONSTRAINT "PendingUpload_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
