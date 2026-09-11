import fs from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import QRCode from "qrcode";
import { refreshDevelopmentSession } from "./helpers/development-session";
import type { AttendanceCommand, AttendanceHistory, AttendancePage } from "@/lib/attendance";

const statePath = process.env.PLAYWRIGHT_OWNER_AUTH_STATE;
const available = Boolean(statePath && fs.existsSync(statePath));
const branchId = "attendance-browser-branch";
const qr = "19d8dc40-25f4-4c52-8baa-b6e28b08b3ef";
test.use({ storageState: available ? statePath : { cookies: [], origins: [] } });

test("navigation and browser history replace the document camera policy", async ({ page, isMobile }) => {
    await page.route(`**/api/branches/${branchId}/students?**`, route => route.fulfill({ json: { items: [], total: 0, nextCursor: null } }));
    await page.route(`**/api/branches/${branchId}/shifts**`, route => route.fulfill({ json: [] }));
    await page.route(`**/api/branches/${branchId}/multi-shifts**`, route => route.fulfill({ json: [] }));
    await fixture(page);
    const cameraAllowed = () => page.evaluate(() => (document as Document & {
        featurePolicy: { allowsFeature: (name: string) => boolean };
    }).featurePolicy.allowsFeature("camera")).catch(error => {
        if (error.message.includes("Execution context was destroyed")) return null;
        throw error;
    });
    const navigate = async (name: string) => {
        if (isMobile) await page.getByRole("button", { name: "Open navigation", exact: true }).click();
        await page.getByRole("link", { name, exact: true }).filter({ visible: true }).click();
    };
    expect(await cameraAllowed()).toBe(true);
    await navigate("Students");
    await expect.poll(cameraAllowed).toBe(false);
    await expect(page.getByRole("heading", { name: "Students", exact: true })).toBeVisible();
    await navigate("Attendance");
    await expect(page.getByRole("heading", { name: "Attendance", exact: true })).toBeVisible();
    await expect.poll(cameraAllowed).toBe(true);
    await page.goBack();
    await expect.poll(cameraAllowed).toBe(false);
    await expect(page.getByRole("heading", { name: "Students", exact: true })).toBeVisible();
    await page.goForward();
    await expect(page.getByRole("heading", { name: "Attendance", exact: true })).toBeVisible();
    await expect.poll(cameraAllowed).toBe(true);
});
test.beforeEach(() => test.skip(!available, "Existing signed-in development state is required; no auth bypass is used."));

