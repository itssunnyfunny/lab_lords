-- CreateEnum
CREATE TYPE "RenewalFollowUpOutcome" AS ENUM ('NOT_CONTACTED', 'ATTEMPTED', 'NO_ANSWER', 'CONTACTED', 'PROMISED_PAYMENT', 'CALL_BACK');

-- CreateTable
CREATE TABLE "RenewalFollowUp" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "type" "PaymentType" NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "outcome" "RenewalFollowUpOutcome" NOT NULL DEFAULT 'NOT_CONTACTED',
    "nextFollowUpAt" TIMESTAMP(3),
    "authorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenewalFollowUp_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RenewalFollowUp_branchId_nextFollowUpAt_idx" ON "RenewalFollowUp"("branchId", "nextFollowUpAt");

-- CreateIndex
CREATE UNIQUE INDEX "RenewalFollowUp_studentId_type_periodStart_key" ON "RenewalFollowUp"("studentId", "type", "periodStart");

-- AddForeignKey
ALTER TABLE "RenewalFollowUp" ADD CONSTRAINT "RenewalFollowUp_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalFollowUp" ADD CONSTRAINT "RenewalFollowUp_studentId_branchId_fkey" FOREIGN KEY ("studentId", "branchId") REFERENCES "Student"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenewalFollowUp" ADD CONSTRAINT "RenewalFollowUp_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
