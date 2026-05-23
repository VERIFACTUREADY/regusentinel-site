-- Integraciones outbound: Slack (incoming webhook) y custom webhook firmado.
-- Plan Firma. Las notificaciones del Radar ISD se entregan también por estos
-- canales además del email interno.

ALTER TYPE "NotificationChannel" ADD VALUE 'SLACK';
ALTER TYPE "NotificationChannel" ADD VALUE 'WEBHOOK';

ALTER TABLE "Organization" ADD COLUMN "slackWebhookUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN "customWebhookUrl" TEXT;
ALTER TABLE "Organization" ADD COLUMN "customWebhookSecret" TEXT;
