-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "city" TEXT,
ADD COLUMN     "defaultFee" INTEGER DEFAULT 0;

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "businessType" TEXT;

-- AlterTable
ALTER TABLE "Shift" ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 0;
