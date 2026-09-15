-- Éxito parcial y entregas por destinatario en los workflows.
--
-- Antes, SEND_EMAIL_TEAM se registraba como SUCCESS si al menos UN destinatario
-- recibía el correo: con diez destinatarios y nueve fallos, la ejecución
-- figuraba como correcta y los nueve fallos quedaban invisibles y sin
-- reintento posible (reintentar la regla habría duplicado el envío al que sí
-- lo recibió).
--
-- Migración aditiva: no borra ni reescribe nada.

ALTER TYPE "WorkflowLogStatus" ADD VALUE IF NOT EXISTS 'PARTIAL';

CREATE TYPE "WorkflowDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

CREATE TABLE IF NOT EXISTS "WorkflowDelivery" (
  "id"            TEXT NOT NULL,
  "workflowLogId" TEXT NOT NULL,
  "recipient"     TEXT NOT NULL,
  "status"        "WorkflowDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "error"         TEXT,
  "attempts"      INTEGER NOT NULL DEFAULT 0,
  "lastTriedAt"   TIMESTAMP(3),
  "sentAt"        TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowDelivery_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowDelivery_workflowLogId_recipient_key"
  ON "WorkflowDelivery"("workflowLogId", "recipient");
CREATE INDEX IF NOT EXISTS "WorkflowDelivery_status_lastTriedAt_idx"
  ON "WorkflowDelivery"("status", "lastTriedAt");

ALTER TABLE "WorkflowDelivery"
  ADD CONSTRAINT "WorkflowDelivery_workflowLogId_fkey"
  FOREIGN KEY ("workflowLogId") REFERENCES "WorkflowLog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
