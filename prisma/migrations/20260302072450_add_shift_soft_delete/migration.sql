-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "status" "ShiftStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "Shift_branchId_status_idx" ON "Shift"("branchId", "status");
