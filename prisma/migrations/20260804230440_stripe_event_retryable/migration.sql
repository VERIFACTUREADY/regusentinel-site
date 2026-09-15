-- StripeEvent pasa de "visto" a maquina de estados reintentable.
--
-- Antes la tabla solo guardaba el id y `processedAt`, y la fila se creaba
-- ANTES de ejecutar la logica del evento. Si el handler fallaba, el evento
-- quedaba marcado y el reintento de Stripe se descartaba como duplicado: la
-- activacion de la suscripcion se perdia de forma permanente.
--
-- Migracion sin perdida de datos: las filas existentes representan eventos que
-- el codigo antiguo dio por buenos, asi que se convierten a PROCESSED
-- conservando su fecha original en `completedAt` y `receivedAt`.

CREATE TYPE "StripeEventStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED');

ALTER TABLE "StripeEvent"
  ADD COLUMN "attempts"    INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "lastError"   TEXT,
  ADD COLUMN "receivedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "startedAt"   TIMESTAMP(3),
  ADD COLUMN "status"      "StripeEventStatus" NOT NULL DEFAULT 'RECEIVED';

-- Conserva el historico antes de retirar la columna antigua.
UPDATE "StripeEvent"
SET "status"      = 'PROCESSED',
    "completedAt" = "processedAt",
    "receivedAt"  = "processedAt",
    "attempts"    = 1;

DROP INDEX "StripeEvent_processedAt_idx";
ALTER TABLE "StripeEvent" DROP COLUMN "processedAt";

CREATE INDEX "StripeEvent_status_receivedAt_idx" ON "StripeEvent"("status", "receivedAt");
CREATE INDEX "StripeEvent_receivedAt_idx" ON "StripeEvent"("receivedAt");
