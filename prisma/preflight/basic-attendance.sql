-- Read-only inventory; run only against the operator-approved target.
-- Bind/check database identity privately. No student/contact/payment bodies.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
SHOW transaction_read_only;
SELECT current_database() AS database_name;
SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back
FROM "_prisma_migrations" ORDER BY migration_name;
-- Exact all-table inventory works both before and after the additive migration.
DO $$
DECLARE item record; row_count bigint;
BEGIN
  FOR item IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename LOOP
    EXECUTE format('SELECT count(*) FROM public.%I', item.tablename) INTO row_count;
    RAISE NOTICE 'TABLE % COUNT %', item.tablename, row_count;
  END LOOP;
END;
$$;
SELECT status, count(*) AS students FROM "Student" GROUP BY status ORDER BY status;
SELECT status, count(*) AS fees, sum(amount) AS original_rupees,
  sum("collectedAmount") AS collected_rupees, sum("waivedAmount") AS waived_rupees
FROM "Payment" GROUP BY status ORDER BY status;
SELECT count(*) AS allocation_rows, count(*) FILTER (WHERE "endDate" IS NULL) AS active_allocations FROM "SeatAllocation";
SELECT action, count(*) AS audit_rows FROM "AuditLog" GROUP BY action ORDER BY action;
SELECT conrelid::regclass AS table_name, conname, convalidated
FROM pg_constraint WHERE connamespace = 'public'::regnamespace
AND (conrelid::regclass::text LIKE '%Attendance%' OR conname = 'AuditLog_exact_domain_target')
ORDER BY 1, 2;
SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename LIKE 'Attendance%' ORDER BY indexname;
COMMIT;
