-- CreateEnum
CREATE TYPE "StaffPermissionAction" AS ENUM (
    'MANAGE_BRANCH',
    'STUDENTS',
    'SEAT_ALLOCATION',
    'VIEW_PAYMENTS',
    'GENERATE_PAYMENTS',
    'MARK_PAYMENT_PAID',
    'WAIVE_PAYMENTS',
    'ANALYTICS'
);

-- CreateTable
CREATE TABLE "StaffPermissionOverride" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "action" "StaffPermissionAction" NOT NULL,
    "allowed" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffPermissionOverride_staffId_idx" ON "StaffPermissionOverride"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPermissionOverride_staffId_action_key" ON "StaffPermissionOverride"("staffId", "action");

-- AddForeignKey
ALTER TABLE "StaffPermissionOverride" ADD CONSTRAINT "StaffPermissionOverride_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
