-- Deduplicacion de notificaciones POR ENTREGA.
--
-- Antes se comprobaba (caseId, kind, status='sent'). Si el email llegaba a un
-- destinatario y fallaba en otro, la siguiente ejecucion saltaba el expediente
-- entero y el segundo no lo recibia nunca; ademas un email enviado bloqueaba
-- tambien Slack, Teams y el webhook, porque el canal no entraba en la
-- comprobacion.
--
-- La clave es <caseId>:<kind>:<channel>:<recipient>:<ventana> y SOLO se escribe
-- en las entregas correctas, de modo que una fallida se puede reintentar.
--
-- Nullable a proposito: en PostgreSQL un indice unico admite multiples NULL,
-- asi que las filas anteriores y las fallidas conviven sin colisionar.

ALTER TABLE "NotificationLog" ADD COLUMN "dedupeKey" TEXT;

-- Backfill de las entregas correctas ya registradas, para no reenviar avisos
-- que el cliente ya recibio. Se usa DISTINCT ON porque el historico puede
-- contener duplicados de la misma entrega (el bug permitia reintentos
-- parciales) y el indice unico los rechazaria.
WITH primeras AS (
  SELECT DISTINCT ON ("caseId", "kind", "channel", lower("recipient"))
    "id",
    "caseId" || ':' || "kind" || ':' || "channel" || ':' || lower("recipient") || ':' AS clave
  FROM "NotificationLog"
  WHERE "status" = 'sent'
  ORDER BY "caseId", "kind", "channel", lower("recipient"), "createdAt" ASC
)
UPDATE "NotificationLog" n
SET "dedupeKey" = p.clave
FROM primeras p
WHERE n."id" = p."id";

CREATE UNIQUE INDEX "NotificationLog_dedupeKey_key" ON "NotificationLog"("dedupeKey");
CREATE INDEX "NotificationLog_caseId_kind_channel_recipient_idx"
  ON "NotificationLog"("caseId", "kind", "channel", "recipient");
