-- CreateTable
CREATE TABLE "PendingUpload" (
    "id" TEXT NOT NULL,
    "orgId" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "expectedSize" INTEGER NOT NULL,
    "uploadedBy" TEXT,
    "isPortalUpload" BOOLEAN NOT NULL DEFAULT false,
    "taskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "documentId" TEXT,
    "failureReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingUpload_fileKey_key" ON "PendingUpload"("fileKey");

-- CreateIndex
CREATE UNIQUE INDEX "PendingUpload_documentId_key" ON "PendingUpload"("documentId");

-- CreateIndex
CREATE INDEX "PendingUpload_status_expiresAt_idx" ON "PendingUpload"("status", "expiresAt");

-- CreateIndex
CREATE INDEX "PendingUpload_caseId_idx" ON "PendingUpload"("caseId");

-- AddForeignKey
ALTER TABLE "PendingUpload" ADD CONSTRAINT "PendingUpload_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case"("id") ON DELETE CASCADE ON UPDATE CASCADE;
