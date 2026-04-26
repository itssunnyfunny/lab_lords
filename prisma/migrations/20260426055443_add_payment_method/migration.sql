-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'UPI', 'BANK_TRANSFER');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "paymentMethod" "PaymentMethod",
ADD COLUMN     "referenceId" TEXT;
