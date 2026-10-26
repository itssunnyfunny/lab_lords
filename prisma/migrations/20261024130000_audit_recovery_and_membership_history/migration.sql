-- Preserve all existing allocations, terms and financial/provider records.
BEGIN;

ALTER TABLE "MembershipTerm" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "MembershipTerm" ADD CONSTRAINT "MembershipTerm_status_check" CHECK ("status" IN ('ACTIVE', 'VOIDED')),
  ADD CONSTRAINT "MembershipTerm_revision_check" CHECK ("revision" > 0);
DROP INDEX "MembershipTerm_studentId_startDate_endDate_key";
CREATE INDEX "MembershipTerm_studentId_startDate_endDate_idx" ON "MembershipTerm"("studentId", "startDate", "endDate");
CREATE UNIQUE INDEX "MembershipTerm_id_branchId_key" ON "MembershipTerm"("id", "branchId");

CREATE TABLE "MembershipTermRevision" (
  "id" TEXT NOT NULL PRIMARY KEY, "termId" TEXT NOT NULL, "branchId" TEXT NOT NULL,
  "revision" INTEGER NOT NULL, "action" TEXT NOT NULL, "actorId" TEXT,
  "reason" TEXT NOT NULL, "before" JSONB, "after" JSONB NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MembershipTermRevision_revision_check" CHECK ("revision" > 0),
  CONSTRAINT "MembershipTermRevision_action_check" CHECK ("action" IN ('BASELINE','CREATED','CORRECTED','VOIDED','ENDED_EARLY')),
  CONSTRAINT "MembershipTermRevision_termId_branchId_fkey" FOREIGN KEY ("termId","branchId") REFERENCES "MembershipTerm"("id","branchId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MembershipTermRevision_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "MembershipTermRevision_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "MembershipTermRevision_termId_revision_key" ON "MembershipTermRevision"("termId","revision");
CREATE INDEX "MembershipTermRevision_branchId_termId_idx" ON "MembershipTermRevision"("branchId","termId");
-- Known state at migration time, not a fabricated historical edit or author.
INSERT INTO "MembershipTermRevision" ("id","termId","branchId","revision","action","actorId","reason","after")
SELECT 'baseline:' || "id", "id", "branchId", 1, 'BASELINE', NULL,
 'Existing term recorded before revision history was introduced.',
 jsonb_build_object('label',"label",'startDate',"startDate",'endDate',"endDate",'status','ACTIVE') FROM "MembershipTerm";

CREATE TABLE "AllocationMoveCommand" (
  "id" TEXT NOT NULL PRIMARY KEY, "actorId" TEXT NOT NULL, "branchId" TEXT NOT NULL,
  "studentId" TEXT NOT NULL, "commandKey" TEXT NOT NULL, "requestHash" TEXT NOT NULL,
  "sourceIds" TEXT[] NOT NULL, "resultIds" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AllocationMoveCommand_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AllocationMoveCommand_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AllocationMoveCommand_studentId_branchId_fkey" FOREIGN KEY ("studentId","branchId") REFERENCES "Student"("id","branchId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "AllocationMoveCommand_actorId_branchId_commandKey_key" ON "AllocationMoveCommand"("actorId","branchId","commandKey");
CREATE INDEX "AllocationMoveCommand_branchId_studentId_idx" ON "AllocationMoveCommand"("branchId","studentId");

CREATE FUNCTION reject_audit_closeout_evidence_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Recorded recovery and membership evidence is immutable'; END; $$;
CREATE TRIGGER "MembershipTermRevision_immutable" BEFORE UPDATE OR DELETE ON "MembershipTermRevision"
  FOR EACH ROW EXECUTE FUNCTION reject_audit_closeout_evidence_change();
CREATE TRIGGER "AllocationMoveCommand_immutable" BEFORE UPDATE OR DELETE ON "AllocationMoveCommand"
  FOR EACH ROW EXECUTE FUNCTION reject_audit_closeout_evidence_change();
COMMIT;
