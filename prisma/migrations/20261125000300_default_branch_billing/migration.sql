BEGIN;

ALTER TABLE "Organization" ALTER COLUMN "billingModelVersion" SET DEFAULT 'BRANCH_V3';

-- The organization lock is also used by add-branch and trial claim. Existing
-- agreements retain their choices, evidence, sequences and positions on rerun.
CREATE OR REPLACE FUNCTION initialize_branch_billing(target_organization text)
RETURNS TABLE (branches_seen bigint, agreements_created bigint, organizations_updated bigint)
LANGUAGE plpgsql AS $$
DECLARE
    preference "SaasPlan";
BEGIN
    SELECT COALESCE(o."selectedPostTrialPlan", 'BASIC'::"SaasPlan") INTO STRICT preference
      FROM "Organization" o WHERE o.id = target_organization FOR UPDATE;

    INSERT INTO "BranchBillingAgreement" ("organizationId", "branchId", "selectedPlan")
      SELECT b."organizationId", b.id, preference
        FROM "Branch" b WHERE b."organizationId" = target_organization
      ON CONFLICT ("branchId") DO NOTHING;
    GET DIAGNOSTICS agreements_created = ROW_COUNT;

    SELECT count(*) INTO branches_seen FROM "Branch" WHERE "organizationId" = target_organization;
    IF branches_seen <> (SELECT count(*) FROM "BranchBillingAgreement" WHERE "organizationId" = target_organization) THEN
        RAISE EXCEPTION 'Branch agreement initialization count mismatch';
    END IF;
    UPDATE "Organization" SET "billingModelVersion" = 'BRANCH_V3'
      WHERE id = target_organization AND "billingModelVersion" <> 'BRANCH_V3';
    GET DIAGNOSTICS organizations_updated = ROW_COUNT;
    RETURN NEXT;
END;
$$;

DO $$
DECLARE
    counts record;
BEGIN
    SELECT COALESCE(sum(i.branches_seen), 0) AS branches_seen,
           COALESCE(sum(i.agreements_created), 0) AS agreements_created,
           COALESCE(sum(i.organizations_updated), 0) AS organizations_updated
      INTO counts
      FROM "Organization" o CROSS JOIN LATERAL initialize_branch_billing(o.id) i;
    RAISE NOTICE 'Branch billing initialization: % branches, % agreements created, % organizations updated',
      counts.branches_seen, counts.agreements_created, counts.organizations_updated;
END;
$$;

COMMIT;
