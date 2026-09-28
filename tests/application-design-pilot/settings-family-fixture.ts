import type { Page } from "@playwright/test";

/** Existing dashboard-settings requests, held entirely inside the visual harness. */
export async function installSettingsFixture(page: Page) {
    const commands: Array<{ path: string; body: Record<string, unknown> }> = [];
    let utilizationThreshold = 30;
    const expectations = [{ studentId: "student-aarav", weekdays: [1, 3, 5], expectedBy: "09:00", enabled: true }];
    const students = [{ id: "student-aarav", name: "Aarav Mehta" }, { id: "student-nisha", name: "Nisha Verma" }];
    const terms = [{ id: "term-a", studentId: "student-aarav", studentName: "Aarav Mehta", label: "Quarterly", startDate: "2026-07-01T00:00:00.000Z", endDate: "2026-09-30T00:00:00.000Z" }];
    for (const ending of ["settings", "expectations", "terms"] as const) {
        await page.route(`**/api/branches/pilot/dashboard/${ending}`, route => {
            const request = route.request();
            if (request.method() === "POST") {
                const body = request.postDataJSON() as Record<string, unknown>;
                commands.push({ path: new URL(request.url()).pathname, body });
                if (ending === "settings") utilizationThreshold = Number(body.utilizationThreshold);
                if (ending === "expectations") {
                    const index = expectations.findIndex(item => item.studentId === body.studentId);
                    const next = { studentId: String(body.studentId), weekdays: body.weekdays as number[], expectedBy: String(body.expectedBy), enabled: Boolean(body.enabled) };
                    if (index >= 0) expectations[index] = next; else expectations.push(next);
                }
                if (ending === "terms") terms.push({ id: "term-new", studentId: String(body.studentId), studentName: students.find(student => student.id === body.studentId)?.name ?? "Student", label: String(body.label), startDate: `${body.startDate}T00:00:00.000Z`, endDate: `${body.endDate}T00:00:00.000Z` });
                return route.fulfill({ json: { success: true } });
            }
            return route.fulfill({ json: ending === "settings" ? { utilizationThreshold } : ending === "expectations" ? { items: expectations, students } : { items: terms, students } });
        });
    }
    return commands;
}
