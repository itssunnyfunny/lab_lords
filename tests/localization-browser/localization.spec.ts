import { test, expect, type Page } from "@playwright/test";
import { mockFeeCollections } from "../browser/helpers/fee-collection";

async function fixture(page: Page) {
    const profiles: Record<string, { interfaceLanguage: string; documentLanguage: string; defaultMessageLanguage: string }> = {
        one: { interfaceLanguage: "en", documentLanguage: "en", defaultMessageLanguage: "hi" },
        two: { interfaceLanguage: "en", documentLanguage: "en", defaultMessageLanguage: "en" },
    };
    const patches: Record<string, unknown>[] = [];
    await page.route("**/api/users/me", async route => {
        const user = await page.evaluate(() => sessionStorage.getItem("fixture-user") ?? "one");
        if (route.request().method() === "PATCH") {
            const patch = route.request().postDataJSON(); patches.push(patch); Object.assign(profiles[user], patch);
        }
        return route.fulfill({ json: { ...profiles[user], locale: "en-IN", timezone: "Asia/Kolkata", name: "Sample Owner" } });
    });
    const fees = await mockFeeCollections(page, "localization");
    const admissions: unknown[] = [];
    await page.route("**/api/branches/localization", route => route.fulfill({ json: { defaultMonthlyFee: 1200, defaultAdmissionFee: 100 } }));
    await page.route("**/api/branches/localization/students", route => {
        admissions.push(route.request().postDataJSON());
        return route.fulfill({ json: { id: "student", ...route.request().postDataJSON() } });
    });
    const followups: unknown[] = [];
    const row = { key: "fee", paymentId: "payment", studentId: "student", studentName: "Sample Student", phone: null, studentStatus: "ACTIVE", type: "MONTHLY", periodStart: "2026-07-10T00:00:00.000Z", periodEnd: "2026-08-10T00:00:00.000Z", dueDate: "2026-08-10T00:00:00.000Z", amount: 1200, expected: false, allocations: [], followUp: null };
    await page.route("**/api/branches/localization/renewals?**", route => route.fulfill({ json: { items: [row], counts: { ALL: 1, TODAY: 0, UPCOMING: 0, OUTSTANDING: 1, OVERDUE: 1 }, outstandingAmount: 1200, expectedAmount: 0, nextCursor: null, asOf: "2026-09-10T00:00:00.000Z" } }));
    await page.route("**/api/branches/localization/renewals/follow-up", route => {
        const body = route.request().postDataJSON(); followups.push(body);
        return route.fulfill({ json: { note: body.note, outcome: body.outcome, nextFollowUpAt: body.nextFollowUpAt, updatedAt: "2026-09-10T00:00:00.000Z", author: { name: "Sample Owner" } } });
    });
    const attendanceRequests: unknown[] = [];
    let uncertain = true;
    await page.route("**/api/branches/localization/attendance**", route => {
        if (route.request().method() === "POST") {
            attendanceRequests.push(route.request().postDataJSON());
            if (uncertain) { uncertain = false; return route.abort("failed"); }
            return route.fulfill({ json: { message: "1 selected student(s) marked present", count: 1 } });
        }
        return route.fulfill({ json: { date: "2026-09-10", today: "2026-09-10", timezone: "Asia/Kolkata", total: 1, nextCursor: null, shifts: [], counts: { attended: 0, absent: 0, notMarked: 1, open: 0 }, items: [{ id: "student", name: "Sample Student", status: "ACTIVE", phone: "", attendance: "NOT_MARKED", mark: null, openVisit: null, visits: [], currentAllocations: [] }] } });
    });
    await page.goto("/");
    return { profiles, patches, fees, followups, attendanceRequests, admissions };
}
const ui = /Interface language|स्क्रीन की भाषा|Screen ki language/;
const doc = /Document language|रसीद और रिपोर्ट की भाषा|Receipt aur report ki language/;

