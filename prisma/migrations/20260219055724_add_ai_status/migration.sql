-- CreateEnum
CREATE TYPE "BranchAIStatus" AS ENUM ('IDLE', 'RUNNING');

-- AlterTable
ALTER TABLE "Branch" ADD COLUMN     "aiLastCalledAt" TIMESTAMP(3),
ADD COLUMN     "aiStatus" "BranchAIStatus" NOT NULL DEFAULT 'IDLE';
