-- Clean catalogue cutover, intentionally fail-closed for any legacy billing evidence.
-- Never run against a populated billing ledger: see docs/billing/three-plan-cutover.md.
-- Operational data and immutable provider evidence are never deleted or rewritten.
BEGIN;
LOCK TABLE "Organization", "SaasRazorpayPlan", "RazorpayPlanProvisioning", "BillingOffer", "OrganizationSubscription", "OrganizationBillingChange", "OrganizationBillingChangeAudit", "OrganizationSubscriptionInvoice", "OrganizationSubscriptionHistory", "BillingProviderAction", "RazorpayWebhookEvent" IN ACCESS EXCLUSIVE MODE;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM "RazorpayWebhookEvent") THEN RAISE EXCEPTION 'Three-plan cutover blocked: RazorpayWebhookEvent is not empty; preserve and reconcile legacy webhook evidence before deployment'; END IF;
  IF EXISTS (SELECT 1 FROM "SaasRazorpayPlan") THEN RAISE EXCEPTION 'Three-plan cutover blocked: SaasRazorpayPlan is not empty; preserve and reconcile legacy billing evidence before deployment'; END IF;
  IF EXISTS (SELECT 1 FROM "RazorpayPlanProvisioning") THEN RAISE EXCEPTION 'Three-plan cutover blocked: RazorpayPlanProvisioning is not empty; preserve and reconcile legacy billing evidence before deployment'; END IF;
  IF EXISTS (SELECT 1 FROM "BillingOffer") THEN RAISE EXCEPTION 'Three-plan cutover blocked: BillingOffer is not empty; preserve and reconcile legacy billing evidence before deployment'; END IF;
  IF EXISTS (SELECT 1 FROM "OrganizationSubscription") THEN RAISE EXCEPTION 'Three-plan cutover blocked: OrganizationSubscription is not empty; preserve and reconcile legacy billing evidence before deployment'; END IF;
  IF EXISTS (SELECT 1 FROM "OrganizationBillingChange") THEN RAISE EXCEPTION 'Three-plan cutover blocked: OrganizationBillingChange is not empty; preserve and reconcile legacy billing evidence before deployment'; END IF;
  IF EXISTS (SELECT 1 FROM "OrganizationBillingChangeAudit") THEN RAISE EXCEPTION 'Three-plan cutover blocked: OrganizationBillingChangeAudit is not empty; preserve and reconcile legacy billing evidence before deployment'; END IF;
  IF EXISTS (SELECT 1 FROM "OrganizationSubscriptionInvoice") THEN RAISE EXCEPTION 'Three-plan cutover blocked: OrganizationSubscriptionInvoice is not empty; preserve and reconcile legacy billing evidence before deployment'; END IF;
  IF EXISTS (SELECT 1 FROM "OrganizationSubscriptionHistory") THEN RAISE EXCEPTION 'Three-plan cutover blocked: OrganizationSubscriptionHistory is not empty; preserve and reconcile legacy billing evidence before deployment'; END IF;
  IF EXISTS (SELECT 1 FROM "BillingProviderAction") THEN RAISE EXCEPTION 'Three-plan cutover blocked: BillingProviderAction is not empty; preserve and reconcile legacy billing evidence before deployment'; END IF;
  IF EXISTS (SELECT 1 FROM "Organization" WHERE "selectedPostTrialPlan"::text IN ('AGENT_CONTROL','CUSTOM')) THEN
    RAISE EXCEPTION 'Three-plan cutover blocked: obsolete selected plan requires explicit owner choice';
  END IF;
END $$;
CREATE TYPE "SaasPlan_new" AS ENUM ('BASIC','STANDARD','PRO');
-- Only non-commercial selections may exist here. Old public Standard was PRO.
ALTER TABLE "Organization" ALTER COLUMN "selectedPostTrialPlan" TYPE "SaasPlan_new" USING (CASE "selectedPostTrialPlan"::text WHEN 'PRO' THEN 'STANDARD' ELSE "selectedPostTrialPlan"::text END)::"SaasPlan_new";
ALTER TABLE "SaasRazorpayPlan" ALTER COLUMN "plan" TYPE "SaasPlan_new" USING (CASE "plan"::text WHEN 'PRO' THEN 'STANDARD' ELSE "plan"::text END)::"SaasPlan_new";
ALTER TABLE "RazorpayPlanProvisioning" ALTER COLUMN "plan" TYPE "SaasPlan_new" USING (CASE "plan"::text WHEN 'PRO' THEN 'STANDARD' ELSE "plan"::text END)::"SaasPlan_new";
ALTER TABLE "BillingOffer" ALTER COLUMN "plan" TYPE "SaasPlan_new" USING (CASE "plan"::text WHEN 'PRO' THEN 'STANDARD' ELSE "plan"::text END)::"SaasPlan_new";
ALTER TABLE "OrganizationSubscription" ALTER COLUMN "plan" TYPE "SaasPlan_new" USING (CASE "plan"::text WHEN 'PRO' THEN 'STANDARD' ELSE "plan"::text END)::"SaasPlan_new";
ALTER TABLE "OrganizationBillingChange" ALTER COLUMN "fromPlan" TYPE "SaasPlan_new" USING (CASE "fromPlan"::text WHEN 'PRO' THEN 'STANDARD' ELSE "fromPlan"::text END)::"SaasPlan_new",
  ALTER COLUMN "toPlan" TYPE "SaasPlan_new" USING (CASE "toPlan"::text WHEN 'PRO' THEN 'STANDARD' ELSE "toPlan"::text END)::"SaasPlan_new",
  ALTER COLUMN "authorizedPlan" TYPE "SaasPlan_new" USING (CASE "authorizedPlan"::text WHEN 'PRO' THEN 'STANDARD' ELSE "authorizedPlan"::text END)::"SaasPlan_new";
ALTER TABLE "OrganizationSubscriptionHistory" ALTER COLUMN "plan" TYPE "SaasPlan_new" USING (CASE "plan"::text WHEN 'PRO' THEN 'STANDARD' ELSE "plan"::text END)::"SaasPlan_new";
ALTER TYPE "SaasPlan" RENAME TO "SaasPlan_legacy";
ALTER TYPE "SaasPlan_new" RENAME TO "SaasPlan";
DROP TYPE "SaasPlan_legacy";
COMMIT;
