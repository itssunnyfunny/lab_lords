BEGIN;
ALTER TABLE "BranchBillingAgreement"
  ADD COLUMN "legacyCoverageSubscriptionId" TEXT,
  ADD COLUMN "legacyCoverageEndsAt" TIMESTAMP(3),
  ADD CONSTRAINT "BranchBillingAgreement_legacy_coverage_pair" CHECK (
    ("legacyCoverageSubscriptionId" IS NULL) = ("legacyCoverageEndsAt" IS NULL)
  ),
  ADD CONSTRAINT "BranchBillingAgreement_legacyCoverageSubscriptionId_organiz_fkey"
    FOREIGN KEY ("legacyCoverageSubscriptionId", "organizationId") REFERENCES "OrganizationSubscription"("id","organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION billing_check_carried_coverage() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF (NEW."legacyCoverageSubscriptionId", NEW."legacyCoverageEndsAt") IS DISTINCT FROM
       (OLD."legacyCoverageSubscriptionId", OLD."legacyCoverageEndsAt") THEN
      RAISE EXCEPTION 'Original agreement coverage is immutable';
    END IF;
  END IF;
  IF NEW."legacyCoverageSubscriptionId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "OrganizationSubscription" s WHERE s.id = NEW."legacyCoverageSubscriptionId"
      AND s."organizationId" = NEW."organizationId" AND s."agreementBranchId" IS NULL
      AND s.status IN ('CANCELLED','COMPLETED','EXPIRED') AND s."paidThrough" = NEW."legacyCoverageEndsAt"
  ) THEN RAISE EXCEPTION 'Invalid aggregate coverage source'; END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "billing_carried_coverage" BEFORE INSERT OR UPDATE OF "legacyCoverageSubscriptionId","legacyCoverageEndsAt"
ON "BranchBillingAgreement" FOR EACH ROW EXECUTE FUNCTION billing_check_carried_coverage();
COMMIT;
