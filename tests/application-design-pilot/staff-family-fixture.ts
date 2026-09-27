import type { Page } from "@playwright/test";
import type { StaffWithUser } from "@/lib/api/staff";

/** Only isolated presentation tests; these records never enter an application DB. */
export async function installStaffFixture(page: Page) {
    let rows: StaffWithUser[] = [
        { id: "synthetic-manager", branchId: "pilot", userId: "synthetic-user-1", role: "MANAGER", createdAt: new Date("2026-08-01T00:00:00Z"), user: { id: "synthetic-user-1", name: "Aditi Sharma", email: "aditi@example.test" }, permissionOverrides: [] },
        { id: "synthetic-desk", branchId: "pilot", userId: "synthetic-user-2", role: "STAFF", createdAt: new Date("2026-09-01T00:00:00Z"), user: { id: "synthetic-user-2", name: "Rohan Patel", email: "rohan@example.test" }, permissionOverrides: [{ id: "synthetic-override", staffId: "synthetic-desk", action: "VIEW_PAYMENTS", allowed: false, createdAt: new Date(), updatedAt: new Date() }] },
        { id: "synthetic-long", branchId: "pilot", userId: "synthetic-user-3", role: "STAFF", createdAt: new Date("2026-09-12T00:00:00Z"), user: { id: "synthetic-user-3", name: "सिंथेटिक सदस्य आराध्या शर्मा लंबा नाम", email: "very.long.synthetic.address.for.wrapping@example.test" }, permissionOverrides: [] },
    ];
    let invites: Array<{ id: string; role: string; token: string; inviteUrl: string; createdAt: string; expiresAt: string }> = [];
    const commands: Array<{ method: string; path: string; body: unknown }> = [];
    await page.route("**/api/branches/pilot/staff**", async route => {
        const url = new URL(route.request().url()); const method = route.request().method();
        const query = new URL(page.url()).searchParams; const body = method === "POST" || method === "PATCH" ? route.request().postDataJSON() : null;
        if (method !== "GET") commands.push({ method, path: url.pathname, body });
        if (query.get("state") === "error" && method === "GET" && !url.pathname.includes("invites")) return route.fulfill({ status: 503, json: { error: "Synthetic staff read failed" } });
        if (url.pathname.includes("staff-invites")) {
            if (method === "POST") { const invite = { id: "synthetic-invite", role: body.role, token: "SYNTHETIC-NOT-A-CREDENTIAL", inviteUrl: "http://127.0.0.1:4187/invite/SYNTHETIC-NOT-A-CREDENTIAL", createdAt: "2026-09-22T00:00:00Z", expiresAt: "2026-09-29T00:00:00Z" }; invites = [invite]; return route.fulfill({ json: invite }); }
            if (method === "DELETE") { invites = []; return route.fulfill({ json: { success: true } }); }
            return route.fulfill({ json: invites });
        }
        if (method === "PATCH") {
            rows = rows.map(row => row.id !== url.pathname.split("/").at(-1) ? row : { ...row, role: body.role ?? row.role,
                permissionOverrides: body.permissions ? Object.entries(body.permissions).flatMap(([action, allowed]) => typeof allowed === "boolean" ? [{ id: "synthetic-" + action, staffId: row.id, action: action.toUpperCase(), allowed, createdAt: new Date(), updatedAt: new Date() } as NonNullable<StaffWithUser["permissionOverrides"]>[number]] : []) : row.permissionOverrides });
            return route.fulfill({ json: rows.find(row => row.id === url.pathname.split("/").at(-1)) });
        }
        if (method === "DELETE") { rows = rows.filter(row => row.id !== url.pathname.split("/").at(-1)); return route.fulfill({ json: { success: true } }); }
        if (method === "POST") { const row = { ...rows[0], id: "synthetic-added", role: body.role, user: { id: "synthetic-added-user", name: "Added synthetic member", email: body.email } }; rows.push(row); return route.fulfill({ json: row }); }
        const items = query.get("state") === "empty" ? [] : rows;
        const paged = query.get("scenario") === "pagination";
        return route.fulfill({ json: { items: paged ? url.searchParams.has("cursor") ? items.slice(1) : items.slice(0, 1) : items, nextCursor: paged && !url.searchParams.has("cursor") ? "synthetic-next" : null, total: items.length } });
    });
    return commands;
}
