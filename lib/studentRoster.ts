import type { Student } from "@/app/generated/prisma/browser";
import type { StudentListItem } from "@/lib/api/students";

type StudentScalarUpdate = Pick<Student, "id"> & Partial<Omit<Student, "id">>;

export function mergeStudentRosterUpdate(
    current: StudentListItem,
    updated: StudentScalarUpdate
): StudentListItem {
    return {
        ...current,
        ...updated,
        seatAllocations: current.seatAllocations,
    };
}

export function getStudentAllocationHref(
    branchId: string,
    studentId: string,
    action: "allocate" | "change"
) {
    const queryKey = action === "change" ? "changeStudentId" : "studentId";
    return `/branch/${encodeURIComponent(branchId)}/allocations?${queryKey}=${encodeURIComponent(studentId)}`;
}

export function getStudentsHrefWithoutAction(branchId: string, search: string) {
    const params = new URLSearchParams(search);
    params.delete("action");
    const query = params.toString();
    return `/branch/${encodeURIComponent(branchId)}/students${query ? `?${query}` : ""}`;
}

export function getStudentDisplayName(
    students: ReadonlyArray<{ id: string; name: string }>,
    studentId: string
) {
    return students.find(student => student.id === studentId)?.name ?? "";
}