test("public URL language survives a late account read and app preferences resume afterward", async ({ page }) => {
    const { patches } = await fixture(page);
    let finish!: () => void;
    const held = new Promise<void>(resolve => { finish = resolve; });
    await page.route("**/api/users/me", async route => {
        if (route.request().method() !== "GET") return route.fallback();
        await held;
        return route.fulfill({ json: { interfaceLanguage: "hinglish", documentLanguage: "hi", locale: "en-IN", timezone: "Asia/Kolkata" } });
    });
    await page.reload();
    await page.getByRole("button", { name: "Public Hindi fixture", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
    finish();
    await expect(page.getByLabel(ui)).toHaveValue("hinglish");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
    await expect(page.getByLabel(doc)).toHaveValue("hi");
    await page.getByRole("button", { name: "Public English fixture", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");
    await page.getByRole("button", { name: "Public Hinglish fixture", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-Latn-IN");
    await page.getByRole("button", { name: "App language fixture", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-Latn-IN");
    expect(patches).toEqual([]);
});

test("an early screen-language save preserves other preferences from a delayed profile read", async ({ page }) => {
    await fixture(page);
    let finishRead!: () => void;
    const hold = new Promise<void>(resolve => { finishRead = resolve; });
    let readStarted = false;
    await page.route("**/api/users/me", async route => {
        if (route.request().method() !== "GET") return route.fallback();
        readStarted = true;
        await hold;
        return route.fulfill({ json: { interfaceLanguage: "en", documentLanguage: "hi", locale: "en-US", timezone: "UTC", dateFormat: "yyyy-MM-dd", name: "Original owner" } });
    });
    await page.reload();
    await expect.poll(() => readStarted).toBe(true);
    await page.getByLabel(ui).selectOption("hinglish");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-Latn-IN");
    finishRead();
    await expect(page.getByLabel(doc)).toHaveValue("hi");
    await expect(page.getByLabel(ui)).toHaveValue("hinglish");
    await expect(page.locator("html")).toHaveAttribute("data-locale", "en-US");
    await expect(page.locator("html")).toHaveAttribute("data-timezone", "UTC");
    await expect(page.locator("html")).toHaveAttribute("data-date-format", "yyyy-MM-dd");
});

test("a late preference save cannot apply one user's language to another session", async ({ page }) => {
    const state = await fixture(page);
    let finishSave!: () => void;
    const hold = new Promise<void>(resolve => { finishSave = resolve; });
    let requestStarted = false;
    await page.route("**/api/users/me", async route => {
        if (route.request().method() !== "PATCH") return route.fallback();
        Object.assign(state.profiles.one, route.request().postDataJSON());
        requestStarted = true;
        await hold;
        return route.fulfill({ json: state.profiles.one });
    });
    await page.getByLabel(ui).selectOption("hi");
    await expect.poll(() => requestStarted).toBe(true);
    await page.getByRole("button", { name: "Switch fixture user" }).click();
    await expect(page.getByLabel(ui)).toHaveValue("en");
    const saved = page.waitForResponse(response => response.request().method() === "PATCH");
    finishSave();
    await saved;
    await expect(page.locator("html")).toHaveAttribute("lang", "en-IN");
    await page.reload();
    await expect(page.getByLabel(ui)).toHaveValue("en");
    await page.getByRole("button", { name: "Switch fixture user" }).click();
    await expect(page.getByLabel(ui)).toHaveValue("hi");
});

test("full collection uses the same fee amount after a Hinglish language switch", async ({ page }) => {
    const state = await fixture(page);
    await page.getByRole("button", { name: "Collection fixture" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(ui).selectOption("hinglish");
    await dialog.locator('input[inputmode="numeric"]').fill("1200");
    await dialog.getByRole("button", { name: "Payment record karna confirm karein", exact: true }).click();
    await expect(dialog.getByRole("heading", { name: "Payment record ho gaya" })).toBeVisible();
    expect(state.fees.attempts).toHaveLength(1);
    expect(state.fees.records.size).toBe(1);
    expect(JSON.stringify(state.fees.attempts[0])).toContain("1200");
});

test("admission validates locally and preserves entered details across all three languages", async ({ page }) => {
    const state = await fixture(page);
    await page.getByRole("button", { name: "Admission fixture" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel(ui).selectOption("hi");
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog.locator("#add-student-name-error")).not.toBeEmpty();
    await expect(dialog.locator("#add-student-name-error")).not.toContainText("is required");
    expect(state.admissions).toHaveLength(0);
    await dialog.locator("#add-student-name").fill("Original नाम {count}");
    await dialog.locator("#add-student-phone").fill("9876543210");
    await dialog.locator("#add-student-monthly-fee").fill("1350");
    await dialog.getByLabel(ui).selectOption("hinglish");
    await expect(dialog.locator("#add-student-name")).toHaveValue("Original नाम {count}");
    await expect(dialog.locator("#add-student-monthly-fee")).toHaveValue("1350");
    await dialog.locator('button[type="submit"]').click();
    await expect(dialog).toHaveCount(0);
    expect(state.admissions).toHaveLength(1);
    expect(state.admissions[0]).toMatchObject({ name: "Original नाम {count}", phone: "+91 98765 43210", monthlyFee: 1350 });
});

test("personal choices persist and remain independent across users and language purposes", async ({ page }) => {
    const state = await fixture(page);
    await page.getByLabel(ui).selectOption("hi");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-IN");
    await page.getByLabel(doc).selectOption("hinglish");
    await page.reload();
    await expect(page.getByLabel(ui)).toHaveValue("hi");
    await expect(page.getByLabel(doc)).toHaveValue("hinglish");
    await page.getByRole("button", { name: "Switch fixture user" }).click();
    await expect(page.getByLabel(ui)).toHaveValue("en");
    await page.getByLabel(ui).selectOption("hinglish");
    await expect(page.locator("html")).toHaveAttribute("lang", "hi-Latn-IN");
    await page.getByRole("button", { name: "Switch fixture user" }).click();
    await expect(page.getByLabel(ui)).toHaveValue("hi");
    expect(state.profiles.one.defaultMessageLanguage).toBe("hi");
    expect(state.profiles.two.documentLanguage).toBe("en");
    expect(state.patches.every(p => Object.keys(p).length === 1 && !('defaultMessageLanguage' in p))).toBe(true);
});

test("collection edits and the uncertain request survive language switches; Hindi receipt renders", async ({ page }, info) => {
    const state = await fixture(page);
    await page.getByRole("button", { name: "Collection fixture" }).click();
    const dialog = page.getByRole("dialog");
    await dialog.getByLabel("Amount received (whole ₹)").fill("700");
    await dialog.getByLabel("Note (shown on receipt, optional)").fill("Original नोट {name}");
    await dialog.getByLabel(ui).selectOption("hi");
    await expect(dialog.getByLabel("मिले हुए पैसे (पूरे रुपये में)")).toHaveValue("700");
    await expect(dialog.getByLabel("नोट (रसीद पर दिखेगा, ज़रूरी नहीं)")).toHaveValue("Original नोट {name}");
    await page.screenshot({ path: info.outputPath("collection-hi.png"), fullPage: true });
    state.fees.loseResponse = true;
    await dialog.getByRole("button", { name: "फीस दर्ज करने की पुष्टि करें", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "उसी पेमेंट की पुष्टि फिर करें" })).toBeVisible();
    await dialog.getByLabel(ui).selectOption("hinglish");
    await dialog.getByRole("button", { name: "Usi payment ko dobara confirm karein" }).click();
    await expect(dialog.getByRole("heading", { name: "Payment record ho gaya" })).toBeVisible();
    expect(state.fees.attempts).toHaveLength(2);
    expect(state.fees.attempts[0]).toEqual(state.fees.attempts[1]);
    expect(state.fees.records.size).toBe(1);
    await dialog.getByLabel(doc).selectOption("hi");
    await expect(dialog.getByRole("heading", { name: "फीस की रसीद" })).toBeVisible();
    await expect(dialog.getByText("Original नोट {name}", { exact: false })).toBeVisible();
    const download = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "PDF download karein", exact: true }).click();
    await (await download).saveAs(info.outputPath("receipt-hi.pdf"));
    await page.screenshot({ path: info.outputPath("receipt-hi.png"), fullPage: true });
    expect(state.fees.records.size).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("attendance retries keep the command and follow-up notes survive language changes", async ({ page }, info) => {
    const state = await fixture(page);
    await page.getByLabel(ui).selectOption("hi");
    await page.getByRole("button", { name: "बातचीत की जानकारी बदलें", exact: true }).click();
    let dialog = page.getByRole("dialog");
    await dialog.getByLabel("बातचीत का नोट").fill("Original follow-up note");
    await dialog.getByLabel(ui).selectOption("hinglish");
    await expect(dialog.getByLabel("Follow-up note")).toHaveValue("Original follow-up note");
    await page.screenshot({ path: info.outputPath("follow-up-hinglish.png"), fullPage: true });
    await dialog.getByRole("button", { name: "Follow-up save karein" }).click();
    await expect(page.getByText("Follow-up save ho gaya. Fee ki date wahi hai.")).toBeVisible();
    expect(state.followups).toHaveLength(1);
    await page.getByRole("button", { name: "Attendance fixture" }).click();
    await page.getByRole("button", { name: "Present mark karein", exact: true }).click();
    dialog = page.getByRole("dialog");
    await dialog.getByLabel("Note (optional)").fill("Original attendance note");
    await dialog.getByRole("button", { name: "Confirm karein", exact: true }).click();
    await expect(dialog.getByRole("button", { name: "Usi action se dobara try karein" })).toBeVisible();
    await dialog.getByLabel(ui).selectOption("hi");
    await expect(dialog.getByLabel("नोट (ज़रूरी नहीं)")).toHaveValue("Original attendance note");
    await dialog.getByRole("button", { name: "उसी कार्रवाई से फिर कोशिश करें" }).click();
    await expect(page.getByText("1 चुने छात्रों की हाजिरी: हाजिर")).toBeVisible();
    expect(state.attendanceRequests).toHaveLength(2);
    expect(state.attendanceRequests[0]).toEqual(state.attendanceRequests[1]);
    await page.screenshot({ path: info.outputPath("attendance-hi.png"), fullPage: true });
});
