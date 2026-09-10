-- Read-only inventory. Run only against an explicitly authorized target.
-- First deployment has no backfill: no legacy receipt/date/collection is inferred.
BEGIN TRANSACTION READ ONLY;
SELECT current_database() AS database_name;
SELECT "status", count(*) AS fees, sum("amount"::bigint) AS original_fee_total,
       count(*) FILTER (WHERE "paidAt" IS NULL) AS without_collection_date
FROM "Payment" GROUP BY "status" ORDER BY "status";
SELECT "source", "fromStatus", "toStatus", count(*) AS events
FROM "PaymentResolutionEvent" GROUP BY 1,2,3 ORDER BY 1,2,3;
SELECT count(*) AS foreign_student_links FROM "Payment" p
LEFT JOIN "Student" s ON s."id" = p."studentId" AND s."branchId" = p."branchId"
WHERE s."id" IS NULL;
SELECT count(*) AS negative_original_fees FROM "Payment" WHERE "amount" < 0;
COMMIT;

-- After schema expansion, execute separately:
-- SELECT count(*) FROM "FeeCollection";
-- SELECT count(*) FROM "FeeCollectionAllocation";
-- SELECT count(*) FROM "Payment" WHERE "ledgerBacked" OR "collectedAmount" <> 0 OR "waivedAmount" <> 0;
-- All three are zero immediately after first migration, before application writes.
-- Recompare the original fee/status/date and resolution-event inventory above.
