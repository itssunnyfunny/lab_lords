import fs from "node:fs";
import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const evidence = "docs/redesign/application-rollout-evidence/reporting";
const aiReport = {
    healthScore: "MODERATE_RISK", executiveSummary: "Collections need follow-up while available shifts can serve more students.",
    priorityFocus: "Contact students with overdue dues before planning new capacity.",
    keyFindings: ["Two due periods need review", "Open shift capacity remains available"],
    financialAnalysis: { observation: "Collections are below the current billed amount.", riskLevel: "MODERATE" },
    utilizationAnalysis: { observation: "Two of sixteen shift slots are used.", riskLevel: "MODERATE" },
    studentActivityAnalysis: { observation: "Three active students are enrolled.", riskLevel: "LOW" },
    suggestedActions: [{ action: "FOLLOW_UP_OVERDUE_PAYMENTS", reason: "Review the two recorded due periods." }],
    generatedAt: "2026-09-28T06:00:00.000Z",
};

test("real branch reporting pages preserve filtered export and report presentation", async ({ page }, info) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const csvRequests: URL[] = [];
    await page.route(/\/api\/branches\/pilot\/reports(?:\?.*)?$/, async route => {
        const url = new URL(route.request().url());
        if (url.searchParams.get("format") === "csv") {
            csvRequests.push(url);
            await route.fulfill({ status: 200, contentType: "text/csv", body: '"Student","Amount"\r\n"Aarav Mehta","1000"\r\n' });
            return;
        }
        await route.fulfill({ json: { columns: ["Student", "Amount", "Status"], rows: [["Aarav Mehta", 1000, "Due"]], count: 1, asOf: "2026-09-28T06:00:00.000Z" } });
    });
    await page.route(/\/api\/branches\/pilot(?:\?.*)?$/, route => route.fulfill({ json: { id: "pilot", name: "Shanti Study Library" } }));
    await page.route(/\/api\/analytics\/branch\/pilot\/trends(?:\?.*)?$/, route => {
        const kind = new URL(route.request().url()).searchParams.get("type");
        const dates = ["2026-09-01", "2026-09-07", "2026-09-14", "2026-09-21", "2026-09-28"];
        const points = dates.flatMap((date, index) => kind === "seat"
            ? [{ date: `${date}T00:00:00.000Z`, value: 12 + index * 2, category: "Occupied" }]
            : [{ date: `${date}T00:00:00.000Z`, value: 1000 + index * 500, category: "Revenue" },
                { date: `${date}T00:00:00.000Z`, value: 700 + index * 300, category: "Collected" },
                { date: `${date}T00:00:00.000Z`, value: 300 + index * 200, category: "Pending" }]);
        return route.fulfill({ json: points });
    });
    await page.route(/\/api\/organizations\/org-pilot\/billing(?:\?.*)?$/, route => route.fulfill({ json: { experience: {
        organizationId: "org-pilot", accessMode: "FULL", effectivePlan: "STANDARD", selectedPostTrialPlan: "STANDARD", providerStatus: "active",
        customerState: "STANDARD_ACTIVE", customerMessage: "Standard workspace is active.", trialEndsAt: null, trialDaysRemaining: null,
        paidThrough: "2026-10-01T00:00:00.000Z", confirmedQuantity: 1, projectedQuantity: 1, currentUnitAmount: 499,
        currentMonthlyTotal: 499, projectedUnitAmount: 499, projectedMonthlyTotal: 499, authorizationStatus: "AUTHORIZED",
        planFeeDueToday: 0, nextChargeAt: "2026-10-01T00:00:00.000Z", paymentAction: "NONE",
        entitlements: ["STAFF_MANAGEMENT", "ADVANCED_ANALYTICS", "AI_ACCESS"], latestOperation: null, activeOperation: null,
        scheduledChanges: [], branch: null, viewer: { isOwner: true, canManageBilling: true }, hasActiveOperation: false,
    } } }));
    await page.route(/\/api\/analytics\/org\/org-pilot\/snapshot(?:\?.*)?$/, route => route.fulfill({ json: {
        asOf: "2026-09-28T06:00:00.000Z", organization: { totalBranches: 1 },
        seats: { totalSeats: 16, occupiedSeats: 2, utilizationRatio: 0.125, physicalSeats: 8, totalSlots: 16, usedSlots: 2 },
        students: { active: 3, inactive: 0, total: 3 },
        payments: { dueCount: 2, paidCount: 2, overdueCount: 2, dueAmount: 2400, paidAmount: 1900 },
        branches: [{ branchId: "pilot", branchName: "Shanti Study Library", snapshot: {
            seats: { overall: { totalSeats: 16, occupiedSeats: 2, utilizationRatio: 0.125 } },
            students: { status: { active: 3, inactive: 0, total: 3 }, seating: { seated: 2, notSeated: 1, activeStudents: 3 } },
            payments: { dueCount: 2, paidCount: 2, overdueCount: 2, dueAmount: 2400, paidAmount: 1900 },
        } }],
    } }));
    await page.route(/\/api\/ai\/branch\/pilot(?:\?.*)?$/, route => route.fulfill({ json: {
        report: aiReport, meta: { branchId: "pilot", branchName: "Shanti Study Library", generatedAt: aiReport.generatedAt },
        snapshot: { branchName: "Shanti Study Library", asOf: aiReport.generatedAt,
            seats: { total: 16, occupied: 2, available: 14, utilizationPercent: 13, shiftBreakdown: [{ shiftName: "Morning", used: 2, capacity: 8, occupancyPercent: 25 }] },
            students: { total: 3, active: 3, inactive: 0 }, payments: { dueCount: 2, paidCount: 2, overdueCount: 2, overdueAmount: 2400 } },
        hasPendingChanges: false, risks: { total: 1, items: [{ type: "OVERDUE_COLLECTIONS", severity: "MEDIUM", explanation: "Two recorded due periods need owner review." }] },
    } }));

    for (const [route, heading] of [["reports", "Exports & Reports"], ["analytics", "Analytics"], ["ai/reports", "AI Branch Report"]] as const) {
        await page.goto(`/branch/pilot/${route}?mode=after&lang=en`);
        await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
        await expect(page.locator(".ui-panel--compact:visible").first()).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
        if (info.project.name === "mobile-390") {
            fs.mkdirSync(evidence, { recursive: true });
            await page.evaluate(() => document.fonts.ready);
            await page.screenshot({ path: `${evidence}/${route.replace("/", "-")}-mobile-390.png`, animations: "disabled" });
            if (route === "analytics") {
                await expect(page.getByRole("heading", { name: "Revenue Trend" })).toBeVisible();
                await page.waitForTimeout(1500); // Let the chart's SVG entrance animation finish before capture.
                await page.getByRole("heading", { name: "Revenue Trend" }).locator("xpath=ancestor::section[1]")
                    .screenshot({ path: `${evidence}/analytics-chart-mobile-390.png`, animations: "disabled" });
            }
        }
    }
    await page.goto("/branch/pilot/reports?mode=after&lang=en");
    await expect(page.getByRole("rowheader", { name: "Aarav Mehta" })).toBeVisible();
    await page.getByRole("button", { name: "Download CSV" }).click();
    await expect.poll(() => csvRequests.length).toBe(1);
    expect(csvRequests[0].searchParams.get("kind")).toBe("fees");
    expect(csvRequests[0].searchParams.get("format")).toBe("csv");
    for (const [lang, htmlLang] of [["hi", "hi-IN"], ["hinglish", "hi-Latn-IN"]] as const) {
        await page.goto(`/branch/pilot/reports?mode=after&lang=${lang}`);
        await expect(page.locator("html")).toHaveAttribute("lang", htmlLang);
        await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    }
    if (info.project.name === "mobile-390") {
        await page.setViewportSize({ width: 320, height: 800 });
        await page.goto("/branch/pilot/reports?mode=after&lang=en");
        await expect(page.locator(".ui-record-surface")).toBeVisible();
        expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    }
    await page.goto("/org/org-pilot/analytics?mode=after&lang=en");
    await expect(page.getByRole("heading", { name: "Cross-branch health", level: 1 })).toBeVisible();
    await expect(page.locator(".ui-record-surface")).toBeVisible();
    if (info.project.name === "mobile-390") {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: `${evidence}/org-analytics-mobile-390.png`, animations: "disabled" });
        await page.locator(".ui-record-card:visible").first().screenshot({ path: `${evidence}/org-analytics-card-mobile-390.png`, animations: "disabled" });
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    const { violations } = await new AxeBuilder({ page }).analyze();
    expect(violations.filter(item => ["serious", "critical"].includes(item.impact!))).toEqual([]);
    expect(errors).toEqual([]);
});
