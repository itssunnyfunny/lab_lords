-- psql -X --set ON_ERROR_STOP=on --set organization_id=<id> --file scripts/branch-plan-inventory.sql
-- Compatible with the aggregate schema, before or after agreement DDL.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SELECT id, "billingModelVersion", "selectedPostTrialPlan", "billingMutationSequence",
       ("billingMutationLeaseToken" IS NOT NULL) AS has_lease
FROM "Organization" WHERE id = :'organization_id';
SELECT id, "billingStatus", "billingActivatedAt", "billingArchivedAt"
FROM "Branch" WHERE "organizationId" = :'organization_id' ORDER BY id;
SELECT id, "providerMode", plan, quantity, status, "currentOrganizationId", "pendingReplacementOrganizationId",
       "billingOfferId", "paidThrough", "lastConfirmedInvoiceId", "lastConfirmedPaymentId",
       "currentEnd", "chargeAt", "cancelAtCycleEnd", "lastReconciledAt"
FROM "OrganizationSubscription" WHERE "organizationId" = :'organization_id' ORDER BY id;
SELECT id, source, status, "trialPlan", "trialStartedAt", "trialEndsAt", "consumedAt"
FROM "OwnerTrialGrant" WHERE "organizationId" = :'organization_id';
SELECT id, "billingOfferId", status, "subscriptionId", "eligibleUntil" FROM "OrganizationOfferGrant" WHERE "organizationId" = :'organization_id';
SELECT id, "branchId", "organizationSubscriptionId", "replacementSubscriptionId", sequence, type,
       status, "operationStatus", "effectiveAt", "undoCutoffAt", "failureCategory"
FROM "OrganizationBillingChange" WHERE "organizationId" = :'organization_id' ORDER BY sequence;
SELECT id, "changeId", purpose, status, "failureKind" FROM "BillingProviderAction"
WHERE "organizationId" = :'organization_id' ORDER BY "admittedAt", id;
SELECT id, "organizationSubscriptionId", "processedAt" IS NOT NULL AS completed FROM "RazorpayWebhookEvent"
WHERE "organizationId" = :'organization_id' ORDER BY id;
SELECT id, "organizationSubscriptionId", status, "periodEnd", "amountPaidSubunits", "commercialEvidenceVersion"
FROM "OrganizationSubscriptionInvoice" WHERE "organizationId" = :'organization_id' ORDER BY id;

-- Show post-admission rows when the additive migrations are installed.
SELECT to_regclass('"BranchBillingAgreement"') IS NOT NULL AS agreements_installed \gset
\if :agreements_installed
SELECT a."branchId", a."selectedPlan", a."billingMutationSequence",
       to_jsonb(a)->>'legacyCoverageSubscriptionId' AS original_source,
       to_jsonb(a)->>'legacyCoverageEndsAt' AS original_coverage_end,
       s.id AS current_subscription, r.id AS pending_replacement
FROM "BranchBillingAgreement" a
LEFT JOIN "OrganizationSubscription" s ON s."currentAgreementBranchId"=a."branchId" AND s."organizationId"=a."organizationId"
LEFT JOIN "OrganizationSubscription" r ON r."pendingAgreementBranchId"=a."branchId" AND r."organizationId"=a."organizationId"
WHERE a."organizationId"=:'organization_id' ORDER BY a."branchId";
SELECT count(*) AS conversion_receipts FROM "OrganizationBillingChange"
WHERE "organizationId"=:'organization_id' AND "agreementBranchId" IS NOT NULL
  AND type='LEGACY_TRANSITION' AND "idempotencyKey" LIKE 'branch-conversion:%';
\endif

-- Compare counts and full-row checksums at the same operational boundary.
-- No customer records, receipt snapshots, or contact details leave PostgreSQL.
WITH branches AS (SELECT id FROM "Branch" WHERE "organizationId" = :'organization_id'),
rows AS (
  SELECT 'students' AS kind, to_jsonb(t) AS r FROM "Student" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'enrollments',to_jsonb(t) FROM "StudentEnrollmentHistory" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'terms',to_jsonb(t) FROM "MembershipTerm" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'termRevisions',to_jsonb(t) FROM "MembershipTermRevision" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'seats',to_jsonb(t) FROM "Seat" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'shifts',to_jsonb(t) FROM "Shift" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'multiShifts',to_jsonb(t) FROM "MultiShift" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'allocations',to_jsonb(t) FROM "SeatAllocation" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'moves',to_jsonb(t) FROM "AllocationMoveCommand" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'payments',to_jsonb(t) FROM "Payment" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'paymentEvents',to_jsonb(t) FROM "PaymentResolutionEvent" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'audit',to_jsonb(t) FROM "AuditLog" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'collections',to_jsonb(t) FROM "FeeCollection" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'collectionAllocations',to_jsonb(t) FROM "FeeCollectionAllocation" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'memberships',to_jsonb(t) FROM "Staff" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'whatsappSettings',to_jsonb(t) FROM "BranchWhatsAppSettings" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'whatsappRules',to_jsonb(t) FROM "WhatsAppAutomationRule" t JOIN branches b ON b.id=t."branchId"
  UNION ALL SELECT 'overrides',to_jsonb(t) FROM "StaffPermissionOverride" t JOIN "Staff" s ON s.id=t."staffId" JOIN branches b ON b.id=s."branchId"
) SELECT kind, count(*) AS rows, sum(hashtextextended(r::text, 0)::numeric) AS checksum FROM rows GROUP BY kind ORDER BY kind;
SELECT p.status, sum(p.amount) AS face_amount, sum(p."collectedAmount") AS collected, sum(p."waivedAmount") AS waived
FROM "Payment" p JOIN "Branch" b ON b.id=p."branchId" WHERE b."organizationId"=:'organization_id' GROUP BY p.status;
SELECT count(*) AS original_history_entries FROM "OrganizationSubscriptionHistory" h
WHERE "organizationId"=:'organization_id' AND to_jsonb(h)->>'agreementBranchId' IS NULL;
SELECT count(*) AS original_invoices FROM "OrganizationSubscriptionInvoice" i
WHERE "organizationId"=:'organization_id' AND to_jsonb(i)->>'agreementBranchId' IS NULL;
COMMIT;
