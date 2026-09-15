-- AlterTable
ALTER TABLE "Case" ADD COLUMN     "portalTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "portalTokenRevokedAt" TIMESTAMP(3),
ADD COLUMN     "portalTokenRotatedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "deletionAt" TIMESTAMP(3),
ADD COLUMN     "deletionError" TEXT,
ADD COLUMN     "deletionState" TEXT,
ADD COLUMN     "visibleToFamily" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PortalConsent" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "textHash" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT 'PORTAL_FAMILIA',
    "declaredName" TEXT,
    "ip" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawnAt" TIMESTAMP(3),

    CONSTRAINT "PortalConsent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PortalConsent_caseId_acceptedAt_idx" ON "PortalConsent"("caseId", "acceptedAt");

-- CreateIndex
CREATE INDEX "PortalConsent_caseId_version_idx" ON "PortalConsent"("caseId", "version");

-- CreateIndex
CREATE INDEX "Document_caseId_visibleToFamily_idx" ON "Document"("caseId", "visibleToFamily");

-- AddForeignKey
ALTER TABLE "PortalConsent" ADD CONSTRAINT "PortalConsent_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill de visibilidad.
--
-- Los documentos existentes quedan PRIVADOS por defecto (esa es justamente la
-- correccion: el portal los estaba exponiendo todos). La unica excepcion son
-- los que subio la propia familia desde el portal: son suyos y deben seguir
-- viendolos, asi que se marcan visibles.
UPDATE "Document" SET "visibleToFamily" = true WHERE "isPortalUpload" = true;

-- Backfill del consentimiento.
--
-- Los expedientes que ya tenian consentimiento aceptado conservan el acceso:
-- se les crea una fila de evidencia marcada como heredada, para no cortar el
-- portal a familias que ya habian aceptado. Queda explicito que procede de la
-- migracion y no de una aceptacion registrada con IP y user-agent.
INSERT INTO "PortalConsent" ("id", "caseId", "version", "textHash", "purpose", "declaredName", "acceptedAt")
SELECT
  'pc-legacy-' || "id",
  "id",
  'legacy-pre-2026-08',
  'sin-hash-consentimiento-anterior-al-registro-de-evidencia',
  'PORTAL_FAMILIA',
  "legitimationNote",
  COALESCE("consentDate", "createdAt")
FROM "Case"
WHERE "consentAccepted" = true;
