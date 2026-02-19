-- CreateEnum
CREATE TYPE "PaymentType" AS ENUM ('ADMISSION', 'MONTHLY');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "lastDataChange" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "type" "PaymentType" NOT NULL DEFAULT 'MONTHLY';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "monthlyFee" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "BranchAIReport" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchAIReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageDraft" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT,
    "action" TEXT NOT NULL,
    "language" TEXT NOT NULL DEFAULT 'en',
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageDraft_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BranchAIReport_branchId_createdAt_idx" ON "BranchAIReport"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageDraft_branchId_studentId_idx" ON "MessageDraft"("branchId", "studentId");

-- AddForeignKey
ALTER TABLE "BranchAIReport" ADD CONSTRAINT "BranchAIReport_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDraft" ADD CONSTRAINT "MessageDraft_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDraft" ADD CONSTRAINT "MessageDraft_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
