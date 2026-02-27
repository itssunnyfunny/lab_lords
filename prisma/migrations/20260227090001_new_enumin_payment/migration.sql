/*
  Warnings:

  - Added the required column `updatedAt` to the `Student` table without a default value. This is not possible if the table is not empty.

*/
-- AlterEnum
ALTER TYPE "PaymentStatus" ADD VALUE 'WAIVED';

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
