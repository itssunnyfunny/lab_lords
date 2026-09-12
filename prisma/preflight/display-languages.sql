-- Read-only release inventory on the already approved database.
-- Compare business/user evidence before and after the protected migration,
-- before the preference-changing smoke. No names, notes or credentials returned.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';
SET LOCAL lock_timeout = '3s';
SELECT 'display_languages' AS inventory, jsonb_build_object(
  'read_only', current_setting('transaction_read_only'),
  'database', current_database(),
  'migrations', (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  'failed_migrations', (SELECT count(*) FROM "_prisma_migrations" WHERE finished_at IS NULL AND rolled_back_at IS NULL),
  'latest_migration', (SELECT max(migration_name) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
  'installed_manifest', (SELECT md5(string_agg(migration_name || ':' || checksum, chr(10) ORDER BY migration_name)) FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL AND migration_name <> '20260912120000_user_display_languages'),
  'users', (SELECT count(*) FROM "User"),
  'existing_user_facts', (SELECT md5(coalesce(string_agg((to_jsonb(u) - 'interfaceLanguage' - 'documentLanguage')::text, '' ORDER BY id), '')) FROM "User" u),
  'collections', (SELECT count(*) FROM "FeeCollection"),
  'collection_facts', (SELECT md5(coalesce(string_agg(to_jsonb(c)::text, '' ORDER BY id), '')) FROM "FeeCollection" c),
  'payments', (SELECT count(*) FROM "Payment"),
  'payment_facts', (SELECT md5(coalesce(string_agg(to_jsonb(p)::text, '' ORDER BY id), '')) FROM "Payment" p),
  'attendance_commands', (SELECT count(*) FROM "AttendanceCommand"),
  'attendance_command_facts', (SELECT md5(coalesce(string_agg(to_jsonb(a)::text, '' ORDER BY id), '')) FROM "AttendanceCommand" a),
  'attendance_marks', (SELECT count(*) FROM "AttendanceMark"),
  'attendance_visits', (SELECT count(*) FROM "AttendanceVisit"),
  'audit_rows', (SELECT count(*) FROM "AuditLog"),
  'language_columns', (SELECT count(*) FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'User' AND column_name IN ('interfaceLanguage', 'documentLanguage') AND is_nullable = 'NO' AND column_default = '''en''::text'),
  'language_constraints', (SELECT count(*) FROM pg_constraint WHERE conrelid = '"User"'::regclass AND conname IN ('User_interfaceLanguage_check', 'User_documentLanguage_check') AND convalidated),
  'non_english_preferences', (SELECT count(*) FROM "User" u WHERE coalesce(to_jsonb(u)->>'interfaceLanguage', 'en') <> 'en' OR coalesce(to_jsonb(u)->>'documentLanguage', 'en') <> 'en'),
  'language_migration_checksum', (SELECT checksum FROM "_prisma_migrations" WHERE migration_name = '20260912120000_user_display_languages' AND finished_at IS NOT NULL AND rolled_back_at IS NULL)
) AS evidence;
COMMIT;
