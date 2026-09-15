-- Microsoft Teams: mismo patrón outbound que Slack pero con MessageCard.

ALTER TYPE "NotificationChannel" ADD VALUE 'TEAMS';
ALTER TABLE "Organization" ADD COLUMN "teamsWebhookUrl" TEXT;
