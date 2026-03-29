-- DropIndex
DROP INDEX "Shift_branchId_name_key";

-- AlterTable
ALTER TABLE "SeatAllocation" ADD COLUMN     "multiShiftId" TEXT;

-- CreateTable
CREATE TABLE "MultiShift" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MultiShift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MultiShiftComponent" (
    "id" TEXT NOT NULL,
    "multiShiftId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "MultiShiftComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MultiShift_branchId_idx" ON "MultiShift"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "MultiShift_branchId_name_key" ON "MultiShift"("branchId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "MultiShiftComponent_multiShiftId_shiftId_key" ON "MultiShiftComponent"("multiShiftId", "shiftId");

-- CreateIndex
CREATE INDEX "SeatAllocation_multiShiftId_idx" ON "SeatAllocation"("multiShiftId");

-- AddForeignKey
ALTER TABLE "MultiShift" ADD CONSTRAINT "MultiShift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiShiftComponent" ADD CONSTRAINT "MultiShiftComponent_multiShiftId_fkey" FOREIGN KEY ("multiShiftId") REFERENCES "MultiShift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MultiShiftComponent" ADD CONSTRAINT "MultiShiftComponent_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SeatAllocation" ADD CONSTRAINT "SeatAllocation_multiShiftId_fkey" FOREIGN KEY ("multiShiftId") REFERENCES "MultiShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
