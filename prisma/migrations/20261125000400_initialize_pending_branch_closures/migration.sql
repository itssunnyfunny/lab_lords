BEGIN;

-- Keep an existing, provider-free closure executable after its tenant switches
-- to branch agreements. Its original receipt and financial history stay intact.
CREATE OR REPLACE FUNCTION initialize_branch_closures(target_organization text)
RETURNS TABLE (closures_initialized bigint, closures_needing_review bigint)
LANGUAGE plpgsql AS $$
DECLARE
    candidate record;
    next_sequence integer;
BEGIN
    PERFORM 1 FROM "Organization" WHERE id = target_organization FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Organization not found'; END IF;
    closures_initialized := 0;
    closures_needing_review := 0;
    FOR candidate IN
        SELECT b.id AS branch, old.* FROM "Branch" b
        JOIN "BranchBillingAgreement" a ON a."branchId" = b.id AND a."organizationId" = b."organizationId"
        LEFT JOIN LATERAL (
            SELECT c.* FROM "OrganizationBillingChange" c
            WHERE c."organizationId" = b."organizationId" AND c."branchId" = b.id
              AND c."agreementBranchId" IS NULL AND c.type = 'BRANCH_REMOVAL'
            ORDER BY c.sequence DESC LIMIT 1
        ) old ON true
        WHERE b."organizationId" = target_organization AND b."billingStatus" = 'REMOVAL_SCHEDULED'
          AND NOT EXISTS (SELECT 1 FROM "OrganizationBillingChange" c
              WHERE c."agreementBranchId" = b.id AND c.type = 'BRANCH_REMOVAL')
        ORDER BY b.id FOR UPDATE OF a, b
    LOOP
        IF candidate.id IS NULL OR candidate.status <> 'SCHEDULED' OR candidate."operationStatus" <> 'SCHEDULED'
            OR candidate."effectiveAt" IS NULL
            OR candidate."organizationSubscriptionId" IS NOT NULL OR candidate."replacementSubscriptionId" IS NOT NULL
            OR candidate."commercialIntentVersion" IS NOT NULL OR candidate."provisioningIntentVersion" IS NOT NULL
            OR candidate."providerMutationAdmittedAt" IS NOT NULL OR candidate."authorizedProviderMode" IS NOT NULL
            OR candidate."providerConfirmedAt" IS NOT NULL OR candidate."failureCategory" IS NOT NULL
            OR EXISTS (SELECT 1 FROM "BillingProviderAction" act WHERE act."changeId" = candidate.id)
            OR EXISTS (SELECT 1 FROM "OrganizationSubscription" sub WHERE sub."organizationId" = target_organization
                AND (sub."agreementBranchId" IS NULL OR sub."agreementBranchId" = candidate.branch)
                AND sub.status NOT IN ('CANCELLED', 'COMPLETED', 'EXPIRED')) THEN
            closures_needing_review := closures_needing_review + 1;
            CONTINUE;
        END IF;
        UPDATE "BranchBillingAgreement" SET "billingMutationSequence" = "billingMutationSequence" + 1
            WHERE "organizationId" = target_organization AND "branchId" = candidate.branch
            RETURNING "billingMutationSequence" INTO STRICT next_sequence;
        INSERT INTO "OrganizationBillingChange" (id, "organizationId", "agreementBranchId", "branchId",
            sequence, "idempotencyKey", type, status, "operationStatus", "effectiveAt", "undoCutoffAt",
            "createdByUserId", "updatedAt")
        VALUES (gen_random_uuid()::text, target_organization, candidate.branch, candidate.branch, next_sequence,
            'initialized-branch-closure:' || candidate.id, 'BRANCH_REMOVAL', 'SCHEDULED', 'SCHEDULED',
            candidate."effectiveAt", COALESCE(candidate."undoCutoffAt", candidate."effectiveAt"),
            candidate."createdByUserId", CURRENT_TIMESTAMP);
        closures_initialized := closures_initialized + 1;
    END LOOP;
    RETURN NEXT;
END;
$$;

DO $$
DECLARE
    totals record;
BEGIN
    SELECT sum(i.closures_initialized) AS initialized, sum(i.closures_needing_review) AS review
        INTO totals FROM (SELECT DISTINCT "organizationId" FROM "Branch"
            WHERE "billingStatus" = 'REMOVAL_SCHEDULED') o
        CROSS JOIN LATERAL initialize_branch_closures(o."organizationId") i;
    RAISE NOTICE 'Branch closures initialized: %, unresolved historical closures: %',
        COALESCE(totals.initialized, 0), COALESCE(totals.review, 0);
END;
$$;
COMMIT;
