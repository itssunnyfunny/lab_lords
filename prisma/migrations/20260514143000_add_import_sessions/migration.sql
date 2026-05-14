-- CreateEnum
CREATE TYPE "ImportSourceType" AS ENUM ('CSV', 'XLSX', 'XLS', 'PDF', 'PASTED_TABLE', 'OTHER');

-- CreateEnum
CREATE TYPE "ImportSessionStatus" AS ENUM ('UPLOADED', 'ANALYZING', 'NEEDS_MAPPING', 'NEEDS_INFO', 'VALIDATED', 'READY_TO_COMMIT', 'COMMITTING', 'COMMITTED', 'PARTIAL', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportRowStatus" AS ENUM ('READY', 'NEEDS_REVIEW', 'BLOCKED', 'WARNING', 'DUPLICATE', 'CONFLICT', 'IMPORTED', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "ImportQuestionStatus" AS ENUM ('OPEN', 'ANSWERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ImportCommitStatus" AS ENUM ('SUCCESS', 'PARTIAL', 'FAILED');

-- CreateTable
CREATE TABLE "ImportSession" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "uploadedByUserId" TEXT NOT NULL,
    "sourceType" "ImportSourceType" NOT NULL,
    "fileName" TEXT,
    "fileMeta" JSONB,
    "status" "ImportSessionStatus" NOT NULL DEFAULT 'UPLOADED',
    "mapping" JSONB,
    "summary" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportRow" (
    "id" TEXT NOT NULL,
    "importSessionId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "rawData" JSONB NOT NULL,
    "mappedData" JSONB,
    "normalizedData" JSONB,
    "status" "ImportRowStatus" NOT NULL DEFAULT 'NEEDS_REVIEW',
    "issues" JSONB,
    "warnings" JSONB,
    "confidence" INTEGER,
    "skipped" BOOLEAN NOT NULL DEFAULT false,
    "createdEntityIds" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ImportRow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportQuestion" (
    "id" TEXT NOT NULL,
    "importSessionId" TEXT NOT NULL,
    "rowId" TEXT,
    "field" TEXT,
    "question" TEXT NOT NULL,
    "options" JSONB,
    "answer" JSONB,
    "status" "ImportQuestionStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),

    CONSTRAINT "ImportQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportCommit" (
    "id" TEXT NOT NULL,
    "importSessionId" TEXT NOT NULL,
    "committedByUserId" TEXT NOT NULL,
    "status" "ImportCommitStatus" NOT NULL,
    "summary" JSONB NOT NULL,
    "errors" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportCommit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ImportSession_branchId_idx" ON "ImportSession"("branchId");

-- CreateIndex
CREATE INDEX "ImportSession_uploadedByUserId_idx" ON "ImportSession"("uploadedByUserId");

-- CreateIndex
CREATE INDEX "ImportSession_branchId_createdAt_idx" ON "ImportSession"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportRow_importSessionId_idx" ON "ImportRow"("importSessionId");

-- CreateIndex
CREATE INDEX "ImportRow_status_idx" ON "ImportRow"("status");

-- CreateIndex
CREATE INDEX "ImportQuestion_importSessionId_idx" ON "ImportQuestion"("importSessionId");

-- CreateIndex
CREATE INDEX "ImportQuestion_status_idx" ON "ImportQuestion"("status");

-- CreateIndex
CREATE INDEX "ImportCommit_importSessionId_idx" ON "ImportCommit"("importSessionId");

-- AddForeignKey
ALTER TABLE "ImportSession" ADD CONSTRAINT "ImportSession_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSession" ADD CONSTRAINT "ImportSession_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportRow" ADD CONSTRAINT "ImportRow_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportQuestion" ADD CONSTRAINT "ImportQuestion_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportCommit" ADD CONSTRAINT "ImportCommit_importSessionId_fkey" FOREIGN KEY ("importSessionId") REFERENCES "ImportSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportCommit" ADD CONSTRAINT "ImportCommit_committedByUserId_fkey" FOREIGN KEY ("committedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