async function fixture(page: Page) {
    const day = "2026-09-11", attempts: AttendanceCommand[] = [], results = new Map<string, object>();
    const rows: AttendancePage = { date: day, today: day, timezone: "Asia/Kolkata", total: 2, nextCursor: null, shifts: [],
        counts: { attended: 0, absent: 0, notMarked: 2, open: 0 }, items: ["Asha", "Ravi"].map((name, i) => ({ id: `student-${i}`, name, phone: null, status: "ACTIVE", attendance: "NOT_MARKED", mark: null, visits: [], openVisit: null, currentAllocations: [] })) };
    const history: AttendanceHistory = { student: { id: "student-0", name: "Asha", status: "ACTIVE" }, timezone: "Asia/Kolkata", today: day, from: "2026-08-12", to: day, marks: [], visits: [], qr, nextCursor: null, audits: [], auditNextCursor: null };
    const state = { loseResponse: false, attempts, lookups: 0, rows, history };
    await page.route("**/api/users/me", route => route.fulfill({ json: { locale: "en-IN", timezone: "Asia/Kolkata" } }));
    await page.route(`**/api/branches/${branchId}/access`, route => route.fulfill({ json: { branchId, branchName: "Attendance demo", organizationId: "org", isOwner: true, role: "OWNER", effectivePlan: "BASIC", entitlements: [],
        permissions: { students: true, manage_branch: true, view_payments: false, seat_allocation: true } } }));
    await page.route(`**/api/branches/${branchId}/attendance**`, async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname.endsWith("/lookup")) { state.lookups++; return route.fulfill({ json: { student: { id: "student-0", name: "Asha", status: "ACTIVE" }, openVisit: null } }); }
        if (req.method() === "GET") return route.fulfill({ json: url.searchParams.has("studentId") ? history : rows });
        const input = req.postDataJSON() as AttendanceCommand; attempts.push(input);
        let result = results.get(input.key);
        if (!result) {
            if (input.kind === "MARK") for (const selected of input.students) {
                const student = rows.items.find(s => s.id === selected.studentId)!;
                student.attendance = input.status;
                student.mark = { date: day, status: input.status, version: selected.version + 1, source: "MANUAL", note: input.note ?? null, correctedAt: null, updatedAt: "2026-09-11T05:00:00Z", actor: { name: "Operator" } };
            }
            if (input.kind === "MARK") rows.counts = { attended: rows.items.filter(r => r.attendance === "PRESENT").length, absent: rows.items.filter(r => r.attendance === "ABSENT").length, notMarked: rows.items.filter(r => r.attendance === "NOT_MARKED").length, open: 0 };
            result = { message: input.kind === "CHECK_IN" ? "Checked in" : input.kind === "CORRECT_VISIT" ? "Visit corrected" : "Attendance recorded", student: { id: "student-0", name: "Asha" }, qr };
            results.set(input.key, result);
        } else expect(input).toEqual(attempts.find(a => a.key === input.key));
        if (state.loseResponse) { state.loseResponse = false; return route.abort("failed"); }
        return route.fulfill({ json: result });
    });
    await refreshDevelopmentSession(page);
    await page.goto(`/branch/${branchId}/attendance`);
    await expect(page.getByRole("heading", { name: "Attendance", exact: true })).toBeVisible();
    await expect(page.getByRole("article", { name: "Attendance for Asha" })).toBeVisible();
    return state;
}

test("selected manual attendance waits for confirmation and retries exactly the same request", async ({ page }) => {
    const state = await fixture(page); state.loseResponse = true;
    await page.getByRole("checkbox", { name: "Select Asha", exact: true }).check();
    await expect(page.getByText("1 explicitly selected")).toBeVisible();
    await page.getByRole("button", { name: "Selected Present", exact: true }).click();
    expect(state.attempts).toHaveLength(0);
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByRole("button", { name: "Retry same action" })).toBeVisible();
    await expect(page.getByRole("dialog").getByRole("button", { name: "Cancel", exact: true })).toBeDisabled();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Retry same action" })).toBeVisible();
    await page.getByRole("button", { name: "Retry same action" }).click();
    expect(state.attempts).toHaveLength(2); expect(state.attempts[0]).toEqual(state.attempts[1]);
    expect(state.attempts[0]).toMatchObject({ kind: "MARK", students: [{ studentId: "student-0", version: 0 }] });
    await expect(page.getByRole("article", { name: "Attendance for Asha" }).getByText("Present", { exact: true })).toBeVisible();
    await expect(page.getByRole("article", { name: "Attendance for Ravi" }).getByText("Not marked", { exact: true })).toBeVisible();
    await expect(page.getByText("No visit times recorded.", { exact: false }).first()).toBeVisible();
});

