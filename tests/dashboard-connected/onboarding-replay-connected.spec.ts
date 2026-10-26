import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { Client } from "pg";
import { assertDisposableTestDatabaseTarget } from "../setup/testDatabaseSafety";
import { refreshDevelopmentSession } from "../browser/helpers/development-session";

const fixture = JSON.parse(readFileSync(".clerk/dashboard-fixture.json", "utf8")) as {
    databaseName: string; ownerId: string; orgId: string;
};
const target = assertDisposableTestDatabaseTarget(process.env.TEST_DATABASE_URL, process.env);
if (target.databaseName !== fixture.databaseName || !target.databaseName.includes("browser_test")) throw new Error("Wrong synthetic onboarding fixture");

// Original lost-response client coverage remains in pilot.spec.ts and the
// real-PostgreSQL onboarding tests. The former connected case intentionally
// created a second owned organization, which the current product forbids.
test("an existing owner cannot create another organization with concurrent different keys and retains workspace access", async ({ page }) => {
    const db = new Client({ connectionString: process.env.TEST_DATABASE_URL, options: "-c default_transaction_read_only=on" });
    await db.connect();
    try {
        expect((await db.query("SELECT current_database() AS name")).rows[0].name).toBe(target.databaseName);
        const counts = async () => (await db.query(`SELECT
            (SELECT COUNT(*)::int FROM "Organization" WHERE "ownerId"=$1) AS organizations,
            (SELECT COUNT(*)::int FROM "OnboardingRequest" WHERE "ownerId"=$1) AS receipts,
            (SELECT COUNT(*)::int FROM "OwnerTrialGrant" WHERE "ownerId"=$1) AS trials,
            (SELECT COUNT(*)::int FROM "OrganizationSubscriptionHistory") AS history,
            (SELECT COUNT(*)::int FROM "BillingProviderAction") AS actions`, [fixture.ownerId])).rows[0];
        const before = await counts(); expect(before.organizations).toBeGreaterThan(0);
        await refreshDevelopmentSession(page);
        const results = await page.evaluate(async keys => {
            const clerk = (window as unknown as { Clerk: { user: { id: string }; session: { getToken(options: { skipCache: boolean }): Promise<string> } } }).Clerk;
            const token = await clerk.session.getToken({ skipCache: true });
            if (!token) throw new Error("Real development session missing");
            return Promise.all(keys.map(async key => {
                const response = await fetch("/api/onboarding", { method: "POST", headers: {
                    "Content-Type": "application/json", Authorization: `Bearer ${token}`,
                    "Idempotency-Key": key, "X-Onboarding-Account": clerk.user.id,
                }, body: JSON.stringify({ orgName: "Synthetic extra organization", branchName: "Synthetic branch", ownerPhone: "9999999999", selectedPostTrialPlan: "BASIC", seatCount: 1, defaultFee: 0 }) });
                return { status: response.status, body: await response.json() };
            }));
        }, Array.from({ length: 4 }, () => randomUUID()));
        expect(results).toHaveLength(4);
        for (const result of results) expect(result).toMatchObject({ status: 409, body: { code: "ORGANIZATION_ALREADY_EXISTS" } });
        expect(await counts()).toEqual(before);
        await page.goto(`/org/${fixture.orgId}`, { waitUntil: "domcontentloaded" });
        await expect(page).toHaveURL(new RegExp(`/org/${fixture.orgId}$`));
        await expect(page.getByRole("main")).toBeVisible();
        await expect(page.getByRole("link", { name: "Set up another organization", exact: true })).toHaveCount(0);
    } finally { await db.end(); }
});
