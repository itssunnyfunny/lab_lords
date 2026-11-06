import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { chromium, expect as browserExpect } from "@playwright/test";
import { createServer } from "node:http";
import { spawn, type ChildProcess } from "node:child_process";
import { mkdirSync, createWriteStream } from "node:fs";
import type { AddressInfo } from "node:net";
const fixture = vi.hoisted(() => ({ user: null as { id: string } | null, dispatch: vi.fn(), provider: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getSessionUser: async () => fixture.user }));
vi.mock("@/ai/llm/gemini.client", () => ({ callGeminiJson: fixture.provider, resolveGeminiProModel: () => "deterministic-browser-provider" }));
vi.mock("@/importing/services/import-workflow", () => ({ ImportWorkflowService: { tryStartRun: fixture.dispatch } }));
import * as sessions from "@/app/api/branches/[branchId]/import-sessions/route";
import * as detail from "@/app/api/branches/[branchId]/import-sessions/[sessionId]/route";
import * as analysis from "@/app/api/branches/[branchId]/import-sessions/[sessionId]/analyze/route";
import * as interpretation from "@/app/api/branches/[branchId]/import-sessions/[sessionId]/interpretations/route";
import * as rows from "@/app/api/branches/[branchId]/import-sessions/[sessionId]/rows/route";
import * as preview from "@/app/api/branches/[branchId]/import-sessions/[sessionId]/rows/preview/route";
import * as availability from "@/app/api/branches/[branchId]/import-sessions/[sessionId]/availability/route";
import * as mapping from "@/app/api/branches/[branchId]/import-sessions/[sessionId]/mapping/route";
import * as plans from "@/app/api/branches/[branchId]/import-sessions/[sessionId]/plans/route";
import * as payments from "@/app/api/branches/[branchId]/import-sessions/[sessionId]/plans/[planId]/payments/route";
import * as paymentChoices from "@/app/api/branches/[branchId]/import-sessions/[sessionId]/payments/route";
import * as commit from "@/app/api/branches/[branchId]/import-sessions/[sessionId]/commit/route";
import * as runDetail from "@/app/api/branches/[branchId]/import-runs/[runId]/route";
import * as accessRoute from "@/app/api/branches/[branchId]/access/route";
import * as recipes from "@/app/api/branches/[branchId]/import-recipes/route";
import { ImportSessionService } from "@/importing/services/import-session.service";
import { ImportRunRunner } from "@/importing/services/import-runner.service";
import { ImportRunExecutor } from "@/importing/services/import-run-executor.service";
import { createTestWorld, createSaasSubscription, createShift, createSeat } from "@/tests/factories";
import { resetDatabase, disconnectDatabase, testPrisma as db } from "@/tests/setup/db";
import type { ImportNormalizedRow } from "@/importing/contracts/import-session.contract";

