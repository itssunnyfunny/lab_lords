BEGIN;
-- AlterEnum
ALTER TYPE "BillingModelVersion" ADD VALUE 'BRANCH_V3';

-- DropIndex
DROP INDEX "OrganizationBillingChange_organizationId_sequence_key";

-- AlterTable
ALTER TABLE "OrganizationSubscription" ADD COLUMN     "agreementBranchId" TEXT,
ADD COLUMN     "currentAgreementBranchId" TEXT,
ADD COLUMN     "pendingAgreementBranchId" TEXT;

-- AlterTable
ALTER TABLE "OrganizationBillingChange" ADD COLUMN     "agreementBranchId" TEXT;

-- AlterTable
ALTER TABLE "OrganizationBillingChangeAudit" ADD COLUMN     "agreementBranchId" TEXT;

-- AlterTable
ALTER TABLE "OrganizationSubscriptionInvoice" ADD COLUMN     "agreementBranchId" TEXT;

-- AlterTable
ALTER TABLE "OrganizationSubscriptionHistory" ADD COLUMN     "agreementBranchId" TEXT;

-- AlterTable
ALTER TABLE "RazorpayWebhookEvent" ADD COLUMN     "agreementBranchId" TEXT;

-- AlterTable
ALTER TABLE "BillingProviderAction" ADD COLUMN     "agreementBranchId" TEXT;

-- CreateTable
CREATE TABLE "BranchBillingAgreement" (
    "branchId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "selectedPlan" "SaasPlan" NOT NULL,
    "whatsAppEligibleSince" TIMESTAMP(3),
    "billingMutationSequence" INTEGER NOT NULL DEFAULT 0,
    "billingMutationLeaseToken" TEXT,
    "billingMutationLeaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BranchBillingAgreement_pkey" PRIMARY KEY ("branchId")
);

