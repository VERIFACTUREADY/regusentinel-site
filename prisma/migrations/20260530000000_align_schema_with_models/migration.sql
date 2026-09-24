-- Reconciliacion del historial de migraciones con schema.prisma.
--
-- CONTEXTO
-- --------
-- Entre 20260529000000 y esta migracion se anadieron al schema.prisma varias
-- funcionalidades completas (plantillas de expediente, registro de
-- notificaciones, motor de workflows, preferencias de notificacion, CRM de
-- demos, vinculo documento-tarea, intervalo de facturacion...) SIN escribir la
-- migracion correspondiente: 6 tablas y ~75 columnas de diferencia.
--
-- Ese desfase es lo que llevo a introducir en el deploy un
-- `prisma db push --accept-data-loss`, que puede destruir datos en produccion.
-- Esta migracion cierra el hueco de forma incremental y NO destructiva, de
-- modo que el historial vuelve a ser la unica fuente de verdad y el deploy
-- puede usar unicamente `prisma migrate deploy`.
--
-- Generada con `prisma migrate diff` entre el esquema resultante de las
-- migraciones historicas y el esquema objetivo. Verificada: no contiene
-- ninguna sentencia DROP TABLE, DROP COLUMN ni TRUNCATE.

-- CreateEnum
CREATE TYPE "BillingInterval" AS ENUM ('MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "WorkflowAction" AS ENUM ('SEND_EMAIL_CONTACT', 'SEND_EMAIL_TEAM', 'ADD_CASE_COMMENT', 'CHANGE_CASE_STATUS');

-- CreateEnum
CREATE TYPE "WorkflowLogStatus" AS ENUM ('SUCCESS', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "WorkflowTrigger" AS ENUM ('CASE_STATUS_CHANGED', 'TASK_STATUS_CHANGED', 'CASE_CREATED', 'DOCUMENT_UPLOADED');

-- AlterEnum
BEGIN;
CREATE TYPE "PlanTier_new" AS ENUM ('INICIA', 'DESPACHO', 'FIRMA');
ALTER TABLE "Subscription" ALTER COLUMN "plan" DROP DEFAULT;
ALTER TABLE "Subscription" ALTER COLUMN "plan" TYPE "PlanTier_new" USING ("plan"::text::"PlanTier_new");
ALTER TYPE "PlanTier" RENAME TO "PlanTier_old";
ALTER TYPE "PlanTier_new" RENAME TO "PlanTier";
DROP TYPE "PlanTier_old";
ALTER TABLE "Subscription" ALTER COLUMN "plan" SET DEFAULT 'INICIA';
COMMIT;

-- AlterTable
ALTER TABLE "DemoRequest" ADD COLUMN     "internalNotes" TEXT,
ADD COLUMN     "leadStatus" TEXT NOT NULL DEFAULT 'NEW',
ADD COLUMN     "source" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "taskId" TEXT;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "notifPrefs" JSONB;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "brandDisplayName" TEXT,
ADD COLUMN     "brandFooterText" TEXT,
ADD COLUMN     "brandLogoUrl" TEXT,
ADD COLUMN     "brandPrimaryColor" TEXT,
ADD COLUMN     "brandSupportEmail" TEXT,
ADD COLUMN     "onboardingDismissedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "interval" "BillingInterval" NOT NULL DEFAULT 'MONTHLY',
ADD COLUMN     "setupFeePaid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "setupFeePaidAt" TIMESTAMP(3),
ALTER COLUMN "plan" SET DEFAULT 'INICIA';

-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "blockReason" TEXT,
ADD COLUMN     "blockedUntil" TIMESTAMP(3),
ADD COLUMN     "deadline" TIMESTAMP(3),
ADD COLUMN     "docTag" TEXT;

-- CreateTable
CREATE TABLE "CaseTemplate" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categories" "TaskCategory"[],
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CaseTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseTemplateTask" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "category" "TaskCategory" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "deadlineOffsetDays" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CaseTemplateTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "kind" "NotificationKind" NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PortalMessage" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fromFamily" BOOLEAN NOT NULL,
    "authorName" TEXT,
    "content" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PortalMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskNote" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskNote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowLog" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "caseId" TEXT,
    "status" "WorkflowLogStatus" NOT NULL,
    "details" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkflowLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowRule" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "WorkflowTrigger" NOT NULL,
    "conditions" JSONB NOT NULL,
    "action" "WorkflowAction" NOT NULL,
    "actionConfig" JSONB NOT NULL,
    "execCount" INTEGER NOT NULL DEFAULT 0,
    "lastRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CaseTemplate_orgId_idx" ON "CaseTemplate"("orgId" ASC);

-- CreateIndex
CREATE INDEX "CaseTemplateTask_templateId_sortOrder_idx" ON "CaseTemplateTask"("templateId" ASC, "sortOrder" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_caseId_kind_idx" ON "NotificationLog"("caseId" ASC, "kind" ASC);

-- CreateIndex
CREATE INDEX "NotificationLog_orgId_createdAt_idx" ON "NotificationLog"("orgId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "PortalMessage_caseId_createdAt_idx" ON "PortalMessage"("caseId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "TaskNote_taskId_createdAt_idx" ON "TaskNote"("taskId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "WorkflowLog_caseId_idx" ON "WorkflowLog"("caseId" ASC);

-- CreateIndex
CREATE INDEX "WorkflowLog_ruleId_createdAt_idx" ON "WorkflowLog"("ruleId" ASC, "createdAt" ASC);

-- CreateIndex
CREATE INDEX "WorkflowRule_orgId_isActive_idx" ON "WorkflowRule"("orgId" ASC, "isActive" ASC);

-- AddForeignKey
ALTER TABLE "CaseTemplate" ADD CONSTRAINT "CaseTemplate_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseTemplateTask" ADD CONSTRAINT "CaseTemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "CaseTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Document" ADD CONSTRAINT "Document_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PortalMessage" ADD CONSTRAINT "PortalMessage_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskNote" ADD CONSTRAINT "TaskNote_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskNote" ADD CONSTRAINT "TaskNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowLog" ADD CONSTRAINT "WorkflowLog_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowLog" ADD CONSTRAINT "WorkflowLog_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "WorkflowRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkflowRule" ADD CONSTRAINT "WorkflowRule_orgId_fkey" FOREIGN KEY ("orgId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

