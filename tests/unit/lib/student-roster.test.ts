import { describe, expect, it } from "vitest";
import {
    getStudentAllocationHref,
    getStudentDisplayName,
    getStudentsHrefWithoutAction,
    mergeStudentRosterUpdate,
} from "@/lib/studentRoster";
import type { StudentListItem } from "@/lib/api/students";

describe("student roster workflow helpers", () => {
    it("keeps loaded allocation relations when a scalar edit response is merged", () => {
        const row = {
            id: "student_1",
            name: "Original name",
            phone: "9000000000",
            seatAllocations: [{
                id: "allocation_1",
                seatId: "seat_1",
                shiftId: "shift_1",
                multiShiftId: null,
                endDate: null,
                seat: { id: "seat_1", label: "A-01" },
                shift: { id: "shift_1", name: "Morning", startTime: "08:00", endTime: "12:00" },
                multiShift: null,
            }],
        } as StudentListItem;

        const merged = mergeStudentRosterUpdate(row, {
            id: "student_1",
            name: "Updated name",
            phone: "9111111111",
        });

        expect(merged.name).toBe("Updated name");
        expect(merged.phone).toBe("9111111111");
        expect(merged.seatAllocations).toBe(row.seatAllocations);
    });

    it("builds allocation deep links with IDs only", () => {
        expect(getStudentAllocationHref("branch 1", "student&1", "allocate"))
            .toBe("/branch/branch%201/allocations?studentId=student%261");
        expect(getStudentAllocationHref("branch 1", "student&1", "change"))
            .toBe("/branch/branch%201/allocations?changeStudentId=student%261");
    });

    it("consumes the add action without dropping supported roster context", () => {
        expect(getStudentsHrefWithoutAction(
            "branch_1",
            "action=add&studentId=student_1&status=INACTIVE"
        )).toBe("/branch/branch_1/students?studentId=student_1&status=INACTIVE");
    });

    it("resolves a preselected display name from the authorized student list", () => {
        const options = [
            { id: "student_1", name: "Aarav Mehta" },
            { id: "student_2", name: "Meera Joshi" },
        ];

        expect(getStudentDisplayName(options, "student_2")).toBe("Meera Joshi");
        expect(getStudentDisplayName(options, "foreign_student")).toBe("");
    });
});
