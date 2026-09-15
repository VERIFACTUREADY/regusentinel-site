-- Recuperación de eventos de Stripe atascados.
--
-- Añade el estado NEEDS_INTERVENTION (reintentos automáticos agotados), la
-- marca del último aviso operativo y el índice que usa el cron de recuperación
-- para localizar ejecuciones colgadas por `startedAt`.
--
-- Migración aditiva: no borra ni reescribe nada.

ALTER TYPE "StripeEventStatus" ADD VALUE IF NOT EXISTS 'NEEDS_INTERVENTION';

ALTER TABLE "StripeEvent" ADD COLUMN IF NOT EXISTS "alertedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "StripeEvent_status_startedAt_idx" ON "StripeEvent"("status", "startedAt");
