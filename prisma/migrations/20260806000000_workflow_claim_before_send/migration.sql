-- Reserva ANTES del envío en las entregas de workflow.
--
-- Antes, `SEND_EMAIL_TEAM` enviaba los correos y DESPUÉS creaba `WorkflowLog` y
-- `WorkflowDelivery`. Eso no es idempotencia: dos ejecuciones simultáneas del
-- mismo evento enviaban dos veces, y si el proceso moría entre la llamada al
-- proveedor y la escritura en PostgreSQL el correo quedaba enviado sin ningún
-- registro —invisible y, en el siguiente intento, reenviado—.
--
-- Migración aditiva: no borra ni reescribe nada.

-- Estado de reclamación de una entrega individual.
ALTER TYPE "WorkflowDeliveryStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

-- Y de la ejecución completa: el log se crea en PROCESSING antes de llamar a
-- nadie, de modo que una caída a mitad deja rastro en vez de desaparecer.
ALTER TYPE "WorkflowLogStatus" ADD VALUE IF NOT EXISTS 'PROCESSING';

-- Clave idempotente de la ejecución: SHA-256 de (organización, regla,
-- expediente, evento, ventana). No contiene datos personales.
ALTER TABLE "WorkflowLog"
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "WorkflowLog_idempotencyKey_key"
  ON "WorkflowLog"("idempotencyKey");
