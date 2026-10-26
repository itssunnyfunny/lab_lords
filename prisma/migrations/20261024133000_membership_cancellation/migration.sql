-- A genuine upcoming cancellation is distinct from voiding a recording error.
-- Retain all dates, revisions and associated financial/student records.
BEGIN;
ALTER TABLE "MembershipTerm" DROP CONSTRAINT "MembershipTerm_status_check";
ALTER TABLE "MembershipTerm" ADD CONSTRAINT "MembershipTerm_status_check"
  CHECK ("status" IN ('ACTIVE', 'VOIDED', 'CANCELLED'));
ALTER TABLE "MembershipTermRevision" DROP CONSTRAINT "MembershipTermRevision_action_check";
ALTER TABLE "MembershipTermRevision" ADD CONSTRAINT "MembershipTermRevision_action_check"
  CHECK ("action" IN ('BASELINE','CREATED','CORRECTED','VOIDED','ENDED_EARLY','CANCELLED'));
COMMIT;
