-- AlterTable
ALTER TABLE "RenewalFollowUp" ADD COLUMN     "completedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "DashboardSettings" (
    "branchId" TEXT NOT NULL,
    "utilizationThreshold" INTEGER NOT NULL DEFAULT 35,

    CONSTRAINT "DashboardSettings_pkey" PRIMARY KEY ("branchId")
);

-- CreateTable
CREATE TABLE "AttendanceExpectation" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "weekdays" INTEGER[],
    "expectedBy" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceExpectation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MembershipTerm" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MembershipTerm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OccupancySnapshot" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "timezone" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "shiftName" TEXT NOT NULL,
    "startTime" TEXT,
    "endTime" TEXT,
    "capacity" INTEGER NOT NULL,
    "occupied" INTEGER NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OccupancySnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardTask" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueAt" TIMESTAMP(3),
    "assigneeId" TEXT,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardNotificationState" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "snoozedUntil" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardNotificationState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DashboardEvent" (
    "id" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "detail" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DashboardEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceExpectation_studentId_key" ON "AttendanceExpectation"("studentId");

-- CreateIndex
CREATE INDEX "AttendanceExpectation_branchId_enabled_idx" ON "AttendanceExpectation"("branchId", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceExpectation_studentId_branchId_key" ON "AttendanceExpectation"("studentId", "branchId");

-- CreateIndex
CREATE INDEX "MembershipTerm_branchId_endDate_idx" ON "MembershipTerm"("branchId", "endDate");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipTerm_studentId_startDate_endDate_key" ON "MembershipTerm"("studentId", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "OccupancySnapshot_branchId_recordedAt_idx" ON "OccupancySnapshot"("branchId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "OccupancySnapshot_branchId_date_shiftId_key" ON "OccupancySnapshot"("branchId", "date", "shiftId");

-- CreateIndex
CREATE INDEX "DashboardTask_branchId_status_dueAt_idx" ON "DashboardTask"("branchId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "DashboardNotificationState_branchId_userId_idx" ON "DashboardNotificationState"("branchId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardNotificationState_userId_branchId_key_key" ON "DashboardNotificationState"("userId", "branchId", "key");

-- CreateIndex
CREATE INDEX "DashboardEvent_branchId_occurredAt_idx" ON "DashboardEvent"("branchId", "occurredAt");

-- AddForeignKey
ALTER TABLE "DashboardSettings" ADD CONSTRAINT "DashboardSettings_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceExpectation" ADD CONSTRAINT "AttendanceExpectation_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceExpectation" ADD CONSTRAINT "AttendanceExpectation_studentId_branchId_fkey" FOREIGN KEY ("studentId", "branchId") REFERENCES "Student"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipTerm" ADD CONSTRAINT "MembershipTerm_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipTerm" ADD CONSTRAINT "MembershipTerm_studentId_branchId_fkey" FOREIGN KEY ("studentId", "branchId") REFERENCES "Student"("id", "branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OccupancySnapshot" ADD CONSTRAINT "OccupancySnapshot_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardTask" ADD CONSTRAINT "DashboardTask_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardTask" ADD CONSTRAINT "DashboardTask_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardTask" ADD CONSTRAINT "DashboardTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardNotificationState" ADD CONSTRAINT "DashboardNotificationState_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardNotificationState" ADD CONSTRAINT "DashboardNotificationState_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardEvent" ADD CONSTRAINT "DashboardEvent_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DashboardEvent" ADD CONSTRAINT "DashboardEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Conservative defaults, no inferred schedules, terms, history or payment changes.
ALTER TABLE "DashboardSettings" ADD CONSTRAINT "DashboardSettings_threshold_check" CHECK ("utilizationThreshold" BETWEEN 1 AND 100);
ALTER TABLE "AttendanceExpectation" ADD CONSTRAINT "AttendanceExpectation_schedule_check"
    CHECK (cardinality(weekdays) BETWEEN 1 AND 7 AND weekdays <@ ARRAY[0,1,2,3,4,5,6] AND "expectedBy" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "MembershipTerm" ADD CONSTRAINT "MembershipTerm_dates_check"
    CHECK ("startDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND "endDate" ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' AND "endDate" >= "startDate");
ALTER TABLE "OccupancySnapshot" ADD CONSTRAINT "OccupancySnapshot_counts_check" CHECK (capacity >= 0 AND occupied >= 0 AND occupied <= capacity);
ALTER TABLE "DashboardTask" ADD CONSTRAINT "DashboardTask_status_check" CHECK (status IN ('OPEN', 'DONE'));
CREATE FUNCTION "dashboard_evidence_immutable"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Recorded dashboard evidence is immutable'; END;
$$;
CREATE TRIGGER "DashboardEvent_immutable" BEFORE UPDATE OR DELETE ON "DashboardEvent" FOR EACH ROW EXECUTE FUNCTION "dashboard_evidence_immutable"();
CREATE TRIGGER "OccupancySnapshot_immutable" BEFORE UPDATE OR DELETE ON "OccupancySnapshot" FOR EACH ROW EXECUTE FUNCTION "dashboard_evidence_immutable"();