test("camera denial preserves manual fallback and mobile layout; QR downloads locally", async ({ page }) => {
    await page.addInitScript(() => {
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => { (window as unknown as { cameraCalls: number }).cameraCalls = ((window as unknown as { cameraCalls: number }).cameraCalls || 0) + 1; throw new DOMException("Denied", "NotAllowedError"); } } });
    });
    await fixture(page);
    expect(await page.evaluate(() => (window as unknown as { cameraCalls: number }).cameraCalls || 0)).toBe(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await page.getByRole("button", { name: "Open QR scanner" }).click();
    await expect(page.getByRole("dialog").getByRole("alert")).toContainText("Camera denied or unavailable");
    await page.getByRole("button", { name: "Close and use manual search" }).click();
    await expect(page.getByRole("article", { name: "Attendance for Asha" }).getByRole("button", { name: "Check in", exact: true })).toBeVisible();
    await page.getByRole("button", { name: "History & QR" }).first().click();
    await expect(page.getByRole("heading", { name: "Attendance history & QR" })).toBeVisible();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download QR" }).click(); expect((await download).suggestedFilename()).toBe("attendance-qr.png");
    const popupPromise = page.waitForEvent("popup"); await page.getByRole("button", { name: "Print QR" }).click();
    const popup = await popupPromise; await expect(popup.getByRole("heading", { name: "Asha" })).toBeVisible(); await expect(popup.getByRole("img")).toHaveAttribute("src", /^data:image\/png;base64,/); await popup.close();
    await page.screenshot({ path: `test-results/attendance-history-${test.info().project.name}.png`, fullPage: true });
});

test("software decoder scans a generated QR video, confirms explicit mode and cleans up tracks", async ({ page }) => {
    const image = await QRCode.toDataURL(qr, { width: 400, margin: 4 });
    await page.addInitScript(({ image }) => {
        const streams: MediaStream[] = [];
        (window as unknown as { attendanceStreams: MediaStream[] }).attendanceStreams = streams;
        Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: {
            enumerateDevices: async () => [{ kind: "videoinput", deviceId: "fixture", label: "QR video fixture" }],
            getUserMedia: async () => {
                const canvas = document.createElement("canvas"); canvas.width = 400; canvas.height = 400;
                const img = new Image(); img.src = image; await img.decode(); canvas.getContext("2d")!.drawImage(img, 0, 0);
                const stream = canvas.captureStream(5); streams.push(stream); return stream;
            },
        } });
    }, { image });
    const state = await fixture(page);
    await page.getByRole("button", { name: "Open QR scanner" }).click();
    await expect(page.getByRole("dialog").getByRole("heading", { name: "Asha", exact: true })).toBeVisible();
    expect(state.lookups).toBe(1); expect(state.attempts).toHaveLength(0);
    await page.getByRole("button", { name: "Confirm check in" }).click(); await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByText("Asha: Checked in", { exact: true })).toBeVisible();
    expect(state.attempts).toHaveLength(1); expect(state.attempts[0]).toMatchObject({ kind: "CHECK_IN", source: "QR" });
    await page.getByRole("button", { name: "Close and use manual search" }).click();
    expect(await page.evaluate(() => (window as unknown as { attendanceStreams: MediaStream[] }).attendanceStreams.every(s => s.getTracks().every(t => t.readyState === "ended")))).toBe(true);
});

test("history correction sends explicit timestamps, expected version and reason", async ({ page }) => {
    const state = await fixture(page);
    state.loseResponse = true;
    state.history.visits = [{ id: "visit", date: "2026-09-10", timezone: "Asia/Kolkata", checkIn: "2026-09-10T03:00:00Z", checkOut: null, source: "QR", note: null, version: 2, correctedAt: null, voidedAt: null, actor: { name: "Operator" } }];
    await page.getByRole("button", { name: "History & QR" }).first().click();
    await page.getByRole("button", { name: "Correct / close missed checkout" }).click();
    await page.getByLabel("Check-out timestamp", { exact: true }).fill("2026-09-10T09:00:00+05:30");
    await page.getByLabel("Correction reason", { exact: true }).fill("Forgot to record departure");
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByRole("button", { name: "Retry same action" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: "Retry same action" })).toBeVisible();
    await page.getByRole("button", { name: "Retry same action" }).click();
    await expect(page.getByText("Visit corrected", { exact: true })).toBeVisible();
    expect(state.attempts[0]).toMatchObject({ kind: "CORRECT_VISIT", visitId: "visit", version: 2, checkOut: "2026-09-10T09:00:00+05:30", reason: "Forgot to record departure" });
    expect(state.attempts[1]).toEqual(state.attempts[0]);
});
