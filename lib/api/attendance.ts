import type { AttendanceCommand, AttendanceHistory, AttendancePage, AttendanceVisitView } from "@/lib/attendance";
export class AttendanceRequestError extends Error {
    constructor(message: string, public uncertain: boolean) { super(message); }
}
async function request<T>(branchId: string, suffix: string, body?: unknown): Promise<T> {
    let response: Response;
    try { response = await fetch(`/api/branches/${encodeURIComponent(branchId)}/attendance${suffix}`, {
        ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}), cache: "no-store",
    }); } catch { throw new AttendanceRequestError("Connection lost. Retry the same action to confirm its result.", true); }
    let data;
    try { data = await response.json(); } catch { throw new AttendanceRequestError("Unable to confirm the result. Retry the same action.", true); }
    if (!response.ok) throw new AttendanceRequestError(data.error ?? "Attendance unavailable", response.status >= 500);
    return data;
}
export type AttendanceResult = { message: string; student?: { id: string; name: string }; visitId?: string; qr?: string; count?: number };
export const attendance = {
    list: (branchId: string, query: Record<string, string>) => request<AttendancePage>(branchId, `?${new URLSearchParams(query)}`),
    history: (branchId: string, query: Record<string, string>) => request<AttendanceHistory>(branchId, `?${new URLSearchParams(query)}`),
    command: (branchId: string, body: AttendanceCommand) => request<AttendanceResult>(branchId, "", body),
    lookup: (branchId: string, qr: string) => request<{ student: { id: string; name: string; status: string }; openVisit: AttendanceVisitView | null }>(branchId, "/lookup", { qr }),
};