let vite: ChildProcess | undefined;
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
type Route = (req: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>;
describe("retained V1 guided import browser → real route → real service → disposable PostgreSQL", () => {
    beforeEach(async () => { await resetDatabase(); vi.stubEnv("IMPORT_V2_ENABLED", "true"); vi.stubEnv("IMPORT_MAX_PLANNED_MUTATIONS", "1000"); });
    afterEach(() => { vite?.kill(); vi.unstubAllEnvs(); });
    afterAll(disconnectDatabase);
    it.each([{ width: 1440, height: 1000 }, { width: 390, height: 844 }])("prepares, clarifies, allocates, reviews, commits and recovers at $width px", async viewport => {
        const f = await createTestWorld(); fixture.user = { id: f.user.id };
        await db.organization.update({ where: { id: f.org.id }, data: { billingModelVersion: "WORKSPACE_V2" } });
        await createSaasSubscription({ organizationId: f.org.id, plan: "BASIC" });
        const fullDay = await createShift({ branchId: f.branch.id, name: "Full Day", price: 1000, startTime: "06:00", endTime: "18:00" });
        const evening = await createShift({ branchId: f.branch.id, name: "Evening", startTime: "18:00", endTime: "23:00" });
        await db.multiShift.create({ data: { branchId: f.branch.id, name: "Morning Evening", price: 1500, components: { create: [{ shiftId: f.shift.id, order: 0 }, { shiftId: evening.id, order: 1 }] } } });
        const secondSeat = await createSeat({ branchId: f.branch.id, label: "B2" });
        await createSeat({ branchId: f.branch.id, label: "C3" });
        fixture.provider.mockReset().mockResolvedValue({ ok: false, error: "Deterministic provider failure; manual correction remains available" });
        let injectAllocationFailure = true;
        let injectPaymentFailure = true;
        fixture.dispatch.mockImplementation(async run => {
            if (run.kind === "ANALYSIS") {
                await ImportSessionService.analyzeSession(f.user.id, f.branch.id, run.importSessionId, run.targetRevision);
                await ImportRunRunner.setAnalysisStatus({ importRunId: run.id, status: "COMPLETED" });
            } else {
                for (let pass = 0; pass < 20; pass++) {
                    const batch = await ImportRunRunner.claimBatch({ importRunId: run.id, workerId: "connected-browser", limit: 25 });
                    if (!batch.length) break;
                    for (const item of batch) {
                        if (injectAllocationFailure && item.kind === "ALLOCATION" && item.normalizedData?.student?.name === "Ambiguous Student") {
                            injectAllocationFailure = false;
                            await ImportRunRunner.failItem({ importRunId: run.id, itemId: item.id, leaseToken: item.leaseToken, error: { code: "FIXTURE_SEAT_CHANGED", message: "Seat availability changed after review.", retryable: false } });
                        } else if (injectPaymentFailure && item.kind === "PAYMENT_CYCLE" && item.normalizedData?.student?.name === "Payment Recovery Student") {
                            injectPaymentFailure = false;
                            await ImportRunRunner.failItem({ importRunId: run.id, itemId: item.id, leaseToken: item.leaseToken, error: { code: "FIXTURE_PAYMENT_FAILURE", message: "Synthetic payment operation failure.", retryable: false } });
                        } else await ImportRunExecutor.executeClaimedItem(item);
                    }
                }
                await ImportRunRunner.finalizeRun(run.id);
            }
            const current = await db.importRun.findUniqueOrThrow({ where: { id: run.id } });
            return { run: current, dispatchPending: false, workflowAttached: false, dispatchRequired: false };
        });
        const failures: string[] = [];
        const routes: Record<string, unknown> = { "": sessions, detail, analyze: analysis, interpretations: interpretation, rows, "rows/preview": preview, availability, mapping, plans, "plans/payments": payments, payments: paymentChoices, commit, run: runDetail, recipes };
        const server = createServer(async (incoming, outgoing) => {
            try {
                const url = new URL(incoming.url!, "http://127.0.0.1");
                if (url.pathname === "/api/users/me") { outgoing.setHeader("Content-Type", "application/json"); outgoing.end(JSON.stringify({ interfaceLanguage: "en", timezone: "Asia/Kolkata", locale: "en-IN" })); return; }
                const match = url.pathname.match(/^\/api\/branches\/([^/]+)\/(import-sessions|import-runs|import-recipes|access)(?:\/([^/]+))?(?:\/(.*))?$/);
                let route: Route | undefined;
                let params: Record<string, string> = { branchId: f.branch.id };
                if (url.pathname === "/api/fixture/access") route = accessRoute.GET as unknown as Route;
                else if (match) {
                    params = { branchId: match[1], sessionId: match[3] ?? "", runId: match[3] ?? "" };
                    let key = match[2] === "import-runs" ? "run" : match[2] === "import-recipes" ? "recipes" : match[3] ? match[4] ?? "detail" : "";
                    if (key.startsWith("plans/") && key.endsWith("/payments")) { params.planId = key.split("/")[1]; key = "plans/payments"; }
                    const routeModule = match[2] === "access" ? accessRoute : routes[key];
                    route = (routeModule as Record<string, Route> | undefined)?.[incoming.method!];
                }
                if (!route) throw new Error(`Unmapped test route ${incoming.method} ${url.pathname}`);
                const chunks: Buffer[] = []; let bytes = 0;
                for await (const chunk of incoming) { bytes += chunk.length; if (bytes > 4.25 * 1024 * 1024) throw new Error("Fixture request limit"); chunks.push(chunk); }
                const request = new Request(url, { method: incoming.method, headers: incoming.headers as HeadersInit, ...(bytes ? { body: Buffer.concat(chunks) } : {}) });
                const result = await route(request, { params: Promise.resolve(params) });
                outgoing.statusCode = result.status; result.headers.forEach((value, key) => outgoing.setHeader(key, value));
                outgoing.end(Buffer.from(await result.arrayBuffer()));
                if (result.status >= 400) failures.push(`${incoming.method} ${url.pathname}: ${result.status}`);
            } catch (error) { failures.push(String(error)); outgoing.statusCode = 500; outgoing.end(JSON.stringify({ error: "Connected fixture failed" })); }
        });
        await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
        mkdirSync("test-results/import-connected", { recursive: true });
        const log = createWriteStream(`test-results/import-connected/server-${viewport.width}.log`);
        vite = spawn(process.execPath, ["tests/import-browser/server.mjs"], { env: { ...process.env, IMPORT_FIXTURE_API: `http://127.0.0.1:${(server.address() as AddressInfo).port}` }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        vite.stdout!.pipe(log); vite.stderr!.pipe(log);
        const browser = await chromium.launch({ headless: true });
        try {
            for (let attempt = 0; attempt < 100; attempt++) { if (await fetch("http://127.0.0.1:4194").then(r => r.ok).catch(() => false)) break; await pause(500); }
            const context = await browser.newContext({ viewport, locale: "en-IN", timezoneId: "Asia/Kolkata" });
            const page = await context.newPage(); const consoleErrors: string[] = [];
            page.on("pageerror", error => consoleErrors.push(error.message));
            let staleReviewResponse = false;
            page.on("console", message => {
                if (message.type() !== "error") return;
                if (staleReviewResponse && /Failed to load resource:.*409/.test(message.text())) {
                    staleReviewResponse = false;
                    return;
                }
                consoleErrors.push(message.text());
            });
            // Derive dates from the established runtime business date, rather than
            // faking browser-only time while real server billing uses another day.
            const now = new Date(); const joined = `${now.getFullYear() - 1}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
            const table = `Name\tPhone\tJoined Date\tMonthly Fee\tShift\tSeat\nReady Student\t9876501001\t${joined}\t1000\tMorning\t${f.seat.label}\nAmbiguous Student\t9876501002\t\t1000\tFD\t${secondSeat.label}\nDeferred Student\t9876501003\t${joined}\t1000\tF.D.\t`;
            // This fixture explicitly covers retained V1 drafts and recovery.
            // New uploads and the real all-plan shell are covered by
            // tests/browser/owner-setup-connected.spec.ts with normal auth.
            const retained = await ImportSessionService.createSession(f.user.id, f.branch.id, {
                sourceType: "PASTED_TABLE", experience: "GUIDED_CURRENT_MONTH_V1", pastedTable: table, goal: "FULL",
            });
            await fixture.dispatch(retained.analysisRun);
            await page.goto(`http://127.0.0.1:4194/branch/${f.branch.id}/onboarding/import/${retained.id}`);
            await browserExpect(page.getByRole("heading", { name: "Check your students", exact: true })).toBeVisible();
            await browserExpect(page.getByText("Fix these first", { exact: true })).toHaveCount(0);
            expect(await db.student.count()).toBe(0);
            const fdGroup = page.getByText("What does “FD” mean?", { exact: true }).locator("..");
            await browserExpect(fdGroup).toBeVisible();
            await fdGroup.getByRole("combobox").selectOption(fullDay.id);
            await fdGroup.getByRole("button", { name: "Confirm for matching students" }).click();
            await browserExpect(page.getByText(/Meaning applied to matching students/)).toBeVisible();
            fixture.provider.mockImplementation(async (prompt: string) => {
                const current = JSON.parse(prompt.match(/opaque structural context\):\n([^\n]+)/)![1]);
                const assistance = current.shiftAssistance;
                expect(prompt).toContain('Uploaded columns:\n[]');
                for (const raw of ["Deferred Student", "Full Day", "F.D.", fullDay.id]) expect(prompt).not.toContain(raw);
                return { ok: true, data: { entityTypesDetected: ["STUDENT"], columnMappings: [], questions: [], warnings: [],
                    draftShiftProposals: assistance.groups.flatMap((group: { sourceAlias: string; meaningAlias: string }) => {
                        const answer = assistance.answers.find((answer: { meaningAlias: string }) => answer.meaningAlias === group.meaningAlias);
                        return answer ? [{ sourceAlias: group.sourceAlias, choiceAlias: answer.choiceAlias, answerAlias: answer.answerAlias }] : [];
                    }) } };
            });
            await page.getByRole("button", { name: "Prepare remaining records", exact: true }).click();
            await browserExpect(page.getByText("Students updated from your confirmed meanings: 1", { exact: true })).toBeVisible();
            await browserExpect(page.getByRole("button", { name: "Prepare remaining records", exact: true })).toHaveCount(0);
            const prepared = (await db.importRow.findMany({ where: { branchId: f.branch.id } })).find(row => (row.normalizedData as ImportNormalizedRow)?.student?.name === "Deferred Student")!;
            expect(prepared.normalizedData).toMatchObject({ allocation: { shiftName: "Full Day" } });
            expect(fixture.provider).toHaveBeenCalledOnce();
            expect(await db.student.count()).toBe(0);
            await page.getByRole("article").filter({ hasText: "Ambiguous Student" }).getByRole("button", { name: "Confirm joining date", exact: true }).click();
            await browserExpect(page.getByLabel("Joined date", { exact: true })).toBeFocused();
            await page.getByRole("tab", { name: "This month's fees", exact: true }).click();
            await browserExpect(page.getByLabel("Payment amount", { exact: true })).toHaveValue("");
            await page.getByRole("tab", { name: "Student details", exact: true }).click();
            await page.getByLabel("Joined date", { exact: true }).fill(joined);
            await page.getByRole("button", { name: "Back to student list", exact: true }).click();
            await browserExpect(page.getByText("Save or reset your edits before continuing.", { exact: true })).toBeVisible();
            await browserExpect(page.getByLabel("Joined date", { exact: true })).toHaveValue(joined);
            await page.getByRole("tab", { name: "Student details", exact: true }).focus();
            await page.keyboard.press("ArrowRight");
            await browserExpect(page.getByRole("tab", { name: "Seat and timings", exact: true })).toHaveAttribute("aria-selected", "true");
            await page.keyboard.press("ArrowLeft");
            await page.getByLabel("Monthly fee", { exact: true }).fill("-300");
            await page.getByRole("button", { name: "Save draft", exact: true }).click();
            await browserExpect(page.getByText("Use whole non-negative rupee amounts. Recorded amounts will not be rounded.")).toBeVisible();
            await page.getByLabel("Monthly fee", { exact: true }).fill("1200");
            await page.getByRole("button", { name: "Save draft", exact: true }).click();
            await browserExpect.poll(async () => (await db.importRow.findMany({ where: { branchId: f.branch.id } })).find(row => (row.normalizedData as ImportNormalizedRow)?.student?.name === "Ambiguous Student")?.normalizedData).toMatchObject({ student: { monthlyFee: 1200 } });
            await page.getByRole("button", { name: "Back to student list", exact: true }).click();
            await page.getByRole("tab", { name: /^All students/ }).click();
            await page.getByRole("button", { name: /Ambiguous Student/ }).click();
            await browserExpect(page.getByLabel("Monthly fee", { exact: true })).toHaveValue("1200");
            await page.getByRole("tab", { name: "This month's fees", exact: true }).click();
            await browserExpect(page.getByLabel("Payment amount", { exact: true })).toHaveValue("");
            await page.getByRole("tab", { name: "Seat and timings", exact: true }).click();
            await page.getByRole("checkbox", { name: "Link fee to selected price" }).check();
            await page.getByRole("tab", { name: "Student details", exact: true }).click();
            await browserExpect(page.getByLabel("Monthly fee", { exact: true })).toHaveValue("1000");
            await page.getByRole("tab", { name: "Seat and timings", exact: true }).click();
            await page.getByRole("button", { name: /Morning Evening, .*seats free/ }).click();
            await page.getByRole("tab", { name: "Student details", exact: true }).click();
            await browserExpect(page.getByLabel("Monthly fee", { exact: true })).toHaveValue("1500");
            await page.getByRole("tab", { name: "This month's fees", exact: true }).click();
            await browserExpect(page.getByLabel("Payment amount", { exact: true })).toHaveValue("");
            await page.getByRole("tab", { name: "Seat and timings", exact: true }).click();
            await page.getByRole("searchbox", { name: "Search seats" }).fill("C3");
            await page.getByRole("button", { name: /^C3,/ }).focus();
            await page.keyboard.press("Enter");
            const sessionPath = `/api/branches/${f.branch.id}/import-sessions/${new URL(page.url()).pathname.split("/").at(-1)}`;
            let attentionRequests = 0; let nextEntered!: () => void; let releaseNext!: () => void;
            const nextPending = new Promise<void>(resolve => { nextEntered = resolve; });
            const nextReleased = new Promise<void>(resolve => { releaseNext = resolve; });
            const attentionUrl = (url: URL) => url.pathname === sessionPath && url.searchParams.has("rowFilter");
            await page.route(attentionUrl, async route => {
                if (++attentionRequests === 2) { nextEntered(); await nextReleased; }
                await route.continue();
            });
            await page.getByRole("button", { name: "Save draft", exact: true }).click();
            await browserExpect(page.getByText(/saved to draft, not imported/)).toBeVisible();
            await page.getByRole("button", { name: "Review next student", exact: true }).click();
            await nextPending;
            try { await browserExpect(page.getByRole("button", { name: /^Review and save/ })).toBeDisabled(); }
            finally { releaseNext(); }
            await browserExpect(page.getByRole("button", { name: /^Review and save/ })).toBeEnabled();
            await page.unroute(attentionUrl);
            await page.reload();
            await browserExpect(page.getByRole("heading", { name: "Check your students", exact: true })).toBeVisible();
            await browserExpect(page.getByRole("heading", { name: "Your students are ready to review", exact: true })).toBeVisible();
            await browserExpect(page.getByRole("tab", { name: /^Ready for review/ })).toHaveAttribute("aria-selected", "true");
            const corrected = (await db.importRow.findMany({ where: { branchId: f.branch.id } })).find(row => (row.normalizedData as ImportNormalizedRow)?.student?.name === "Ambiguous Student")!;
            expect((corrected.normalizedData as ImportNormalizedRow).student?.monthlyFee).toBe(1500);
            expect((corrected.normalizedData as ImportNormalizedRow).payment).toBeUndefined();
            expect((corrected.issues as Array<{ code: string }>).some(issue => issue.code === "PARTIAL_PAYMENT_REVIEW")).toBe(false);
            const reviewUrl = (url: URL) => url.pathname === `${sessionPath}/plans`;
            const concurrentEdit = viewport.width === 1440;
            await page.route(reviewUrl, async route => {
                if (concurrentEdit) {
                    const current = await ImportSessionService.getSessionDetail(f.user.id, f.branch.id, sessionPath.split("/").at(-1)!);
                    await ImportSessionService.updateMapping(f.user.id, f.branch.id, current.id, {
                        expectedRevision: current.draftRevision,
                        columnMappings: current.mapping.columnMappings,
                    });
                }
                staleReviewResponse = true;
                await route.fulfill({ status: 409, json: concurrentEdit
                    ? { code: "IMPORT_REVISION_CONFLICT", error: "This import changed in another tab. Refresh before saving again." }
                    : { code: "IMPORT_BUSINESS_DATE_CHANGED", error: "The business date changed. Refresh payment outcomes and review a new plan before importing." } });
            }, { times: 1 });
            await page.getByRole("button", { name: /^Review and save/ }).click();
            await browserExpect(page.getByRole("alert").filter({ hasText: concurrentEdit ? /changed in another tab/ : /The business date changed/ })).toBeVisible();
            expect(await db.student.count()).toBe(0);
            await page.getByRole("button", { name: "Refresh review", exact: true }).click();
            await browserExpect(page.getByRole("heading", { name: "This month's fees" })).toBeVisible();
            expect(await db.student.count()).toBe(0);
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            await page.screenshot({ path: `test-results/import-connected/review-${viewport.width}.png`, fullPage: true });
            await page.getByRole("button", { name: "Confirm and save", exact: true }).click();
            await browserExpect(page.getByRole("alertdialog")).toBeVisible();
            await page.getByRole("alertdialog").getByRole("button", { name: "Confirm import", exact: true }).click();
            await browserExpect.poll(() => db.student.count()).toBe(3);
            const session = await db.importSession.findFirstOrThrow({ where: { branchId: f.branch.id } });
            await browserExpect.poll(async () => (await db.importSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe("PARTIAL");
            await page.screenshot({ path: `test-results/import-connected/result-${viewport.width}.png`, fullPage: true });
            // Persisted partial progress is recovered after a real browser refresh.
            await page.reload();
            const repair = page.getByRole("button", { name: "Finish the remaining work", exact: true });
            await repair.click();
            await page.getByRole("button", { name: /Ambiguous Student/ }).click();
            await page.getByRole("tab", { name: "Student details", exact: true }).click();
            await browserExpect(page.getByLabel("Monthly fee", { exact: true })).toBeDisabled();
            await page.getByRole("tab", { name: "Seat and timings", exact: true }).click();
            await browserExpect(page.getByRole("checkbox", { name: "Link fee to selected price" })).toBeDisabled();
            await page.getByRole("button", { name: /Full Day, .*seats free/ }).click();
            await page.getByRole("tab", { name: "Student details", exact: true }).click();
            await browserExpect(page.getByLabel("Monthly fee", { exact: true })).toHaveValue("1500");
            await page.getByRole("tab", { name: "Seat and timings", exact: true }).click();
            await page.getByRole("button", { name: /Morning Evening, .*seats free/ }).click();
            await page.getByRole("searchbox", { name: "Search seats" }).fill("B2");
            await page.getByRole("button", { name: /^B2,/ }).click();
            await page.getByRole("button", { name: "Save draft", exact: true }).click();
            await page.getByRole("button", { name: "Back to student list", exact: true }).click();
            await page.getByRole("button", { name: /^Review and save/ }).click();
            await page.getByRole("button", { name: "Confirm and save", exact: true }).click();
            await page.getByRole("alertdialog").getByRole("button", { name: "Confirm import", exact: true }).click();
            await browserExpect.poll(async () => (await db.importSession.findUniqueOrThrow({ where: { id: session.id } })).status).toBe("COMMITTED");
            expect(await db.student.count()).toBe(3);
            const student = await db.student.findFirstOrThrow({ where: { name: "Ambiguous Student" } });
            expect(await db.seatAllocation.count({ where: { studentId: student.id, endDate: null } })).toBe(2);
            expect(await db.payment.count({ where: { studentId: student.id } })).toBe(1);
            expect((await db.payment.findFirstOrThrow({ where: { studentId: student.id } })).amount).toBe(1500);
            expect(student.billingStartAt).not.toBeNull();
            const paymentSeat = await createSeat({ branchId: f.branch.id, label: "D4" });
            const paymentRecovery = await ImportSessionService.createSession(f.user.id, f.branch.id, {
                sourceType: "PASTED_TABLE", experience: "GUIDED_CURRENT_MONTH_V1",
                pastedTable: `Name\tPhone\tJoined Date\tMonthly Fee\tShift\tSeat\tPayment Status\tPayment Method\tPaid Amount\nPayment Recovery Student\t9876501999\t${joined}\t1000\tFull Day\t${paymentSeat.label}\tPAID\tCASH\t1000`,
            });
            await ImportSessionService.analyzeSession(f.user.id, f.branch.id, paymentRecovery.id);
            await ImportRunRunner.setAnalysisStatus({ importRunId: paymentRecovery.analysisRun.id, status: "COMPLETED" });
            await page.goto(`http://127.0.0.1:4194/branch/${f.branch.id}/onboarding/import/${paymentRecovery.id}`);
            await page.getByRole("button", { name: /^Review and save/ }).click();
            await page.getByRole("button", { name: "Confirm and save", exact: true }).click();
            await page.getByRole("alertdialog").getByRole("button", { name: "Confirm import", exact: true }).click();
            await browserExpect.poll(async () => (await db.importSession.findUniqueOrThrow({ where: { id: paymentRecovery.id } })).status).toBe("PARTIAL");
            const retainedStudent = await db.student.findFirstOrThrow({ where: { name: "Payment Recovery Student" } });
            const retainedSeat = await db.seatAllocation.findFirstOrThrow({ where: { studentId: retainedStudent.id, endDate: null } });
            expect(await db.payment.count({ where: { studentId: retainedStudent.id } })).toBe(0);
            await repair.click();
            await page.getByRole("button", { name: /Payment Recovery Student/ }).click();
            await page.getByRole("tab", { name: "Seat and timings", exact: true }).click();
            await browserExpect(page.getByRole("searchbox", { name: "Search seats" })).toBeDisabled();
            await browserExpect(page.getByRole("button", { name: "Add seating later", exact: true })).toHaveCount(0);
            await page.getByRole("tab", { name: "This month's fees", exact: true }).click();
            await browserExpect(page.getByLabel("Payment amount", { exact: true })).toBeEnabled();
            await page.getByRole("button", { name: "Recheck student for retry", exact: true }).click();
            await page.getByRole("button", { name: "Back to student list", exact: true }).click();
            await page.getByRole("button", { name: /^Review and save/ }).click();
            await page.getByRole("button", { name: "Confirm and save", exact: true }).click();
            await page.getByRole("alertdialog").getByRole("button", { name: "Confirm import", exact: true }).click();
            await browserExpect.poll(async () => (await db.importSession.findUniqueOrThrow({ where: { id: paymentRecovery.id } })).status).toBe("COMMITTED");
            expect(await db.seatAllocation.findMany({ where: { studentId: retainedStudent.id, endDate: null }, select: { id: true } })).toEqual([{ id: retainedSeat.id }]);
            expect(await db.payment.count({ where: { studentId: retainedStudent.id } })).toBe(1);
            // Recover a saved PDF draft from its URL, without the entry page's
            // transient confirmation state. Extraction itself has parser tests.
            const pdf = await db.importSession.create({ data: { branchId: f.branch.id, uploadedByUserId: f.user.id, engineVersion: 2, goal: "FULL", sourceType: "PDF", status: "UPLOADED",
                sourceConfiguration: { experience: "GUIDED_CURRENT_MONTH_V1", pdfConfirmed: false }, fileMeta: { columns: ["Name", "Joined Date", "Monthly Fee", "Paid Amount", "Payment Status", "Payment Method"] },
                rows: { create: { rowNumber: 1, rawData: { Name: "PDF Student", "Joined Date": joined, "Monthly Fee": "1000", "Paid Amount": "300.50", "Payment Status": "PAID", "Payment Method": "CASH" } } } } });
            const { ImportRunService } = await import("@/importing/services/import-run.service");
            const pdfRun = await ImportRunService.createOrGetRun({ userId: f.user.id, branchId: f.branch.id, sessionId: pdf.id, kind: "ANALYSIS", targetRevision: 0, idempotencyKey: `pdf-fixture-${viewport.width}` });
            await ImportRunRunner.setAnalysisStatus({ importRunId: pdfRun.id, status: "WAITING_FOR_USER" });
            await page.goto(`http://127.0.0.1:4194/branch/${f.branch.id}/onboarding/import/${pdf.id}`);
            await browserExpect(page.getByText(/Name: PDF Student/)).toBeVisible();
            await browserExpect(page.getByRole("button", { name: "Prepare remaining records", exact: true })).toHaveCount(0);
            await page.getByRole("button", { name: "Confirm PDF extraction and prepare", exact: true }).click();
            await browserExpect.poll(async () => (await db.importSession.findUniqueOrThrow({ where: { id: pdf.id } })).activeEvaluationRevision).toBe(1);
            await page.getByRole("article").filter({ hasText: "PDF Student" }).getByRole("button", { name: "Confirm payment information", exact: true }).click();
            await browserExpect(page.getByLabel("Payment amount", { exact: true })).toHaveValue("300.50");
            await page.getByLabel("Payment amount", { exact: true }).fill("300.50 ");
            await page.getByRole("button", { name: "Save draft", exact: true }).click();
            await browserExpect(page.getByText("Use whole non-negative rupee amounts. Recorded amounts will not be rounded.")).toBeVisible();
            await page.getByLabel("Payment amount", { exact: true }).fill("300");
            await page.getByRole("tab", { name: "Student details", exact: true }).click();
            await page.getByLabel("Monthly fee", { exact: true }).fill("1200");
            await page.getByRole("tab", { name: "Seat and timings", exact: true }).click();
            await page.getByRole("checkbox", { name: "Link fee to selected price" }).check();
            await page.getByRole("button", { name: /Morning Evening, .*seats free/ }).click();
            await page.getByRole("tab", { name: "Student details", exact: true }).click();
            await browserExpect(page.getByLabel("Monthly fee", { exact: true })).toHaveValue("1500");
            await page.getByRole("tab", { name: "This month's fees", exact: true }).click();
            await browserExpect(page.getByLabel("Payment amount", { exact: true })).toHaveValue("300");
            await page.getByRole("button", { name: "Save draft", exact: true }).click();
            await browserExpect.poll(async () => (await db.importRow.findFirstOrThrow({ where: { importSessionId: pdf.id } })).normalizedData).toMatchObject({ student: { monthlyFee: 1500 }, payment: { amount: 300 } });
            await browserExpect.poll(async () => ((await db.importRow.findFirstOrThrow({ where: { importSessionId: pdf.id } })).issues as Array<{ code: string }>).some(issue => issue.code === "PARTIAL_PAYMENT_REVIEW")).toBe(true);
            for (const language of ["hi", "hinglish"]) {
                await page.evaluate(language => window.dispatchEvent(new CustomEvent("lablords:preferences-updated", { detail: { ownerKey: "synthetic-import-owner", interfaceLanguage: language } })), language);
                await browserExpect(page.getByRole("heading", { name: language === "hi" ? "अपने छात्रों को जाँचें" : "Apne students check karein", exact: true })).toBeVisible();
                await page.screenshot({ path: `test-results/import-connected/${language}-${viewport.width}.png`, fullPage: true });
            }
            expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
            expect(consoleErrors).toEqual([]); expect(failures).toEqual([]);
            await context.close();
        } finally { await browser.close(); vite.kill(); await new Promise<void>(resolve => server.close(() => resolve())); log.end(); }
    });
});
