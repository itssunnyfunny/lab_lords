-- AlterTable
ALTER TABLE "Student"
ADD COLUMN     "feeLinkedShiftId" TEXT,
ADD COLUMN     "feeLinkedMultiShiftId" TEXT;

-- CreateIndex
CREATE INDEX "Student_feeLinkedShiftId_idx" ON "Student"("feeLinkedShiftId");

-- CreateIndex
CREATE INDEX "Student_feeLinkedMultiShiftId_idx" ON "Student"("feeLinkedMultiShiftId");
