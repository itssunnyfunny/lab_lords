-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'NOT_MARKED');

-- CreateEnum
CREATE TYPE "AttendanceSource" AS ENUM ('MANUAL', 'QR');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE 'ATTENDANCE_CHANGED';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "studentId" TEXT,
ALTER COLUMN "paymentId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "AttendanceMark" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "note" TEXT,
    "actorId" TEXT NOT NULL,
    "source" "AttendanceSource" NOT NULL DEFAULT 'MANUAL',
    "version" INTEGER NOT NULL DEFAULT 1,
    "correctedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceMark_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceVisit" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "timezone" TEXT NOT NULL,
    "checkIn" TIMESTAMP(3) NOT NULL,
    "checkOut" TIMESTAMP(3),
    "source" "AttendanceSource" NOT NULL,
    "note" TEXT,
    "actorId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "correctedAt" TIMESTAMP(3),
    "voidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCredential" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceCommand" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AttendanceMark_branchId_date_status_idx" ON "AttendanceMark"("branchId", "date", "status");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceMark_branchId_studentId_date_key" ON "AttendanceMark"("branchId", "studentId", "date");

-- CreateIndex
CREATE INDEX "AttendanceVisit_branchId_date_studentId_idx" ON "AttendanceVisit"("branchId", "date", "studentId");

-- CreateIndex
CREATE INDEX "AttendanceVisit_branchId_studentId_checkIn_idx" ON "AttendanceVisit"("branchId", "studentId", "checkIn");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCredential_studentId_key" ON "AttendanceCredential"("studentId");

-- CreateIndex
CREATE INDEX "AttendanceCredential_branchId_idx" ON "AttendanceCredential"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCredential_studentId_branchId_key" ON "AttendanceCredential"("studentId", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceCommand_branchId_key_key" ON "AttendanceCommand"("branchId", "key");

-- CreateIndex
CREATE INDEX "AuditLog_branchId_studentId_createdAt_idx" ON "AuditLog"("branchId", "studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_studentId_branchId_fkey" FOREIGN KEY ("studentId", "branchId") REFERENCES "Student"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMark" ADD CONSTRAINT "AttendanceMark_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMark" ADD CONSTRAINT "AttendanceMark_studentId_branchId_fkey" FOREIGN KEY ("studentId", "branchId") REFERENCES "Student"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceMark" ADD CONSTRAINT "AttendanceMark_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceVisit" ADD CONSTRAINT "AttendanceVisit_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceVisit" ADD CONSTRAINT "AttendanceVisit_studentId_branchId_fkey" FOREIGN KEY ("studentId", "branchId") REFERENCES "Student"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceVisit" ADD CONSTRAINT "AttendanceVisit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCredential" ADD CONSTRAINT "AttendanceCredential_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCredential" ADD CONSTRAINT "AttendanceCredential_studentId_branchId_fkey" FOREIGN KEY ("studentId", "branchId") REFERENCES "Student"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCommand" ADD CONSTRAINT "AttendanceCommand_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceCommand" ADD CONSTRAINT "AttendanceCommand_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Retry receipts and all attendance tables start empty; no business-data backfill.
CREATE UNIQUE INDEX "AttendanceVisit_one_open_per_student"
  ON "AttendanceVisit" ("branchId", "studentId")
  WHERE "checkOut" IS NULL AND "voidedAt" IS NULL;
ALTER TABLE "AttendanceVisit" ADD CONSTRAINT "AttendanceVisit_ordered_times"
  CHECK ("checkOut" IS NULL OR "checkOut" >= "checkIn");
ALTER TABLE "AttendanceVisit" ADD CONSTRAINT "AttendanceVisit_positive_version" CHECK ("version" > 0);
ALTER TABLE "AttendanceMark" ADD CONSTRAINT "AttendanceMark_positive_version" CHECK ("version" > 0);

-- Keep the existing payment-audit requirement despite the new nullable FK.
-- Compare text so this migration need not use an uncommitted new enum value.
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_exact_domain_target" CHECK (
  ("action"::text = 'ATTENDANCE_CHANGED' AND "studentId" IS NOT NULL AND "paymentId" IS NULL)
  OR ("action"::text <> 'ATTENDANCE_CHANGED' AND "paymentId" IS NOT NULL AND "studentId" IS NULL)
);
CREATE FUNCTION attendance_evidence_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Attendance evidence is immutable';
END;
$$;
CREATE TRIGGER attendance_command_immutable BEFORE UPDATE OR DELETE ON "AttendanceCommand"
  FOR EACH ROW EXECUTE FUNCTION attendance_evidence_immutable();
CREATE TRIGGER attendance_audit_immutable BEFORE UPDATE OR DELETE ON "AuditLog"
  FOR EACH ROW WHEN (OLD."action"::text = 'ATTENDANCE_CHANGED') EXECUTE FUNCTION attendance_evidence_immutable();
