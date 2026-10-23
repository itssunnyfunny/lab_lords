-- Operator-only read-only inventory. No environment loading or provider writes.
-- Run on an approved snapshot first; this task never accesses Production.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
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
-- Aggregate prerequisite evidence only: never authorizes migration or provider writes.
WITH ledger AS (
  SELECT 'SaasRazorpayPlan' AS relation, count(*) AS rows FROM "SaasRazorpayPlan"
  UNION ALL
  SELECT 'RazorpayPlanProvisioning' AS relation, count(*) AS rows FROM "RazorpayPlanProvisioning"
  UNION ALL
  SELECT 'BillingOffer' AS relation, count(*) AS rows FROM "BillingOffer"
  UNION ALL
  SELECT 'OrganizationSubscription' AS relation, count(*) AS rows FROM "OrganizationSubscription"
  UNION ALL
  SELECT 'OrganizationBillingChange' AS relation, count(*) AS rows FROM "OrganizationBillingChange"
  UNION ALL
  SELECT 'OrganizationBillingChangeAudit' AS relation, count(*) AS rows FROM "OrganizationBillingChangeAudit"
  UNION ALL
  SELECT 'OrganizationSubscriptionInvoice' AS relation, count(*) AS rows FROM "OrganizationSubscriptionInvoice"
  UNION ALL
  SELECT 'OrganizationSubscriptionHistory' AS relation, count(*) AS rows FROM "OrganizationSubscriptionHistory"
  UNION ALL
  SELECT 'BillingProviderAction' AS relation, count(*) AS rows FROM "BillingProviderAction"
  UNION ALL
  SELECT 'RazorpayWebhookEvent' AS relation, count(*) AS rows FROM "RazorpayWebhookEvent"
), labels AS (
  SELECT array_agg(enumlabel::text ORDER BY enumlabel::text) AS names
  FROM pg_enum WHERE enumtypid='"SaasPlan"'::regtype
), selections AS (
  SELECT count(*) FILTER (WHERE "selectedPostTrialPlan"::text IN ('AGENT_CONTROL','CUSTOM')) AS obsolete,
         count(*) FILTER (WHERE "selectedPostTrialPlan"::text = 'PRO') AS old_pro_selections
  FROM "Organization"
), migrations AS (
  SELECT count(*) FILTER (WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished
  FROM "_prisma_migrations"
)
SELECT jsonb_build_object(
  'schemaVersion', 1,
  'snapshotAt', transaction_timestamp(),
  'database', current_database(),
  'readOnly', current_setting('transaction_read_only'),
  'isolation', current_setting('transaction_isolation'),
  'enumLabels', labels.names,
  'ledgerCounts', (SELECT jsonb_object_agg(relation, rows) FROM ledger),
  'obsoleteSelections', selections.obsolete,
  'oldProSelections', selections.old_pro_selections,
  'unfinishedMigrations', migrations.unfinished,
  'operationalCounts', jsonb_build_object(
    'users', (SELECT count(*) FROM "User"),
    'organizations', (SELECT count(*) FROM "Organization"),
    'branches', (SELECT count(*) FROM "Branch"),
    'students', (SELECT count(*) FROM "Student"),
    'payments', (SELECT count(*) FROM "Payment"),
    'ownerTrialGrants', (SELECT count(*) FROM "OwnerTrialGrant")
  ),
  'catalogueDataPrecondition', CASE
    WHEN labels.names = ARRAY['BASIC','PRO','STANDARD'] THEN 'ALREADY_V2_DO_NOT_RERUN'
    WHEN labels.names IS DISTINCT FROM ARRAY['AGENT_CONTROL','BASIC','CUSTOM','PRO'] THEN 'BLOCKED_SCHEMA_REVIEW'
    WHEN migrations.unfinished > 0 THEN 'BLOCKED_MIGRATION_HISTORY'
    WHEN EXISTS (SELECT 1 FROM ledger WHERE rows > 0) THEN 'BLOCKED_LEGACY_LEDGER'
    WHEN selections.obsolete > 0 THEN 'BLOCKED_OBSOLETE_SELECTION'
    ELSE 'EMPTY_LEDGER_PRECONDITION_MET'
  END,
  'releaseAuthorized', false,
  'providerObligationsVerified', false
) AS cutover_readiness
FROM labels CROSS JOIN selections CROSS JOIN migrations;
COMMIT;
