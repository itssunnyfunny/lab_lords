-- Operator-only read-only inventory. No environment loading or provider writes.
-- Run on an approved snapshot first; this task never accesses Production.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT current_database() AS database_name;
SELECT 'SaasRazorpayPlan' AS relation, count(*) AS rows FROM "SaasRazorpayPlan";
SELECT 'SaasRazorpayPlan' AS relation, id AS affected_id FROM "SaasRazorpayPlan" ORDER BY id;
SELECT 'RazorpayPlanProvisioning' AS relation, count(*) AS rows FROM "RazorpayPlanProvisioning";
SELECT 'RazorpayPlanProvisioning' AS relation, id AS affected_id FROM "RazorpayPlanProvisioning" ORDER BY id;
SELECT 'BillingOffer' AS relation, count(*) AS rows FROM "BillingOffer";
SELECT 'BillingOffer' AS relation, id AS affected_id FROM "BillingOffer" ORDER BY id;
SELECT 'OrganizationSubscription' AS relation, count(*) AS rows FROM "OrganizationSubscription";
SELECT 'OrganizationSubscription' AS relation, id AS affected_id FROM "OrganizationSubscription" ORDER BY id;
SELECT 'OrganizationBillingChange' AS relation, count(*) AS rows FROM "OrganizationBillingChange";
SELECT 'OrganizationBillingChange' AS relation, id AS affected_id FROM "OrganizationBillingChange" ORDER BY id;
SELECT 'OrganizationBillingChangeAudit' AS relation, count(*) AS rows FROM "OrganizationBillingChangeAudit";
SELECT 'OrganizationBillingChangeAudit' AS relation, id AS affected_id FROM "OrganizationBillingChangeAudit" ORDER BY id;
SELECT 'OrganizationSubscriptionInvoice' AS relation, count(*) AS rows FROM "OrganizationSubscriptionInvoice";
SELECT 'OrganizationSubscriptionInvoice' AS relation, id AS affected_id FROM "OrganizationSubscriptionInvoice" ORDER BY id;
SELECT 'OrganizationSubscriptionHistory' AS relation, count(*) AS rows FROM "OrganizationSubscriptionHistory";
SELECT 'OrganizationSubscriptionHistory' AS relation, id AS affected_id FROM "OrganizationSubscriptionHistory" ORDER BY id;
SELECT 'BillingProviderAction' AS relation, count(*) AS rows FROM "BillingProviderAction";
SELECT 'BillingProviderAction' AS relation, id AS affected_id FROM "BillingProviderAction" ORDER BY id;
SELECT id AS organization_id, "selectedPostTrialPlan"::text AS previous_selection
FROM "Organization" WHERE "selectedPostTrialPlan" IS NOT NULL ORDER BY id;
SELECT "providerMode", status, count(*) AS subscriptions FROM "OrganizationSubscription" GROUP BY 1,2 ORDER BY 1,2;
SELECT "providerMode", status, count(*) AS actions FROM "BillingProviderAction" GROUP BY 1,2 ORDER BY 1,2;
SELECT 'RazorpayWebhookEvent' AS relation, count(*) AS rows FROM "RazorpayWebhookEvent";
SELECT 'RazorpayWebhookEvent' AS relation, id AS affected_id FROM "RazorpayWebhookEvent" ORDER BY id;
COMMIT;
