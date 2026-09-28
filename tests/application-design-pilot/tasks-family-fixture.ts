import type { Page } from "@playwright/test";
import type { DashboardTask, DashboardNotification } from "@/lib/dashboardContracts";

/** Deterministic task/activity history only in the isolated component harness. */
export async function installTasksFixture(page: Page) {
    let rows: DashboardTask[] = [
        { id: "synthetic-open-1", title: "Review evening shift roster", status: "OPEN", dueAt: "2026-09-23T13:00:00.000Z", assigneeId: "synthetic-owner", assigneeName: "Aditi Sharma", createdAt: "2026-09-20T08:00:00.000Z", updatedAt: "2026-09-22T09:00:00.000Z" },
        { id: "synthetic-open-2", title: "Follow up on a very long accessibility and seating request that should wrap without truncating any words", status: "OPEN", dueAt: null, assigneeId: null, assigneeName: null, createdAt: "2026-09-21T08:00:00.000Z", updatedAt: "2026-09-22T10:00:00.000Z" },
        { id: "synthetic-done-1", title: "Check entry desk supplies", status: "DONE", dueAt: "2026-09-24T05:30:00.000Z", assigneeId: "synthetic-manager", assigneeName: "Rohan Patel", createdAt: "2026-09-18T08:00:00.000Z", updatedAt: "2026-09-22T11:00:00.000Z" },
    ];
    const sourceItems: DashboardNotification[] = [
        { key: "overdue-synthetic", kind: "OVERDUE", count: 2, href: "/branch/pilot/overdue", read: false, snoozedUntil: null, dismissed: false },
        { key: "task-synthetic", kind: "TASK", count: 1, href: "/branch/pilot/tasks", read: false, snoozedUntil: null, dismissed: false },
        { key: "attendance-synthetic", kind: "ATTENDANCE", count: 1, href: "/branch/pilot/attendance", read: false, snoozedUntil: null, dismissed: false },
    ];
    const commands: Array<{ method: string; path: string; body: Record<string, unknown> }> = [];
    let failSave = false; let failRead = false; let failSource = false;
    await page.route("**/api/branches/pilot/dashboard/tasks**", async route => {
        const url = new URL(route.request().url()); const method = route.request().method();
        if (method === "GET") {
            if (failRead) return route.fulfill({ status: 503, json: { error: "Synthetic task read failed" } });
            const location = new URL(page.url());
            const matching = location.searchParams.get("state") === "empty" ? [] : rows.filter(row =>
                (url.searchParams.get("status") === "ALL" || row.status === url.searchParams.get("status")) &&
                row.title.toLowerCase().includes((url.searchParams.get("search") ?? "").toLowerCase()));
            const paged = location.searchParams.get("scenario") === "pagination";
            const items = paged ? url.searchParams.has("cursor") ? matching.slice(1) : matching.slice(0, 1) : matching;
            return route.fulfill({ json: { items, assignees: [{ id: "synthetic-owner", name: "Aditi Sharma" }, { id: "synthetic-manager", name: "Rohan Patel" }], nextCursor: paged && !url.searchParams.has("cursor") && matching.length > 1 ? "synthetic-next" : null } });
        }
        const body = route.request().postDataJSON() as Record<string, unknown>;
        commands.push({ method, path: url.pathname, body });
        if (failSave) return route.fulfill({ status: 503, json: { error: "Synthetic task save failed" } });
        if (method === "POST") {
            const row: DashboardTask = { id: "synthetic-created", title: String(body.title), status: "OPEN", dueAt: body.dueAt as string | null, assigneeId: body.assigneeId as string | null, assigneeName: body.assigneeId === "synthetic-owner" ? "Aditi Sharma" : body.assigneeId === "synthetic-manager" ? "Rohan Patel" : null, createdAt: "2026-09-22T12:00:00.000Z", updatedAt: "2026-09-22T12:00:00.000Z" };
            rows = [...rows, row]; return route.fulfill({ status: 201, json: row });
        }
        rows = rows.map(row => row.id !== url.pathname.split("/").at(-1) ? row : { ...row, ...body, assigneeName: body.assigneeId === "synthetic-owner" ? "Aditi Sharma" : body.assigneeId === "synthetic-manager" ? "Rohan Patel" : null, updatedAt: "2026-09-22T12:30:00.000Z" } as DashboardTask);
        return route.fulfill({ json: rows.find(row => row.id === url.pathname.split("/").at(-1)) });
    });
    await page.route("**/api/branches/pilot/dashboard/notifications", route => failSource ? route.fulfill({ status: 503, json: { error: "Synthetic source read failed" } }) : route.fulfill({ json: { items: new URL(page.url()).searchParams.get("role") === "restricted" ? sourceItems.filter(item => item.kind === "ATTENDANCE") : sourceItems } }));
    await page.route("**/api/branches/pilot/dashboard", async route => {
        const response = await route.fetch(); const data = await response.json();
        data.activity = [...(data.activity ?? []), { id: "synthetic-task-event", kind: "TASK", occurredAt: "2026-09-22T12:00:00.000Z", detail: "CREATED", href: "/branch/pilot/tasks" }];
        return route.fulfill({ response, json: data });
    });
    return { commands, setFailSave(value: boolean) { failSave = value; }, setFailRead(value: boolean) { failRead = value; }, setFailSource(value: boolean) { failSource = value; } };
}
