import { readFileSync } from "node:fs";
import { Client } from "pg";

// Sanitized, read-only evidence. Never prints a connection string or row data.
const target = new URL(process.env.TEST_DATABASE_URL || "invalid:");
const name = decodeURIComponent(target.pathname.slice(1));
const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8"));
if (!["postgres:", "postgresql:"].includes(target.protocol)
    || !["127.0.0.1", "localhost", "[::1]"].includes(target.hostname)
    || !name.includes("browser_test") || process.env.TEST_DATABASE_RESET_CONFIRM !== name
    || fixture.databaseName !== name) throw new Error("Count verification requires the confirmed local fixture target");
target.searchParams.set("options", "-c default_transaction_read_only=on");
const db = new Client({ connectionString: target.href });
await db.connect();
try {
    if ((await db.query("SELECT current_database() AS name")).rows[0]?.name !== name) throw new Error("Database identity differs");
    const result = await db.query(`SELECT
      (SELECT COUNT(*)::int FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE') AS public_tables,
      (SELECT COUNT(*)::int FROM "_prisma_migrations" WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL) AS applied_migrations,
      (SELECT COUNT(*)::int FROM "User") AS users,
      (SELECT COUNT(*)::int FROM "Organization") AS organizations,
      (SELECT COUNT(*)::int FROM "Branch") AS branches,
      (SELECT COUNT(*)::int FROM "Student") AS students,
      (SELECT COUNT(*)::int FROM "Seat") AS seats,
      (SELECT COUNT(*)::int FROM "Shift") AS shifts,
      (SELECT COUNT(*)::int FROM "Payment") AS fees,
      (SELECT COUNT(*)::int FROM "FeeCollection" WHERE "voidedAt" IS NULL) AS live_receipts,
      (SELECT COUNT(*)::int FROM "FeeCollection" WHERE "voidedAt" IS NOT NULL) AS voided_receipts,
      (SELECT COUNT(*)::int FROM "DashboardTask") AS tasks,
      (SELECT COUNT(*)::int FROM "MembershipTerm") AS membership_terms,
      (SELECT COUNT(*)::int FROM "DashboardEvent") AS prospective_events,
      (SELECT COUNT(*)::int FROM "OccupancySnapshot") AS occupancy_snapshots,
      (SELECT COUNT(*)::int FROM "RenewalFollowUp" WHERE "completedAt" IS NULL) AS unresolved_followups,
      (SELECT COUNT(*)::int FROM "AttendanceExpectation") AS expectations,
      (SELECT SUM(amount)::float FROM "Payment") AS billed,
      (SELECT SUM("collectedAmount")::float FROM "Payment") AS collected`);
    console.log(JSON.stringify(result.rows[0], null, 2));
} finally { await db.end(); }
