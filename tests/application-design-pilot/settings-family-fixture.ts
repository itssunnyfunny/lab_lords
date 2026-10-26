import type { Page } from "@playwright/test";

/** Existing dashboard-settings requests, held entirely inside the visual harness. */
export async function installSettingsFixture(page: Page) {
    const commands: Array<{ path: string; body: Record<string, unknown> }> = [];
    let utilizationThreshold = 30;
    const expectations = [{ id: "expectation-a", studentId: "student-aarav", studentName: "Aarav Mehta", weekdays: [1, 3, 5], expectedBy: "09:00", enabled: true }];
    const students = [{ id: "student-aarav", name: "Aarav Mehta" }, { id: "student-nisha", name: "Nisha Verma" }];
    const terms = [{ id: "term-a", studentId: "student-aarav", studentName: "Aarav Mehta", label: "Quarterly", startDate: "2026-07-01", endDate: "2026-09-30", status: "ACTIVE", revision: 1 }];
    for (const ending of ["settings", "expectations", "terms"] as const) {
        await page.route(new RegExp("/api/branches/pilot/dashboard/" + ending + "(?:[?].*)?$"), route => {
            const request = route.request();
            if (request.method() === "POST") {
                const body = request.postDataJSON() as Record<string, unknown>;
                commands.push({ path: new URL(request.url()).pathname, body });
                if (ending === "settings") utilizationThreshold = Number(body.utilizationThreshold);
                if (ending === "expectations") {
                    const index = expectations.findIndex(item => item.studentId === body.studentId);
                    const next = { id: "expectation-a", studentId: String(body.studentId), studentName: students.find(student => student.id === body.studentId)?.name ?? "Student", weekdays: body.weekdays as number[], expectedBy: String(body.expectedBy), enabled: Boolean(body.enabled) };
                    if (index >= 0) expectations[index] = next; else expectations.push(next);
                }
                if (ending === "terms") terms.push({ id: "term-new", studentId: String(body.studentId), studentName: students.find(student => student.id === body.studentId)?.name ?? "Student", label: String(body.label), startDate: String(body.startDate), endDate: String(body.endDate), status: "ACTIVE", revision: 1 });
                return route.fulfill({ json: { success: true } });
            }
            if (ending === "settings") return route.fulfill({ json: { utilizationThreshold } });
            const selectedId = new URL(request.url()).searchParams.get("studentId");
            const items = ending === "expectations" ? expectations : terms;
            return route.fulfill({ json: { items, students, nextCursor: null, studentNextCursor: null, total: items.length, studentTotal: students.length,
                selectedStudent: students.find(student => student.id === selectedId) ?? null,
                selectedItem: items.filter(item => item.studentId === selectedId).at(-1) ?? null } });
        });
    }
    return commands;
}
