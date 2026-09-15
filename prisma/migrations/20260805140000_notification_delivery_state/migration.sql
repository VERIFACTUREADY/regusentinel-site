-- Máquina de estados de entrega para las notificaciones.
--
-- Antes se consultaba si existía una entrega correcta, se enviaba, y sólo
-- después se registraba. Dos ejecuciones simultáneas del cron leían ambas "no
-- enviado" y ambas enviaban. Ahora la fila se crea en PROCESSING ANTES de
-- llamar al proveedor externo, y sólo quien consigue la reserva envía.
--
-- Migración aditiva: no borra ni reescribe nada. Las filas existentes se
-- clasifican a partir de la columna `status` que ya tenían.

CREATE TYPE "NotificationDeliveryStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED');

ALTER TABLE "NotificationLog"
  ADD COLUMN IF NOT EXISTS "deliveryStatus" "NotificationDeliveryStatus" NOT NULL DEFAULT 'SENT',
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

-- Reclasificación del histórico: las filas antiguas guardaban el resultado en
-- la columna de texto `status` ('sent' | 'failed').
UPDATE "NotificationLog" SET "deliveryStatus" = 'FAILED' WHERE "status" = 'failed';
UPDATE "NotificationLog" SET "deliveryStatus" = 'SENT'   WHERE "status" = 'sent';
UPDATE "NotificationLog" SET "attempts" = 1 WHERE "attempts" = 0;
UPDATE "NotificationLog" SET "completedAt" = "createdAt" WHERE "deliveryStatus" = 'SENT' AND "completedAt" IS NULL;

CREATE INDEX IF NOT EXISTS "NotificationLog_deliveryStatus_startedAt_idx"
  ON "NotificationLog"("deliveryStatus", "startedAt");
