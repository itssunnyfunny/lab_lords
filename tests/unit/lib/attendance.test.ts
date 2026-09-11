import { describe, expect, it } from "vitest";
import { attendanceDay, attendanceTimezone, attendanceDateSchema, effectiveAttendance, recordedMinutes } from "@/lib/attendance";
import { getBranchCapabilityDecision } from "@/lib/branchCapabilities";
import { buildStaffPermissions } from "@/services/branchActionPolicy";
import { hasBranchPageAccess } from "@/lib/branchPageAccess";
import type { BranchAccess } from "@/types";
describe("attendance dates, facts and permissions", () => {
    it("uses local date boundaries and organization timezone including DST", () => {
        expect(attendanceDay(new Date("2026-09-10T18:29:59Z"), "Asia/Kolkata")).toBe("2026-09-10");
        expect(attendanceDay(new Date("2026-09-10T18:30:00Z"), "Asia/Kolkata")).toBe("2026-09-11");
        expect(attendanceDay(new Date("2026-03-08T07:00:00Z"), "America/New_York")).toBe("2026-03-08");
        expect(attendanceTimezone("bad/zone")).toBe("Asia/Kolkata"); expect(attendanceTimezone(null)).toBe("Asia/Kolkata");
        expect(attendanceDateSchema.safeParse("2026-02-30").success).toBe(false);
    });
    it("manual present supplies no open visit or duration and closed visits establish present", () => {
        expect(effectiveAttendance(undefined, 0)).toBe("NOT_MARKED"); expect(effectiveAttendance("ABSENT", 0)).toBe("ABSENT");
        expect(effectiveAttendance("PRESENT", 0)).toBe("PRESENT"); expect(effectiveAttendance(undefined, 2)).toBe("PRESENT");
        expect(recordedMinutes("2026-09-11T01:00:00Z", null)).toBeNull();
        expect(recordedMinutes("2026-09-11T01:00:00Z", "2026-09-11T02:30:00Z")).toBe(90);
        expect(recordedMinutes("2026-09-11T01:00:00Z", "2026-09-10T01:00:00Z")).toBeNull();
    });
    it("aligns navigation and normal/correction capabilities without payment or analytics access", () => {
        const access: BranchAccess = { branchId: "b", branchName: "B", organizationId: "o", role: "STAFF", isOwner: false, effectivePlan: "BASIC", entitlements: [],
            permissions: { ...buildStaffPermissions("STAFF", []), view_payments: false, analytics: false } };
        expect(hasBranchPageAccess(access, "attendance")).toBe(true);
        expect(getBranchCapabilityDecision(access, "attendanceRecord").allowed).toBe(true);
        expect(getBranchCapabilityDecision(access, "attendanceCorrect").allowed).toBe(false);
        access.permissions.manage_branch = true; expect(getBranchCapabilityDecision(access, "attendanceCorrect").allowed).toBe(true);
        access.permissions.students = false; expect(hasBranchPageAccess(access, "attendance")).toBe(false);
        expect(getBranchCapabilityDecision(access, "attendanceRecord").allowed).toBe(false);
    });
});