-- CreateIndex
CREATE INDEX "BranchBillingAgreement_organizationId_idx" ON "BranchBillingAgreement"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "BranchBillingAgreement_branchId_organizationId_key" ON "BranchBillingAgreement"("branchId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSubscription_currentAgreementBranchId_key" ON "OrganizationSubscription"("currentAgreementBranchId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationSubscription_pendingAgreementBranchId_key" ON "OrganizationSubscription"("pendingAgreementBranchId");

-- CreateIndex
CREATE INDEX "OrganizationSubscription_agreementBranchId_idx" ON "OrganizationSubscription"("agreementBranchId");

-- CreateIndex
CREATE INDEX "OrganizationBillingChange_agreementBranchId_idx" ON "OrganizationBillingChange"("agreementBranchId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationBillingChange_agreementBranchId_sequence_key" ON "OrganizationBillingChange"("agreementBranchId", "sequence");

-- CreateIndex
CREATE INDEX "OrganizationBillingChangeAudit_agreementBranchId_idx" ON "OrganizationBillingChangeAudit"("agreementBranchId");

-- CreateIndex
CREATE INDEX "OrganizationSubscriptionInvoice_agreementBranchId_idx" ON "OrganizationSubscriptionInvoice"("agreementBranchId");

-- CreateIndex
CREATE INDEX "OrganizationSubscriptionHistory_agreementBranchId_idx" ON "OrganizationSubscriptionHistory"("agreementBranchId");

-- CreateIndex
CREATE INDEX "RazorpayWebhookEvent_agreementBranchId_idx" ON "RazorpayWebhookEvent"("agreementBranchId");

-- CreateIndex
CREATE INDEX "BillingProviderAction_agreementBranchId_idx" ON "BillingProviderAction"("agreementBranchId");

-- AddForeignKey
ALTER TABLE "BranchBillingAgreement" ADD CONSTRAINT "BranchBillingAgreement_branchId_organizationId_fkey" FOREIGN KEY ("branchId", "organizationId") REFERENCES "Branch"("id", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_agreementBranchId_organizationId_fkey" FOREIGN KEY ("agreementBranchId", "organizationId") REFERENCES "BranchBillingAgreement"("branchId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_currentAgreementBranchId_fkey" FOREIGN KEY ("currentAgreementBranchId") REFERENCES "BranchBillingAgreement"("branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "OrganizationSubscription_pendingAgreementBranchId_fkey" FOREIGN KEY ("pendingAgreementBranchId") REFERENCES "BranchBillingAgreement"("branchId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationBillingChange" ADD CONSTRAINT "OrganizationBillingChange_agreementBranchId_organizationId_fkey" FOREIGN KEY ("agreementBranchId", "organizationId") REFERENCES "BranchBillingAgreement"("branchId", "organizationId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep the historical FIFO invariant for rows with no independent agreement.
CREATE UNIQUE INDEX "BillingChange_aggregate_sequence_key"
  ON "OrganizationBillingChange" ("organizationId", "sequence") WHERE "agreementBranchId" IS NULL;

ALTER TABLE "OrganizationSubscription" ADD CONSTRAINT "BillingAgreement_subscription_slots" CHECK (
  ("currentAgreementBranchId" IS NULL OR "currentAgreementBranchId" IS NOT DISTINCT FROM "agreementBranchId")
  AND ("pendingAgreementBranchId" IS NULL OR "pendingAgreementBranchId" IS NOT DISTINCT FROM "agreementBranchId")
  AND ("currentAgreementBranchId" IS NULL OR "pendingAgreementBranchId" IS NULL)
  AND ("agreementBranchId" IS NULL OR ("currentOrganizationId" IS NULL AND "pendingReplacementOrganizationId" IS NULL AND "quantity" = 1))
);
ALTER TABLE "OrganizationBillingChange" ADD CONSTRAINT "BillingAgreement_change_branch" CHECK (
  "agreementBranchId" IS NULL OR ("branchId" IS NULL OR "branchId" = "agreementBranchId")
);

-- Existing composite FKs protect tenant identity. This additional check also
-- distinguishes two agreements in one tenant and distinguishes NULL aggregate
-- ownership from a branch agreement. Ledger scope is immutable once attached.
CREATE FUNCTION billing_check_agreement_references() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  i integer := 0;
  target_id text;
  target_branch text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD."agreementBranchId" IS DISTINCT FROM NEW."agreementBranchId" THEN
    IF TG_TABLE_NAME <> 'RazorpayWebhookEvent' OR OLD."organizationSubscriptionId" IS NOT NULL THEN
      RAISE EXCEPTION 'Billing agreement ownership is immutable' USING ERRCODE='23514';
    END IF;
  END IF;
  WHILE i < TG_NARGS LOOP
    target_id := to_jsonb(NEW) ->> TG_ARGV[i];
    IF target_id IS NOT NULL THEN
      EXECUTE format('SELECT "agreementBranchId" FROM %I WHERE id = $1 AND "organizationId" = $2', TG_ARGV[i+1])
        INTO target_branch USING target_id, NEW."organizationId";
      IF target_branch IS DISTINCT FROM NEW."agreementBranchId" THEN
        RAISE EXCEPTION 'Billing agreement reference mismatch' USING ERRCODE='23503';
      END IF;
    END IF;
    i := i + 2;
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER "billing_agreement_refs" BEFORE INSERT OR UPDATE OF "organizationId", "agreementBranchId", "replacesSubscriptionId", "confirmedCommercialIntentChangeId" ON "OrganizationSubscription"
  FOR EACH ROW EXECUTE FUNCTION billing_check_agreement_references('replacesSubscriptionId', 'OrganizationSubscription', 'confirmedCommercialIntentChangeId', 'OrganizationBillingChange');
CREATE TRIGGER "billing_agreement_refs" BEFORE INSERT OR UPDATE OF "organizationId", "agreementBranchId", "organizationSubscriptionId", "replacementSubscriptionId" ON "OrganizationBillingChange"
  FOR EACH ROW EXECUTE FUNCTION billing_check_agreement_references('organizationSubscriptionId', 'OrganizationSubscription', 'replacementSubscriptionId', 'OrganizationSubscription');
CREATE TRIGGER "billing_agreement_refs" BEFORE INSERT OR UPDATE OF "organizationId", "agreementBranchId", "organizationSubscriptionId", "commercialIntentChangeId" ON "OrganizationSubscriptionInvoice"
  FOR EACH ROW EXECUTE FUNCTION billing_check_agreement_references('organizationSubscriptionId', 'OrganizationSubscription', 'commercialIntentChangeId', 'OrganizationBillingChange');
CREATE TRIGGER "billing_agreement_refs" BEFORE INSERT OR UPDATE OF "organizationId", "agreementBranchId", "organizationSubscriptionId" ON "OrganizationSubscriptionHistory"
  FOR EACH ROW EXECUTE FUNCTION billing_check_agreement_references('organizationSubscriptionId', 'OrganizationSubscription');
CREATE TRIGGER "billing_agreement_refs" BEFORE INSERT OR UPDATE OF "organizationId", "agreementBranchId", "changeId" ON "OrganizationBillingChangeAudit"
  FOR EACH ROW EXECUTE FUNCTION billing_check_agreement_references('changeId', 'OrganizationBillingChange');
CREATE TRIGGER "billing_agreement_refs" BEFORE INSERT OR UPDATE OF "organizationId", "agreementBranchId", "changeId" ON "BillingProviderAction"
  FOR EACH ROW EXECUTE FUNCTION billing_check_agreement_references('changeId', 'OrganizationBillingChange');
CREATE TRIGGER "billing_agreement_refs" BEFORE INSERT OR UPDATE OF "organizationId", "agreementBranchId", "organizationSubscriptionId" ON "RazorpayWebhookEvent"
  FOR EACH ROW EXECUTE FUNCTION billing_check_agreement_references('organizationSubscriptionId', 'OrganizationSubscription');
COMMIT;
