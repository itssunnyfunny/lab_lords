-- Existing students retain their original billing anchor and imported billing cutoff.
ALTER TABLE "Student" ADD COLUMN "rejoinedOn" DATE;

CREATE TABLE "StudentEnrollmentHistory" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL,
    "endedAt" TIMESTAMP(3),
    "billingStartAt" TIMESTAMP(3),
    CONSTRAINT "StudentEnrollmentHistory_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudentEnrollmentHistory_studentId_branchId_fkey"
        FOREIGN KEY ("studentId", "branchId") REFERENCES "Student"("id", "branchId")
        ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "StudentEnrollmentHistory_studentId_branchId_endedAt_idx"
    ON "StudentEnrollmentHistory"("studentId", "branchId", "endedAt");
